/**
 * The Quarter — Check-in API + day-usage ledger.
 *
 * GET  ?action=today           (member token) → today's status + day balance + planned days
 * POST {action:'checkin', length:'Full'|'Half'}        → check in for TODAY (deducts a day)
 * POST {action:'reserve', date, length}                → reserve a future weekday ("Tomorrow"); no deduct
 * POST {action:'cancel', id}                           → cancel an own Planned reservation
 *
 * Check-ins (Airtable) are the usage ledger. The member's day balance lives in
 * Memberstack `days-remaining`; check-in decrements it, the Stripe webhook resets it
 * on renewal. Citizen (unlimited) records the visit but never decrements.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, addDays, isoToLondonDate } from './_time.mjs';
import { allowanceForMember } from './_quarter-sync.mjs';
import { awardPoints, checkinBonusesThisMonth, earnBoostForMember, CHECKIN_BONUS, CHECKIN_QUIET_BONUS, CHECKIN_BONUS_CAP } from './_rewards.mjs';
import { isQuietDay } from './_busyness.mjs';
import { isClosedDay } from './_holidays.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';
import { pushToEmail } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

/** Weekend (Sat/Sun) for a YYYY-MM-DD — weekend access is by request, not a given. */
const isWeekend = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};
const friendlyDate = (d) => {
  try {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return d;
  }
};
async function sendWeekendRequestEmails({ email, name, date }) {
  const when = friendlyDate(date);
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject: 'Your weekend access request',
    html: emailShell(
      'Weekend access — request received',
      `<p>Hi ${escapeHtml(name)},</p><p>Thanks — we’ve logged your request to come in on <strong>${escapeHtml(when)}</strong>. Weekends aren’t always staffed, so this one isn’t automatic — we’ll confirm by email as soon as we can.</p>`,
      'We’ve received your weekend access request',
    ),
  });
  await pushToEmail(email, { title: 'Request received', body: "We'll confirm your weekend access soon.", url: '/dashboard/' });
  await sendEmail({
    to: OPS_EMAIL,
    subject: `Weekend access requested — ${when} (${name})`,
    html: emailShell('Weekend access requested', `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) has requested weekend access for <strong>${escapeHtml(when)}</strong>.</p><p>Approve or decline in Admin → Today.</p>`, 'A member requested weekend access'),
  });
  await pushToEmail(OPS_EMAIL, { title: 'New weekend request', body: `${name} · ${when}`, url: '/admin/' });
}

function parseDays(raw) {
  if (raw == null || String(raw).toLowerCase() === 'unlimited') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

async function setDays(memberId, value) {
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: memberId, data: { customFields: { 'days-remaining': value } } });
}

/** A member's check-in records for a given date (any status). */
async function checkinsFor(email, dateStr) {
  return listRecords(T.checkins, {
    filterByFormula: `AND(LOWER({Member email})='${esc(email)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}')`,
  });
}

