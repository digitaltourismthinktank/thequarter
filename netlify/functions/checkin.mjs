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
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL, fmtDateLong } from './_email.mjs';
import { pushToEmail, pushToAdmins } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

/** Weekend (Sat/Sun) for a YYYY-MM-DD — weekend access is by request, not a given. */
const isWeekend = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};
/** A half day's period ('am'|'pm') is stored in the Check-in's Notes field as 'AM'/'PM'.
 *  The Notes field is overloaded — it may also carry 'Carnet pass', 'Unlimited' or a comms
 *  token after a ' · ' — so read the FIRST segment, not the whole string, or a half-day's
 *  morning/afternoon would be lost the moment anything else was appended. */
const periodFromNotes = (n) => {
  const s = String(n || '').split('·')[0].trim().toUpperCase();
  return s === 'AM' ? 'am' : s === 'PM' ? 'pm' : null;
};
async function sendWeekendRequestEmails({ email, name, date }) {
  const when = fmtDateLong(date);
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
  await pushToAdmins({ title: 'New weekend request', body: `${name} · ${when}`, url: '/admin/' });
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

/**
 * Has a Planned reservation already had its day SPENT?
 *
 * A planned day now counts as attendance — the overnight sweep (renew-cron) spends it on the
 * morning of, so a member needn't physically check in. The marker lives in the row itself, not
 * a separate table: a positive dayCost means a plan-day was deducted, and the note carries the
 * carnet / unlimited / over-allowance cases (which legitimately cost 0 days). Either way a
 * second sweep, or a later physical check-in, can read it and know not to charge twice.
 */
export function plannedConsumed(row) {
  const dc = Number(row?.fields?.[F.checkins.dayCost]);
  const notes = String(row?.fields?.[F.checkins.notes] || '');
  return (Number.isFinite(dc) && dc > 0) || /carnet pass|unlimited|over allowance/i.test(notes);
}

/**
 * Spend the day a member reserved: deduct from their plan balance (or a carnet pass, or simply
 * note it for an unlimited member), award the check-in points, and stamp the Check-ins row so
 * it can never be charged twice. Called by the morning sweep for every future reservation, and
 * inline for a same-day one. Kept deliberately close to the live check-in deduction below —
 * same ordering (plan days first, carnet as the fallback), same points rules.
 */
export async function consumePlannedDay(me, { dateStr, length, row }) {
  const cost = length === 'Half' ? 0.5 : 1;
  const allowance = allowanceForMember(me);
  const unlimited = allowance === null;
  const hasPlan = allowance !== undefined;
  const current = parseDays(me.customFields?.['days-remaining']);
  const carnet = me.metaData?.carnet || {};
  const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
  const carnetLive = passesLeft > 0 && !(carnet.expires && carnet.expires < dateStr);
  const outOfDays = !unlimited && current !== null && current < cost;
  // Plan days first, carnet as the fallback — out of days, or no plan at all (a carnet-only
  // member who reserved a day). A future paid Day Pass is its own 'Paid' row, never a Planned.
  const useCarnet = (outOfDays || !hasPlan) && carnetLive;

  // Decide the funding as PURE values first — what to spend, what to mark, what to write to
  // Memberstack — WITHOUT touching Memberstack yet.
  let newBalance = me.customFields?.['days-remaining'] ?? null;
  let carnetRemaining = null;
  let dayCost = 0;
  let mark = '';
  let spend = null; // null | { kind: 'carnet' } | { kind: 'days', value }

  if (unlimited) {
    mark = 'Unlimited';
  } else if (useCarnet) {
    carnetRemaining = passesLeft - 1;
    mark = 'Carnet pass';
    spend = { kind: 'carnet' };
  } else if (current !== null && !outOfDays) {
    newBalance = String(Math.max(0, current - cost));
    dayCost = cost;
    spend = { kind: 'days', value: newBalance };
  } else {
    // A plan member who over-committed — reserved more days than they hold, with no carnet to
    // fall back on. Let them in (they pay for the month), spend whatever's left, and flag the
    // shortfall so the office can see it rather than a silent free day.
    if (current !== null && current > 0) {
      dayCost = current;
      newBalance = '0';
      spend = { kind: 'days', value: '0' };
    }
    mark = 'Over allowance';
  }

  // Stamp the row FIRST — this is the ONLY idempotency marker (plannedConsumed reads dayCost +
  // the note). Writing it BEFORE the irreversible Memberstack decrement means the worst a
  // failure between the two can do is leave an UN-charged (free) day, which a re-run simply
  // skips — never a double-charge or a lost carnet pass, which is the harm that actually costs a
  // member. dayCost carries the plan-day spend; the machine note carries the rest. Keep any AM/PM.
  const period = length === 'Half' ? String(periodFromNotes(row?.fields?.[F.checkins.notes]) || '').toUpperCase() : '';
  const notes = [period, mark].filter(Boolean).join(' · ');
  await updateRecord(T.checkins, row.id, {
    [F.checkins.dayCost]: dayCost,
    ...(notes ? { [F.checkins.notes]: notes } : {}),
  });

  // Only now the irreversible external decrement, with the row already marked spent.
  if (spend?.kind === 'carnet') {
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({ id: me.id, data: { metaData: { ...(me.metaData || {}), carnet: { ...carnet, remaining: carnetRemaining } } } });
  } else if (spend?.kind === 'days') {
    await setDays(me.id, spend.value);
  }

  // Points for being in — quiet days earn double, capped monthly. Best-effort, never blocks.
  let pointsAwarded = 0;
  try {
    const email = (memberEmail(me) || '').toLowerCase();
    const used = await checkinBonusesThisMonth(email, dateStr.slice(0, 7));
    if (used < CHECKIN_BONUS_CAP) {
      const quiet = isQuietDay(dateStr);
      const mult = earnBoostForMember(me);
      pointsAwarded = Math.round((quiet ? CHECKIN_QUIET_BONUS : CHECKIN_BONUS) * mult);
      await awardPoints(me, pointsAwarded, quiet ? 'checkin-quiet' : 'checkin', dateStr);
    }
  } catch {
    /* points never block attendance */
  }

  return { dayCost, newBalance, usedCarnet: useCarnet, carnetRemaining, pointsAwarded };
}

/**
 * Reverse a spent reservation when a member cancels ON the day (their chosen policy: free to
 * cancel a future day, a same-day cancel gives the day back). Gives back a carnet pass, or the
 * deducted plan-day(s); an unlimited member spent nothing to return. Points are left as they
 * were — a soft loyalty currency already capped monthly, not worth clawing back.
 */
async function refundPlannedDay(me, row) {
  const notes = String(row.fields[F.checkins.notes] || '');
  if (/unlimited/i.test(notes)) return;
  const admin = memberstackAdmin.init(MS_SECRET);
  if (/carnet pass/i.test(notes)) {
    const carnet = me.metaData?.carnet || {};
    const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
    await admin.members.update({ id: me.id, data: { metaData: { ...(me.metaData || {}), carnet: { ...carnet, remaining: passesLeft + 1 } } } });
    return;
  }
  const dc = Number(row.fields[F.checkins.dayCost]);
  if (Number.isFinite(dc) && dc > 0) {
    const current = parseDays(me.customFields?.['days-remaining']);
    if (current !== null) await setDays(me.id, String(current + dc));
  }
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
      const len = r.fields[F.checkins.length];
      const kind = r.fields[F.checkins.status] === 'Paid' ? 'pass' : 'reserved';
      // Period only for a member's own half-day reservation (a paid pass's Notes hold pass metadata).
      upcoming.push({ id: r.id, date: d, length: len, kind, period: len === 'Half' && kind !== 'pass' ? periodFromNotes(r.fields[F.checkins.notes]) : null });
    }
    upcoming.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return json({
      date: today,
      checkedIn: !!active,
      length: active ? active.fields[F.checkins.length] : null,
      period: active && active.fields[F.checkins.length] === 'Half' ? periodFromNotes(active.fields[F.checkins.notes]) : null,
      balance: vm.member.customFields?.['days-remaining'] ?? null,
      planned: upcoming,
      requested: requested.map((r) => ({
        id: r.id,
        date: isoToLondonDate(r.fields[F.checkins.date]),
        length: r.fields[F.checkins.length],
        period: r.fields[F.checkins.length] === 'Half' ? periodFromNotes(r.fields[F.checkins.notes]) : null,
      })),
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
  // Half days carry a morning/afternoon so staff know when to expect the member. Stored in
  // the Notes field as 'AM'/'PM' (no Airtable schema change); empty for full days.
  const periodNote = length === 'Half' ? (String(body.period).toLowerCase() === 'pm' ? 'PM' : 'AM') : '';
  const unlimited = allowanceForMember(me) === null;
  // A plan is what entitles you to be here. allowanceForMember returns null for unlimited
  // (Citizen) or a number for a metered plan; undefined means NO plan at all. That last
  // case was the hole: with no plan and no days-remaining field, the allowance block below
  // never fired (there were no days to run out of), so a no-plan account could check in and
  // reserve days for free, indefinitely — which is exactly how someone with neither a
  // membership nor a day pass ended up in the who's-in list.
  const hasPlan = allowanceForMember(me) !== undefined;
  const carnetState = me.metaData?.carnet || {};
  const carnetPasses = Math.max(0, Number(carnetState.remaining) || 0);
  const carnetLiveOn = (d) => carnetPasses > 0 && !(carnetState.expires && carnetState.expires < d);

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

    // A planned day already spent for real (auto-attended by the morning sweep, or reserved
    // for today). This tap is just physical arrival — record it, don't charge the day again.
    const plannedRec = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (plannedRec && plannedConsumed(plannedRec)) {
      await updateRecord(T.checkins, plannedRec.id, { [F.checkins.status]: 'Checked-in', [F.checkins.source]: 'Self' });
      return json({ ok: true, alreadyCounted: true, balance: me.customFields?.['days-remaining'] ?? null });
    }

    // Entitlement. You may check in only if you have a plan, a paid day pass for today, or a
    // carnet pass to spend. A staff-approved weekend Planned record also counts (handled
    // above). Without one of these, checking in was silently free.
    const paidPassToday = recs.some((r) => r.fields[F.checkins.status] === 'Paid');
    const approvedToday = recs.some((r) => r.fields[F.checkins.status] === 'Planned');
    if (!hasPlan && !carnetLiveOn(today) && !paidPassToday && !approvedToday) {
      return json({ error: 'needs-plan-or-pass' }, 400);
    }

    // Spend the plan's days first, and only fall back to a carnet pass once they're gone.
    //
    // That ordering is what a member expects — the days are already paid for this month and
    // expire with it, whereas carnet passes are theirs to keep — but until now there was no
    // fallback at all: check-in only ever looked at `days-remaining`, so someone holding ten
    // paid passes was still told "no days left" and had to go and find a different button on
    // a different card to use one. Being refused entry while holding passes you bought is
    // the worst version of this, so the fallback is automatic and the response says which
    // was spent.
    const current = parseDays(me.customFields?.['days-remaining']);
    const outOfDays = !unlimited && current !== null && current < cost;

    const carnet = me.metaData?.carnet || {};
    const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
    const carnetLive = passesLeft > 0 && !(carnet.expires && carnet.expires < today);
    // Spend a carnet pass when a plan member has run out of days, AND when a member with no
    // plan and no paid pass is here on a carnet — otherwise the gate above would let them in
    // but nothing would be spent, which is the free check-in all over again.
    const useCarnet = (outOfDays || (!hasPlan && !paidPassToday)) && carnetLive;

    if (outOfDays && !useCarnet) {
      return json({ error: 'no-allowance' }, 400);
    }

    // Deduct from the Memberstack balance (unless unlimited, or paying with a pass).
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    if (!unlimited && !useCarnet) {
      const next = current === null ? null : Math.max(0, current - cost);
      if (next !== null) {
        newBalance = String(next);
        await setDays(me.id, newBalance);
      }
    }
    // A carnet pass covers a whole day, so a half day still costs one — there is no half
    // pass. Worth surfacing to the member rather than quietly charging a full one.
    let carnetRemaining = null;
    if (useCarnet) {
      carnetRemaining = passesLeft - 1;
      const msAdmin = memberstackAdmin.init(MS_SECRET);
      await msAdmin.members.update({
        id: me.id,
        data: { metaData: { ...(me.metaData || {}), carnet: { ...carnet, remaining: carnetRemaining } } },
      });
    }

    // Flip an existing Planned record to Checked-in, else create one.
    const planned = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (planned) {
      await updateRecord(T.checkins, planned.id, {
        [F.checkins.status]: 'Checked-in',
        [F.checkins.length]: length,
        [F.checkins.notes]: periodNote,
        [F.checkins.dayCost]: unlimited || useCarnet ? 0 : cost,
        [F.checkins.source]: 'Self',
        ...(useCarnet ? { [F.checkins.notes]: `${periodNote ? periodNote + ' · ' : ''}Carnet pass` } : {}),
      });
    } else {
      await createRecord(T.checkins, {
        [F.checkins.ref]: `${name} · ${today}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: today,
        [F.checkins.length]: length,
        [F.checkins.notes]: periodNote,
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
    return json({ ok: true, balance: newBalance, pointsAwarded, usedCarnet: useCarnet, carnetRemaining });
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
    // Same gate as a live check-in: reserving is only meaningful if you could actually
    // attend. A no-plan account with no carnet would otherwise plan days it can never use
    // and show up in the admin who's-in list as expected. A future paid day pass already
    // exists as a row, so it short-circuits above and never reaches here.
    if (!hasPlan && !carnetLiveOn(date)) {
      return json({ error: 'needs-plan-or-pass' }, 400);
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
        [F.checkins.notes]: periodNote,
        [F.checkins.dayCost]: 0,
        [F.checkins.status]: weekend ? 'Requested' : 'Planned',
        [F.checkins.source]: 'Self',
      },
      { typecast: true },
    );
    if (weekend) {
      await sendWeekendRequestEmails({ email, name, date });
      return json({ ok: true, id: rec.id, requested: true });
    }
    // A weekday reservation now IS attendance — the day gets spent. Future days are swept
    // overnight (renew-cron), so a reservation for TODAY has to be spent here and now: the
    // sweep for today already ran this morning and won't run again.
    if (date === londonNow().dateStr) {
      const c = await consumePlannedDay(me, { dateStr: date, length, row: rec });
      return json({ ok: true, id: rec.id, balance: c.newBalance, pointsAwarded: c.pointsAwarded, usedCarnet: c.usedCarnet, carnetRemaining: c.carnetRemaining });
    }
    return json({ ok: true, id: rec.id });
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
    // Their chosen policy: a future day was never charged, but a day already spent (a same-day
    // cancel, or one the overnight sweep has reached) is given back.
    //
    // Mark it Cancelled BEFORE crediting the refund. The cancellable-status guard above then
    // rejects any retry, so a transient failure of the refund write becomes a rare, logged,
    // staff-fixable MISSED credit — never a DOUBLE credit, and never a still-'Planned'+spent row
    // the member could also walk in on for free. Capture the spent state before the write flips it.
    const wasConsumed = plannedConsumed(r);
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: 'Cancelled' });
    let refunded = false;
    if (wasConsumed) {
      try {
        await refundPlannedDay(me, r);
        refunded = true;
      } catch (e) {
        console.error('[checkin] refund-after-cancel failed', body.id, e);
      }
    }
    return json({ ok: true, refunded });
  }

  return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: 'server' }, 500);
  }
}
