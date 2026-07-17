/**
 * The Quarter — native Day Pass checkout (£21.60 one-off; replaces the Typeform).
 *
 *   POST { firstName, lastName, company?, email, date }  → { clientSecret }   (Stripe PaymentIntent)
 *
 * The browser confirms in-site with the Payment Element. The Stripe webhook finalises
 * on payment_intent.succeeded (metadata.kind='day-pass') — records the pass + emails
 * the confirmation. No account is created (it's a single guest day). Env: STRIPE_SECRET_KEY.
 */
import { createRecord, T, F, airtableReady } from './_airtable.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL, fmtDateLong } from './_email.mjs';
import { pushToEmail } from './_push.mjs';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const DAY_PASS_PENCE = 2160; // £21.60 inc VAT — keep in step with DAY_PASS_PRICE (lib/rewards.ts)

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// We open at 09:00. An arrival may be requested from 08:00; the picker offers 30-min steps
// to 17:30. Normalise to a valid 'HH:MM' inside 08:00–17:30, defaulting to 09:00 when the
// value is missing/malformed/out of range. Anything before 09:00 is an out-of-hours request
// (booked anyway, flagged for staff) — never a blocker. 'HH:MM' strings compare chronologically.
const OPEN_TIME = '09:00';
function normArrival(v) {
  const s = String(v || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return OPEN_TIME;
  if (s < '08:00' || s > '17:30') return OPEN_TIME;
  return s;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const company = String(body.company || '').trim();
  const name = `${firstName} ${lastName}`.trim();
  const date = String(body.date || '').trim();
  if (!isEmail(email)) return json({ error: 'bad-email' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
  // Arrival never blocks the booking — it's normalised, and a pre-09:00 pick is just flagged.
  const arrival = normArrival(body.arrival);
  const outOfHours = arrival < OPEN_TIME;
  const arrivalStatus = outOfHours ? 'requested' : 'confirmed';
  const arrivalNote = outOfHours ? `${arrival} (before we open — requested)` : arrival;

  // TEST COMP (secret, env-gated): a smoke-test path for the LIVE one-off card flow. When
  // TEST_COMP_CODE is set AND the request carries the exact same `test` value, SKIP Stripe and
  // record + confirm this Day Pass at £0 exactly as a paid one would (mirroring finaliseDayPass
  // in stripe-webhook.mjs) — so admin/dashboard/email are all exercised without a real charge.
  // INERT (never taken) when TEST_COMP_CODE is unset/empty; the public can never trigger it, and
  // the real PaymentIntent path below is 100% unchanged for non-comp requests.
  const COMP = process.env.TEST_COMP_CODE;
  if (COMP && body.test === COMP) {
    if (airtableReady()) {
      try {
        await createRecord(
          T.checkins,
          {
            [F.checkins.email]: email,
            [F.checkins.name]: name,
            [F.checkins.date]: date,
            [F.checkins.length]: 'Full',
            [F.checkins.status]: 'Paid',
            [F.checkins.source]: 'Web',
            [F.checkins.notes]: `Day Pass · TEST COMP · £0 · Arrival ${arrivalNote}${company ? ' · ' + company : ''}`,
          },
          { typecast: true },
        );
      } catch {
        /* record best-effort — never block the comp */
      }
    }
    await sendEmail({
      to: email,
      replyTo: OPS_EMAIL,
      subject: 'Your Day Pass (TEST) is booked',
      html: emailShell(
        'Your Day Pass (TEST) is booked',
        `<p>Thanks${name ? `, ${escapeHtml(name)}` : ''} — this is a £0 test Day Pass for ${escapeHtml(fmtDateLong(date))}.</p>
         <p style="margin:0 0 6px;"><strong>Day Pass</strong> · ${escapeHtml(fmtDateLong(date))}</p>
         <p style="margin:0 0 6px;">Arrival: <strong>${escapeHtml(arrival)}</strong>${outOfHours ? ' — requested, we’ll confirm this early start with you' : ''}</p>
         <p style="margin:0 0 6px;">Total: <strong>£0.00</strong> · TEST COMP</p>`,
        'Your Quarter Day Pass (TEST) is booked',
      ),
    });
    await pushToEmail(email, { title: 'Day Pass booked', body: `You're in for ${date}.`, url: '/dashboard/' });
    return json({ ok: true, comped: true });
  }

  const pi = await stripe('/v1/payment_intents', 'POST', {
    amount: String(DAY_PASS_PENCE),
    currency: 'gbp',
    'payment_method_types[0]': 'card',
    receipt_email: email,
    description: `The Quarter — Day Pass (${date})`,
    'metadata[kind]': 'day-pass',
    'metadata[email]': email,
    'metadata[name]': name,
    'metadata[company]': company,
    'metadata[date]': date,
    'metadata[arrival]': arrival,
    'metadata[arrivalStatus]': arrivalStatus,
  });
  if (pi?.error || !pi?.client_secret) return json({ error: 'stripe', detail: pi?.error?.message }, 502);
  return json({ clientSecret: pi.client_secret });
}
