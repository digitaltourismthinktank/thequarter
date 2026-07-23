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
import { allowanceForMember, liveRollover, addMonthsISO, MS_ROLLOVER, MS_ROLLOVER_EXP } from './_quarter-sync.mjs';
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

/** Write whichever day-bucket fields are provided in one Memberstack update. */
async function setDayBuckets(memberId, fields) {
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: memberId, data: { customFields: fields } });
}

/** Split a day `cost` across the ROLLOVER bucket first (it expires), then plan days. Pure. */
function splitSpend(planDays, rollDays, cost) {
  const p = Math.max(0, planDays);
  const r = Math.max(0, rollDays);
  const fromRoll = Math.min(r, cost);
  const fromPlan = Math.min(p, cost - fromRoll);
  return { fromRoll, fromPlan, covered: fromRoll + fromPlan, newPlan: p - fromPlan, newRoll: r - fromRoll };
}

/** The day-bucket writes for a spend (rollover cleared of its expiry when it hits zero). */
function spendFields(s) {
  const f = { 'days-remaining': String(s.newPlan), [MS_ROLLOVER]: String(s.newRoll) };
  if (s.newRoll <= 0) f[MS_ROLLOVER_EXP] = '';
  return f;
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
  let current = parseDays(me.customFields?.['days-remaining']);
  // A metered plan member whose balance was never seeded (the field is absent, not '0') would
  // otherwise be treated as 'over allowance' and spend nothing — a silent free day. Fall back to
  // their monthly allowance so the day actually deducts and the field gets written.
  if (current === null && !unlimited && hasPlan) current = allowance;
  const planNum = current === null ? 0 : current;
  // Evaluate rollover as of NOW, not the reservation date — the spend happens now (or, for the
  // sweep, on the day, when now == dateStr), and it must match ensureDayForDate's affordability gate
  // which also reads rollover at today. Reading it at a future dateStr could show 0 (expired by then)
  // even though the gate approved on today's live rollover, silently granting a free day.
  const roll = liveRollover(me, londonNow().dateStr); // spendable rollover days (respects expiry)
  const available = planNum + roll; // total spendable plan+rollover days (metered members)
  const carnet = me.metaData?.carnet || {};
  const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
  const carnetLive = passesLeft > 0 && !(carnet.expires && carnet.expires < dateStr);
  // Days (rollover + plan) cover the cost? If not, and a carnet is live, spend a carnet pass and
  // keep the days — a future paid Day Pass is its own 'Paid' row, never a Planned.
  const canCover = !unlimited && available + 1e-9 >= cost;
  const useCarnet = !unlimited && !canCover && carnetLive;

  // Decide the funding as PURE values first — WITHOUT touching Memberstack yet.
  let newBalance = me.customFields?.['days-remaining'] ?? null;
  let carnetRemaining = null;
  let dayCost = 0;
  let mark = '';
  let dayFields = null; // day-bucket writes, or null to leave the balance alone

  if (unlimited) {
    mark = 'Unlimited';
  } else if (useCarnet) {
    carnetRemaining = passesLeft - 1;
    mark = 'Carnet pass';
  } else {
    // Spend rollover FIRST (it expires), then plan days. If they over-committed (available < cost)
    // with no carnet, let them in and spend whatever's there, flagged, rather than a silent free day.
    const s = splitSpend(planNum, roll, cost);
    dayCost = s.covered;
    dayFields = spendFields(s);
    newBalance = String(s.newPlan + s.newRoll);
    if (!canCover) mark = 'Over allowance';
  }

  // Stamp the row FIRST — this is the ONLY idempotency marker (plannedConsumed reads dayCost +
  // the note). Writing it BEFORE the irreversible Memberstack decrement means the worst a
  // failure between the two can do is leave an UN-charged (free) day, which a re-run simply
  // skips — never a double-charge or a lost carnet pass, which is the harm that actually costs a
  // member. dayCost carries the total days spent; the machine note carries the rest. Keep any AM/PM.
  const period = length === 'Half' ? String(periodFromNotes(row?.fields?.[F.checkins.notes]) || '').toUpperCase() : '';
  const notes = [period, mark].filter(Boolean).join(' · ');
  await updateRecord(T.checkins, row.id, {
    [F.checkins.dayCost]: dayCost,
    ...(notes ? { [F.checkins.notes]: notes } : {}),
  });

  // Only now the irreversible external decrement, with the row already marked spent.
  if (useCarnet) {
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({ id: me.id, data: { metaData: { ...(me.metaData || {}), carnet: { ...carnet, remaining: carnetRemaining } } } });
  } else if (dayFields) {
    await setDayBuckets(me.id, dayFields);
  }

  // Points for being in — quiet days earn double, capped monthly. Best-effort, never blocks.
  // Only a day that actually COST something (a plan/rollover day, a carnet pass) or an unlimited
  // member earns points — an over-allowance day that spent nothing (0 days, 0 passes) is a courtesy
  // entry and must NOT mint free points.
  let pointsAwarded = 0;
  const earnsPoints = unlimited || useCarnet || dayCost > 0;
  try {
    const email = (memberEmail(me) || '').toLowerCase();
    const used = await checkinBonusesThisMonth(email, dateStr.slice(0, 7));
    if (earnsPoints && used < CHECKIN_BONUS_CAP) {
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

/** The member's next renewal date (the cycle boundary) as YYYY-MM-DD, or null. Stored DD/MM/YYYY
 *  by renewMember for both Stripe and manual members. */
function renewalDateISO(me) {
  const s = String(me?.customFields?.['renewal-date'] || '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** The [start, end) billing cycle (YYYY-MM-DD) that contains `dateStr`, walking the renewal
 *  boundary forward one month at a time. Only meaningful for a future-cycle date. */
function cycleWindowFor(renewalISO, dateStr) {
  let start = renewalISO;
  let end = addMonthsISO(renewalISO, 1);
  let guard = 0;
  while (dateStr >= end && guard < 60) {
    start = end;
    end = addMonthsISO(end, 1);
    guard += 1;
  }
  return { start, end };
}

/**
 * Ensure a member has a co-working day booked for `dateStr` — the ONE place that turns "I'll be in
 * on D" into a spent day. Shared by the check-in `reserve` action AND every member room/pod booking
 * path, so being in the office always costs a day however the member got there.
 *
 * Rules:
 *  - Idempotent: if they already have a live check-in / booking / paid pass for D, no second day
 *    is taken (returns { already:true }).
 *  - Weekends carry no co-working day (rooms are Mon–Fri; weekend attendance is the separate
 *    request flow) — returns { skipped:'weekend' }.
 *  - Current cycle: spend the day NOW (rollover → plan → carnet), via consumePlannedDay.
 *  - Future cycle (D on/after the next renewal): DON'T spend now — leave a Planned row for the
 *    overnight sweep to spend on the day from that cycle's fresh allowance, gated so the member
 *    can't over-book a future cycle beyond its plan allowance (a carnet pass covers overflow).
 *  - No entitlement / can't afford: with block=true (free bookings, check-in reserve) it REFUSES
 *    ({ blocked, reason }); with block=false (a PAID room booking — they've paid, never block) it
 *    lets them in flagged over-allowance and spends nothing.
 */
export async function ensureDayForDate(me, dateStr, { source = 'Web', length = 'Full', block = true, period = '' } = {}) {
  const email = (memberEmail(me) || '').toLowerCase();
  const name = memberName(me);
  const cost = length === 'Half' ? 0.5 : 1;

  if (isWeekend(dateStr)) return { ok: true, dayCost: 0, skipped: 'weekend' };

  // Already attending that date? No second day.
  const existing = await checkinsFor(email, dateStr);
  if (existing.some((r) => r.fields[F.checkins.status] !== 'Cancelled')) return { ok: true, already: true, dayCost: 0 };

  const allowance = allowanceForMember(me);
  const unlimited = allowance === null;
  const hasPlan = allowance !== undefined;
  const carnet = me.metaData?.carnet || {};
  const passes = Math.max(0, Number(carnet.remaining) || 0);
  const carnetLive = passes > 0 && !(carnet.expires && carnet.expires < dateStr);
  let standingDays = parseDays(me.customFields?.['days-remaining']);
  if (standingDays === null && !unlimited && hasPlan) standingDays = allowance;
  const standingRoll = liveRollover(me, londonNow().dateStr);
  const hasStanding = (standingDays !== null && standingDays > 0) || standingRoll > 0;

  // No plan, no live pass, no standing days → not entitled to attend at all.
  if (!unlimited && !hasPlan && !carnetLive && !hasStanding) {
    return block ? { ok: false, blocked: true, reason: 'needs-plan-or-pass', dayCost: 0 } : { ok: true, overAllowance: true, dayCost: 0 };
  }

  const newRow = (status, dayCost) =>
    createRecord(
      T.checkins,
      {
        [F.checkins.ref]: `${name} · ${dateStr}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: dateStr,
        [F.checkins.length]: length,
        [F.checkins.notes]: length === 'Half' && period ? String(period).toUpperCase() : '',
        [F.checkins.dayCost]: dayCost,
        [F.checkins.status]: status,
        [F.checkins.source]: source,
      },
      { typecast: true },
    );

  const today = londonNow().dateStr;
  const renewal = renewalDateISO(me);
  const futureCycle = !unlimited && !!renewal && renewal > today && dateStr >= renewal;

  if (futureCycle) {
    // Gate: the member's already-committed Planned days in D's cycle + this one must fit that
    // cycle's plan allowance, unless a carnet pass covers the overflow.
    const win = cycleWindowFor(renewal, dateStr);
    const plannedInCycle = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Planned', DATETIME_FORMAT({Date},'YYYY-MM-DD')>='${esc(win.start)}', DATETIME_FORMAT({Date},'YYYY-MM-DD')<'${esc(win.end)}')`,
    });
    const committed = plannedInCycle.reduce((a, r) => a + (r.fields[F.checkins.length] === 'Half' ? 0.5 : 1), 0);
    // A carnet pass is a COUNTED cover (passes carry over), never an unlimited waiver, so the cycle
    // can fund at most its plan allowance PLUS the passes on hand — otherwise one pass would let a
    // member over-book a future cycle without bound. A member with no managed plan (allowance not a
    // number) has an effective plan cap of 0, so only passes can cover their future-cycle days.
    const coverPasses = carnetLive ? passes : 0;
    const planCap = typeof allowance === 'number' ? allowance : 0;
    const fits = committed + cost <= planCap + coverPasses + 1e-9;
    if (!fits) {
      if (block) return { ok: false, blocked: true, reason: 'no-allowance', dayCost: 0 };
      // Paid booking over the future cycle's cover: never blocked, but leave a SETTLED marker so the
      // day-of check-in sees the date as already covered and never charges a fresh co-working day.
      const over = await newRow('Planned', 0);
      await updateRecord(T.checkins, over.id, { [F.checkins.notes]: 'Over allowance' });
      return { ok: true, overAllowance: true, deferred: true, dayCost: 0, id: over?.id || null };
    }
    const rec = await newRow('Planned', 0);
    return { ok: true, deferred: true, dayCost: 0, id: rec?.id || null, balance: me.customFields?.['days-remaining'] ?? null };
  }

  // Current cycle (or unlimited): affordability gate for the blocking (free) path.
  const availNow = (standingDays === null ? 0 : standingDays) + standingRoll;
  const affordable = unlimited || availNow + 1e-9 >= cost || carnetLive;
  if (!affordable && block) return { ok: false, blocked: true, reason: 'no-allowance', dayCost: 0 };

  const rec = await newRow('Planned', 0);
  const c = await consumePlannedDay(me, { dateStr, length, row: rec });
  return {
    ok: true,
    id: rec?.id || null,
    dayCost: c.dayCost,
    balance: c.newBalance,
    pointsAwarded: c.pointsAwarded,
    usedCarnet: c.usedCarnet,
    carnetRemaining: c.carnetRemaining,
    overAllowance: !unlimited && !c.usedCarnet && c.dayCost + 1e-9 < cost,
  };
}

/**
 * Release the co-working day a room/pod booking booked, when that booking is cancelled — the
 * inverse of ensureDayForDate. Only releases (and refunds) when NOTHING else still needs the day:
 * no OTHER live booking that date, and the member hasn't physically checked in. So cancelling a pod
 * gives the day back, but cancelling one of two rooms booked the same day keeps the day held.
 */
export async function releaseDayForDate(me, dateStr, { exceptBookingId } = {}) {
  const email = (memberEmail(me) || '').toLowerCase();
  const others = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date},'YYYY-MM-DD')='${esc(dateStr)}', LOWER({Member email})='${esc(email)}', {Status}='Confirmed')`,
  });
  if (others.some((r) => r.id !== exceptBookingId)) return { released: false, reason: 'other-booking' };
  const rows = await checkinsFor(email, dateStr);
  if (rows.some((r) => r.fields[F.checkins.status] === 'Checked-in')) return { released: false, reason: 'checked-in' };
  const planned = rows.find((r) => r.fields[F.checkins.status] === 'Planned');
  if (!planned) return { released: false, reason: 'no-day' };
  const wasConsumed = plannedConsumed(planned);
  await updateRecord(T.checkins, planned.id, { [F.checkins.status]: 'Cancelled' });
  let refunded = false;
  if (wasConsumed) {
    try {
      await refundPlannedDay(me, planned);
      refunded = true;
    } catch (e) {
      console.error('[checkin] release-day refund failed', planned.id, e);
    }
  }
  return { released: true, refunded };
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
    // A walk-in / geo check-in creates a Checked-in row (not a Planned one), so today wouldn't
    // otherwise appear in the list — surface it too, flagged `in:true`, so "Your Visits" shows today
    // with the checked-in tick. `in` also tells the client to drop the cancel × (you can't un-attend a
    // walked-in day), whereas a still-Planned booked-today stays cancellable.
    if (active && !seenDates.has(today)) {
      const len = active.fields[F.checkins.length];
      upcoming.push({
        id: active.id,
        date: today,
        length: len,
        kind: 'reserved',
        period: len === 'Half' ? periodFromNotes(active.fields[F.checkins.notes]) : null,
        in: true,
      });
    }
    upcoming.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return json({
      date: today,
      checkedIn: !!active,
      length: active ? active.fields[F.checkins.length] : null,
      period: active && active.fields[F.checkins.length] === 'Half' ? periodFromNotes(active.fields[F.checkins.notes]) : null,
      balance: vm.member.customFields?.['days-remaining'] ?? null,
      // Rollover comes from the SERVER (the admin SDK sees these fields even when they're
      // admin-restricted from the client), so the dashboard can always show the plan/rolled-over
      // split regardless of the Memberstack field visibility.
      rollover: liveRollover(vm.member),
      rolloverExpiry: vm.member.customFields?.['rollover-expiry'] || null,
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
  // A KIOSK check-in carries no login: the member is identified by the id from the privacy-safe
  // name search (kiosk.mjs memberSearch) — the same low-security lobby model as kiosk.mjs
  // bookFor, fine for a small trusted space. Everything else needs the member's own token. Once
  // identified, a kiosk check-in is rewritten to the ordinary 'checkin' action and runs the
  // EXACT same code below (no money logic duplicated); only the recorded Source differs. Kiosk
  // identification is limited to check-in — reserve/cancel always require a real token.
  const kiosk = body.action === 'kioskCheckin';
  let me;
  if (kiosk) {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    try {
      const r = await admin.members.retrieve({ id: body.memberId });
      me = r?.data || null;
    } catch {
      me = null;
    }
    if (!me) return json({ error: 'unknown-member' }, 404);
    body.action = 'checkin';
  } else {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: vm.reason }, 401);
    me = vm.member;
  }
  const source = kiosk ? 'Kiosk' : 'Self';
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

  // A standing day balance is ITSELF a right to be here — even with no allowance-bearing plan.
  // That covers a PAUSED member (their days are frozen on the Paused tag, which carries no
  // allowance, so `hasPlan` is false), a member whose days were left on file, and an
  // admin-granted balance. Without this, pausing a plan — or holding day-pass days but no plan
  // tag — was refused at the gate with "needs a plan or pass", which is exactly what blocked
  // check-in for Tina (paused) and for a no-plan member with days on account. A properly lapsed
  // member is zeroed to '0' days, so this never re-opens access they shouldn't have. Seed a
  // metered plan member's balance from their allowance if the field was never written, so the
  // deduction isn't a silent free day.
  let standingDays = parseDays(me.customFields?.['days-remaining']);
  if (standingDays === null && !unlimited && hasPlan) {
    const a = allowanceForMember(me);
    if (typeof a === 'number') standingDays = a;
  }
  // Rollover days are a standing balance too — a paused member's KEPT days live in the rollover
  // bucket, so a paused member with rollover can still check in and spend it.
  const standingRoll = liveRollover(me, londonNow().dateStr);
  const hasStandingDays = (standingDays !== null && standingDays > 0) || standingRoll > 0;

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

    // A booking for today ALREADY means you're in — a booked day is attendance (same day spent,
    // same points). So tapping check-in must never open a second, fresh check-in that could charge
    // again or silently swap your booked length. Settle the booking at the LENGTH YOU BOOKED and
    // record arrival — nothing more. Changing half↔full is a separate, explicit action.
    const plannedRec = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (plannedRec) {
      const bookedLen = plannedRec.fields[F.checkins.length] === 'Half' ? 'Half' : 'Full';
      if (plannedConsumed(plannedRec)) {
        // Already settled (the overnight sweep, or reserved-for-today) — just record physical arrival.
        await updateRecord(T.checkins, plannedRec.id, { [F.checkins.status]: 'Checked-in', [F.checkins.source]: source });
        return json({ ok: true, alreadyBooked: true, length: bookedLen, balance: me.customFields?.['days-remaining'] ?? null });
      }
      // Booked but not yet settled — spend the day now at the BOOKED length (never the button's
      // default), then mark arrived. consumePlannedDay is idempotent via its dayCost stamp.
      const c = await consumePlannedDay(me, { dateStr: today, length: bookedLen, row: plannedRec });
      await updateRecord(T.checkins, plannedRec.id, { [F.checkins.status]: 'Checked-in', [F.checkins.source]: source });
      return json({ ok: true, alreadyBooked: true, length: bookedLen, balance: c.newBalance, pointsAwarded: c.pointsAwarded, usedCarnet: c.usedCarnet, carnetRemaining: c.carnetRemaining });
    }

    // A PAID Day Pass (a 'Paid' row, £21.60 already taken) covers today outright — record arrival and
    // spend NOTHING. Without this, a member who both holds a plan/carnet AND a paid pass for today was
    // charged a plan day (or a carnet pass) ON TOP of the pass, because the paths below only saw the
    // pass as an entitlement signal. ensureDayForDate already treats any live row (incl. Paid) as
    // already-covered; this brings the direct check-in into line.
    const paidRec = recs.find((r) => r.fields[F.checkins.status] === 'Paid');
    if (paidRec) {
      await updateRecord(T.checkins, paidRec.id, { [F.checkins.status]: 'Checked-in', [F.checkins.source]: source });
      return json({ ok: true, alreadyBooked: true, usedPass: true, balance: me.customFields?.['days-remaining'] ?? null });
    }

    // Entitlement. You may check in only if you have a plan, a paid day pass for today, or a
    // carnet pass to spend. A staff-approved weekend Planned record also counts (handled
    // above). Without one of these, checking in was silently free.
    const paidPassToday = recs.some((r) => r.fields[F.checkins.status] === 'Paid');
    const approvedToday = recs.some((r) => r.fields[F.checkins.status] === 'Planned');
    // A standing day balance (paused member, days on file) is a valid right to attend — see
    // hasStandingDays above. It's spent below just like a plan member's days.
    if (!hasPlan && !carnetLiveOn(today) && !paidPassToday && !approvedToday && !hasStandingDays) {
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
    // Balance = this cycle's plan days (seeded above as standingDays) PLUS the live rollover bucket.
    const planNum = standingDays === null ? 0 : standingDays;
    const roll = standingRoll; // liveRollover for today, computed above
    const available = planNum + roll;
    const canCover = !unlimited && available + 1e-9 >= cost;

    const carnet = me.metaData?.carnet || {};
    const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
    const carnetLive = passesLeft > 0 && !(carnet.expires && carnet.expires < today);
    // Days (rollover + plan) cover the day? Otherwise fall back to a carnet pass (theirs to keep),
    // else refuse. A standing/rollover balance is always spent BEFORE a carnet, and rollover before
    // plan days (the rollover expires; this cycle's plan days are for this cycle).
    const useCarnet = !unlimited && !canCover && carnetLive;

    if (!unlimited && !canCover && !useCarnet) {
      return json({ error: 'no-allowance' }, 400);
    }

    // Deduct — rollover FIRST, then plan days (unless unlimited, or paying with a carnet pass).
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    let dayCost = 0;
    if (!unlimited && !useCarnet) {
      const s = splitSpend(planNum, roll, cost);
      dayCost = s.covered;
      newBalance = String(s.newPlan + s.newRoll);
      await setDayBuckets(me.id, spendFields(s));
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
        [F.checkins.dayCost]: dayCost,
        [F.checkins.source]: source,
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
        [F.checkins.dayCost]: dayCost,
        [F.checkins.status]: 'Checked-in',
        [F.checkins.source]: source,
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

  // Change TODAY's booked / checked-in length between Half and Full. A booking already counts as
  // attendance, so this moves ONLY the day cost, by the difference — points are per-attendance and
  // never change, so they're left exactly as they are (no re-award, no claw-back). Idempotent, and
  // it refuses the one ambiguous case (an over-allowance day) rather than guess at the balance.
  if (body.action === 'changeLength') {
    const today = londonNow().dateStr;
    const recs = await checkinsFor(email, today);
    // Today's attendance row: a live check-in wins, else the booking.
    const row =
      recs.find((r) => r.fields[F.checkins.status] === 'Checked-in') ||
      recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (!row) return json({ error: 'no-booking' }, 400);

    const curLen = row.fields[F.checkins.length] === 'Half' ? 'Half' : 'Full';
    const newLen = body.length === 'Half' ? 'Half' : 'Full';
    const newPeriod = newLen === 'Half' ? (String(body.period).toLowerCase() === 'pm' ? 'PM' : 'AM') : '';
    const notes = String(row.fields[F.checkins.notes] || '');
    // Preserve the machine marker (Carnet pass / Unlimited / Over allowance) while re-setting the
    // AM/PM period. Notes are stored as "[period · ]mark".
    const markMatch = notes.match(/(Carnet pass|Unlimited|Over allowance)/i);
    const mark = markMatch ? markMatch[1] : '';
    const buildNotes = () => [newLen === 'Half' ? newPeriod : '', mark].filter(Boolean).join(' · ');

    // Same length → allow a half-day AM/PM tweak, else a no-op.
    if (curLen === newLen) {
      if (newLen === 'Half') await updateRecord(T.checkins, row.id, { [F.checkins.notes]: buildNotes() });
      return json({ ok: true, length: newLen, dayDelta: 0, unchanged: true });
    }

    // Not yet settled (a plain Planned row, no day spent): just relabel — the spend happens later
    // (at check-in or the overnight sweep) at the new length, so there's no balance to move.
    if (row.fields[F.checkins.status] === 'Planned' && !plannedConsumed(row)) {
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: newLen, [F.checkins.notes]: buildNotes() });
      return json({ ok: true, length: newLen, dayDelta: 0, pending: true });
    }

    // Unlimited or carnet-funded: half and full cost the same (nothing / one whole pass) — relabel only.
    const unlimited = allowanceForMember(me) === null || /unlimited/i.test(notes);
    if (unlimited || /carnet/i.test(notes)) {
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: newLen, [F.checkins.notes]: buildNotes() });
      return json({ ok: true, length: newLen, dayDelta: 0 });
    }
    // Over-allowance edge: the original spend didn't fully cover the nominal day, so a clean ±0.5
    // isn't well-defined — ask them to cancel & rebook rather than risk a wrong balance.
    if (/over allowance/i.test(notes)) return json({ error: 'change-unsupported' }, 409);

    // Plain plan/rollover-funded day: move the balance by the difference only. Points untouched.
    const oldCost = Number(row.fields[F.checkins.dayCost]) || 0;
    const newCost = newLen === 'Half' ? 0.5 : 1;
    const delta = newCost - oldCost; // +0.5 half→full, −0.5 full→half
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    const planNum = parseDays(me.customFields?.['days-remaining']) ?? 0;
    const roll = liveRollover(me, today);
    if (delta > 0 && planNum + roll + 1e-9 < delta) return json({ error: 'no-allowance' }, 400);
    // Stamp the row's new cost FIRST, THEN move the balance — so a failure between the two leaves an
    // UN-charged change (a re-tap reads the new dayCost, computes delta 0, and no-ops), never a
    // double-charge. This matches consumePlannedDay's stamp-first discipline. (Previously the order
    // was reversed, so a mid-write failure could double-charge on re-tap.)
    await updateRecord(T.checkins, row.id, { [F.checkins.length]: newLen, [F.checkins.notes]: buildNotes(), [F.checkins.dayCost]: newCost });
    if (delta > 0) {
      // Extend: spend the extra fraction — rollover first (it expires), then plan days.
      const s = splitSpend(planNum, roll, delta);
      await setDayBuckets(me.id, spendFields(s));
      newBalance = String(s.newPlan + s.newRoll);
    } else if (delta < 0) {
      // Shorten: give the fraction back to the plan bucket (mirrors refundPlannedDay's convention).
      const current = parseDays(me.customFields?.['days-remaining']);
      if (current !== null) {
        newBalance = String(current + -delta);
        await setDays(me.id, newBalance);
      }
    }
    return json({ ok: true, length: newLen, dayDelta: delta, balance: newBalance });
  }

  // Reserve a future day. A weekday reservation IS attendance: the shared ensureDayForDate spends
  // the day NOW if it falls in the current cycle, or leaves it Planned for the overnight sweep if
  // it's in a FUTURE cycle (so next month's days come from next month's allowance) — gated either
  // way so a member on 0 days can't over-book. Weekends stay a staff-approved request (not spent
  // until confirmed); bank holidays are refused.
  if (body.action === 'reserve') {
    const date = body.date || addDays(londonNow().dateStr, 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
    if (await isClosedDay(date)) return json({ error: 'closed-day' }, 400);

    if (isWeekend(date)) {
      const existing = await checkinsFor(email, date);
      if (existing.some((r) => r.fields[F.checkins.status] !== 'Cancelled')) return json({ ok: true, alreadyReserved: true });
      if (!hasPlan && !carnetLiveOn(date) && !hasStandingDays) return json({ error: 'needs-plan-or-pass' }, 400);
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
          [F.checkins.status]: 'Requested',
          [F.checkins.source]: source,
        },
        { typecast: true },
      );
      await sendWeekendRequestEmails({ email, name, date });
      return json({ ok: true, id: rec.id, requested: true });
    }

    const r = await ensureDayForDate(me, date, { source, length, block: true, period: periodNote });
    if (r.already) return json({ ok: true, alreadyReserved: true });
    if (r.blocked) return json({ error: r.reason === 'needs-plan-or-pass' ? 'needs-plan-or-pass' : 'no-allowance' }, 400);
    return json({
      ok: true,
      id: r.id,
      dayCost: r.dayCost,
      balance: r.balance,
      pointsAwarded: r.pointsAwarded,
      usedCarnet: r.usedCarnet,
      carnetRemaining: r.carnetRemaining,
      deferred: r.deferred,
    });
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
    // This co-working day may be HELD by a room/pod booking on the same date (a booking books the
    // day). Refunding it here while the booking stays live would be a free room — so refuse, and
    // send them to cancel the booking instead (which releases the day). A plain reserve with no
    // booking on that date cancels normally.
    const rDate = isoToLondonDate(r.fields[F.checkins.date]);
    const heldBy = await listRecords(T.bookings, {
      filterByFormula: `AND(DATETIME_FORMAT({Date},'YYYY-MM-DD')='${esc(rDate)}', LOWER({Member email})='${esc(email)}', {Status}='Confirmed')`,
      maxRecords: 1,
    });
    if (heldBy.length) return json({ error: 'held-by-booking' }, 409);
    // Their chosen policy: cancelling gives the day (or pass) back. A booked weekday is now spent
    // at booking time, so plannedConsumed(r) is true and refundPlannedDay credits it back; a weekend
    // 'Requested' row was never spent, so plannedConsumed is false and nothing is refunded.
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
