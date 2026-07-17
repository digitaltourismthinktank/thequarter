/**
 * The Quarter — day-pass carnet (CODE_BRIEF §5).
 *
 * GET  (member token) → { carnet:{remaining,total,expires} }
 * POST {action:'use'}  → spend one pass on today's visit (check in, decrement remaining)
 *
 * carnet lives on Memberstack metaData; purchases top it up via the Stripe webhook.
 * A pass-use ties to a real check-in and earns the same check-in points as any visit.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';
import {
  appendLedger,
  memberPoints,
  memberLifetimePoints,
  earnBoostForMember,
  checkinBonusesThisMonth,
  CHECKIN_BONUS,
  CHECKIN_QUIET_BONUS,
  CHECKIN_BONUS_CAP,
  CARNET_AMOUNT_TO_PASSES,
} from './_rewards.mjs';
import { isQuietDay } from './_busyness.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';
import { pushToEmail } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

// passes → price in pence (reverse of CARNET_AMOUNT_TO_PASSES — one source of truth).
const CARNET_PENCE = Object.fromEntries(Object.entries(CARNET_AMOUNT_TO_PASSES).map(([pence, passes]) => [passes, Number(pence)]));

const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

function carnetOf(m) {
  const c = m?.metaData?.carnet || {};
  return { remaining: Math.max(0, Number(c.remaining) || 0), total: Math.max(0, Number(c.total) || 0), expires: c.expires || null };
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : null;

  // Carnet purchase — in-site Stripe PaymentIntent. PUBLIC (buy-then-join): a guest with no
  // account can buy a book of passes; their email rides in the PI metadata so the Stripe
  // webhook credits the passes once an account with that same email exists (its
  // 'member-not-ready-carnet' retry waits for it). A signed-in member's token, when present,
  // takes precedence for the email. The £ amount is server-authoritative (CARNET_PENCE) — the
  // client only *selects* a bundle by pass count, so a forged amount can never reach Stripe.
  if (req.method === 'POST' && body?.action === 'intent') {
    if (!STRIPE_SECRET) return json({ error: 'not-configured' }, 503);
    const passes = Number(body.passes) || 0;
    const pence = CARNET_PENCE[passes];
    if (!pence) return json({ error: 'bad-bundle' }, 400);
    // Prefer the signed-in member (token); otherwise the guest's posted details.
    const vm = await verifyMember(tokenFromRequest(req, body));
    const email = (vm.ok ? memberEmail(vm.member) : String(body.email || '').trim().toLowerCase()) || '';
    if (!isEmail(email)) return json({ error: 'bad-email' }, 400);
    const guestName = `${String(body.firstName || '')} ${String(body.lastName || '')}`.trim() || String(body.name || '').trim();
    const name = vm.ok ? memberName(vm.member) : guestName;
    const company = vm.ok ? '' : String(body.company || '').trim();

    // TEST COMP (secret, env-gated) — see day-pass.mjs. A guest carnet records nothing
    // server-side (the Stripe webhook credits passes to the member's wallet once they sign up),
    // so the guest-visible part to mirror at £0 is the buyer confirmation email. INERT unless
    // TEST_COMP_CODE is set AND body.test matches it; the public can never trigger it, and the
    // real PaymentIntent path below is unchanged for non-comp requests.
    const COMP = process.env.TEST_COMP_CODE;
    if (COMP && body.test === COMP) {
      await sendEmail({
        to: email,
        replyTo: OPS_EMAIL,
        subject: `Your carnet (TEST) — ${passes} ${passes === 1 ? 'pass' : 'passes'}`,
        html: emailShell(
          'Your day-pass carnet (TEST) is ready',
          `<p>Thanks${name ? `, ${escapeHtml(name)}` : ''} — this is a £0 test carnet of ${passes} day ${passes === 1 ? 'pass' : 'passes'}.</p>
           <p style="margin:0 0 6px;">Total: <strong>£0.00</strong> · TEST COMP</p>`,
          'Your Quarter day-pass carnet (TEST)',
        ),
      });
      await pushToEmail(email, { title: 'Passes added', body: `${passes} day ${passes === 1 ? 'pass is' : 'passes are'} on your account.`, url: '/dashboard/' });
      return json({ ok: true, comped: true });
    }

    const pi = await stripe('/v1/payment_intents', 'POST', {
      amount: String(pence),
      currency: 'gbp',
      'payment_method_types[0]': 'card',
      receipt_email: email,
      description: `The Quarter — carnet (${passes} day passes)`,
      'metadata[kind]': 'carnet',
      'metadata[email]': email,
      'metadata[passes]': String(passes),
      'metadata[name]': name,
      'metadata[company]': company,
    });
    if (pi?.error || !pi?.client_secret) return json({ error: 'stripe', detail: pi?.error?.message }, 502);
    return json({ clientSecret: pi.client_secret });
  }

  // Everything else (GET balance, POST 'use') requires a member.
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  // Canonical lowercase — checkin.mjs stores/queries check-ins lowercased, so the "already checked
  // in today" guard below and the row we write must use the same key or a mixed-case email would
  // spend a pass + create a duplicate check-in.
  const email = (memberEmail(me) || '').toLowerCase();

  if (req.method === 'GET') return json({ carnet: carnetOf(me) });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  if (body.action === 'use') {
    const c = carnetOf(me);
    const today = londonNow().dateStr;
    if (c.remaining <= 0) return json({ error: 'no-passes' }, 400);
    if (c.expires && c.expires < today) return json({ error: 'expired' }, 400);
    if (await isClosedDay(today)) return json({ error: 'closed-day' }, 400);

    const todays = await listRecords(T.checkins, {
      filterByFormula: `AND({Member email}='${esc(email)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(today)}', {Status}='Checked-in')`,
      maxRecords: 1,
    });
    if (todays[0]) return json({ error: 'already-in' }, 400);

    // Check-in points (monthly cap), folded with the carnet decrement into one write.
    let pts = 0;
    const used = await checkinBonusesThisMonth(email, today.slice(0, 7));
    if (used < CHECKIN_BONUS_CAP) {
      const quiet = isQuietDay(today);
      pts = Math.round((quiet ? CHECKIN_QUIET_BONUS : CHECKIN_BONUS) * earnBoostForMember(me));
      await appendLedger(email, pts, quiet ? 'checkin-quiet' : 'checkin', today);
    }
    const newRemaining = c.remaining - 1;
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({
      id: me.id,
      data: {
        metaData: {
          ...(me.metaData || {}),
          carnet: { ...c, remaining: newRemaining },
          points: memberPoints(me) + pts,
          lifetimePoints: memberLifetimePoints(me) + pts,
        },
      },
    });
    await createRecord(T.checkins, {
      [F.checkins.ref]: `${memberName(me)} · ${today}`,
      [F.checkins.email]: email,
      [F.checkins.name]: memberName(me),
      [F.checkins.date]: today,
      [F.checkins.length]: 'Full',
      [F.checkins.dayCost]: 0,
      [F.checkins.status]: 'Checked-in',
      [F.checkins.source]: 'Self',
      [F.checkins.notes]: 'Carnet pass',
    });
    return json({ ok: true, carnet: { ...c, remaining: newRemaining }, pointsAwarded: pts });
  }

  return json({ error: 'unknown-action' }, 400);
}