export default async function handler(req) {
  try {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  if (req.method === 'GET') {
    const action = new URL(req.url).searchParams.get('action');
    const vm = await verifyMember(tokenFromRequest(req, null));
    if (!vm.ok) return json({ error: vm.reason }, 401);

    // Booking PIN for kiosk identification — generate + store on first request.
    if (action === 'pin') {
      const m = vm.member;
      let pin = m.metaData?.bookingPin;
      if (!pin) {
        pin = String(Math.floor(100000 + Math.random() * 900000));
        const admin = memberstackAdmin.init(MS_SECRET);
        await admin.members.update({ id: m.id, data: { metaData: { ...(m.metaData || {}), bookingPin: pin } } });
      }
      return json({ pin });
    }

    if (action !== 'today') return json({ error: 'unknown-action' }, 400);
    const email = (memberEmail(vm.member) || '').toLowerCase();
    const today = londonNow().dateStr;
    const recs = await checkinsFor(email, today);
    const active = recs.find((r) => r.fields[F.checkins.status] === 'Checked-in');
    const planned = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Planned', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    // A paid Day Pass (written by the Stripe webhook, keyed on the buyer's email) is a
    // reserved day too — once they create an account with the same email it should show
    // as already-booked, not vanish. Surface Status 'Paid' rows alongside Planned ones.
    const paidPasses = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Paid', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    const requested = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Requested', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    // Merge planned + paid into one upcoming list, de-duped by date (Planned wins if a
    // date has both); skip today when they've already checked in so it isn't listed twice.
    const upcoming = [];
    const seenDates = new Set();
    for (const r of [...planned, ...paidPasses]) {
      const d = isoToLondonDate(r.fields[F.checkins.date]);
      if (seenDates.has(d)) continue;
      if (d === today && active) continue;
      seenDates.add(d);
      upcoming.push({ id: r.id, date: d, length: r.fields[F.checkins.length], kind: r.fields[F.checkins.status] === 'Paid' ? 'pass' : 'reserved' });
    }
    upcoming.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return json({
      date: today,
      checkedIn: !!active,
      length: active ? active.fields[F.checkins.length] : null,
      balance: vm.member.customFields?.['days-remaining'] ?? null,
      planned: upcoming,
      requested: requested.map((r) => ({ id: r.id, date: isoToLondonDate(r.fields[F.checkins.date]), length: r.fields[F.checkins.length] })),
    });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const email = (memberEmail(me) || '').toLowerCase();
  const name = memberName(me);
  const length = body.length === 'Half' ? 'Half' : 'Full';
  const cost = length === 'Half' ? 0.5 : 1;
  const unlimited = allowanceForMember(me) === null;

  // Check in for TODAY (deducts unless unlimited). Idempotent per day.
  if (body.action === 'checkin') {
    const today = londonNow().dateStr;
    // Bank-holiday / seasonal closures block a check-in. Weekends are by REQUEST —
    // you can only check in if staff approved your request (a Planned record exists).
    if (await isClosedDay(today)) return json({ error: 'closed-day' }, 400);
    const recs = await checkinsFor(email, today);
    if (isWeekend(today)) {
      const approved = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
      const pending = recs.find((r) => r.fields[F.checkins.status] === 'Requested');
      if (!approved) return json({ error: pending ? 'weekend-pending' : 'weekend-request' }, 400);
    }
    const already = recs.find((r) => r.fields[F.checkins.status] === 'Checked-in');
    if (already) {
      return json({ ok: true, alreadyCheckedIn: true, balance: me.customFields?.['days-remaining'] ?? null });
    }

    // Deduct from the Memberstack balance (unless unlimited).
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    if (!unlimited) {
      const current = parseDays(me.customFields?.['days-remaining']);
      const next = current === null ? null : Math.max(0, current - cost);
      if (next !== null) {
        newBalance = String(next);
        await setDays(me.id, newBalance);
      }
    }

    // Flip an existing Planned record to Checked-in, else create one.
    const planned = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (planned) {
      await updateRecord(T.checkins, planned.id, {
        [F.checkins.status]: 'Checked-in',
        [F.checkins.length]: length,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.source]: 'Self',
      });
    } else {
      await createRecord(T.checkins, {
        [F.checkins.ref]: `${name} · ${today}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: today,
        [F.checkins.length]: length,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.status]: 'Checked-in',
        [F.checkins.source]: 'Self',
      });
    }
    // Award Quarter Rewards points for being in (quiet days earn double; monthly cap).
    let pointsAwarded = 0;
    try {
      const used = await checkinBonusesThisMonth(email, today.slice(0, 7));
      if (used < CHECKIN_BONUS_CAP) {
        const quiet = isQuietDay(today);
        // The member's earned level gives a gentle boost to the base bonus.
        const mult = earnBoostForMember(me);
        pointsAwarded = Math.round((quiet ? CHECKIN_QUIET_BONUS : CHECKIN_BONUS) * mult);
        await awardPoints(me, pointsAwarded, quiet ? 'checkin-quiet' : 'checkin', today);
      }
    } catch {
      /* points are best-effort; never block a check-in */
    }
    return json({ ok: true, balance: newBalance, pointsAwarded });
  }

  // Reserve a future day. No deduction until they actually check in. Weekends are
  // allowed for members (the app asks them to confirm); bank holidays are not.
  if (body.action === 'reserve') {
    const date = body.date || addDays(londonNow().dateStr, 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
    if (await isClosedDay(date)) return json({ error: 'closed-day' }, 400);
    const existing = await checkinsFor(email, date);
    if (existing.some((r) => r.fields[F.checkins.status] !== 'Cancelled')) {
      return json({ ok: true, alreadyReserved: true });
    }
    // Weekends are by request (not a given): create a 'Requested' record + notify staff.
    // Weekdays reserve straight to 'Planned'.
    const weekend = isWeekend(date);
    const rec = await createRecord(
      T.checkins,
      {
        [F.checkins.ref]: `${name} · ${date}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: date,
        [F.checkins.length]: length,
        [F.checkins.dayCost]: 0,
        [F.checkins.status]: weekend ? 'Requested' : 'Planned',
        [F.checkins.source]: 'Self',
      },
      { typecast: true },
    );
    if (weekend) await sendWeekendRequestEmails({ email, name, date });
    return json({ ok: true, id: rec.id, requested: weekend });
  }

  // Cancel an own Planned reservation.
  if (body.action === 'cancel') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const recs = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(body.id)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    if (String(r.fields[F.checkins.email] || '').toLowerCase() !== email) return json({ error: 'forbidden' }, 403);
    const st = r.fields[F.checkins.status];
    if (st !== 'Planned' && st !== 'Requested') return json({ error: 'only-planned-cancellable' }, 400);
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: 'Cancelled' });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: 'server' }, 500);
  }
}
