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
import { awardPoints, reverseCheckinPoints, checkinBonusesThisMonth, earnBoostForMember, CHECKIN_BONUS, CHECKIN_QUIET_BONUS, CHECKIN_BONUS_CAP } from './_rewards.mjs';
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

/**
 * Write ONLY the carnet key, and keep the in-memory member in step.
 *
 * Memberstack merges metaData by TOP-LEVEL KEY, so spreading a read-once `me.metaData` into an
 * update re-asserts a snapshot taken at the start of the request — silently reverting anything
 * else written since. That is precisely how a spent pass came back: the decrement landed, then a
 * later write in the same request (awardPoints) restored the stale `carnet`, while the Airtable row
 * stayed stamped 'Carnet pass' — so cancelling refunded a pass that was never really taken, minting
 * passes on book-then-cancel.
 *
 * Rule: never spread a metaData snapshot. Write only the key you own, and update `me` so any later
 * read or write in the same request sees the truth.
 */
async function setCarnet(me, carnet) {
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: me.id, data: { metaData: { carnet } } });
  if (me.metaData) me.metaData.carnet = carnet;
  else me.metaData = { carnet };
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

/** The token appended to a row's Notes once its debit has actually landed. See consumePlannedDay. */
const SETTLED = 'settled';

/** Did this row's debit actually land? The ONLY basis on which a refund may pay out. */
function isSettled(row) {
  return /\bsettled\b/i.test(String(row?.fields?.[F.checkins.notes] || ''));
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
  let rollTok = ''; // which bucket funded this, so a refund can repay the SAME one
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
    // Record the rollover share (and the expiry the spend is about to clear). Every refund used to
    // credit the PLAN bucket regardless, which quietly laundered expiring rollover days into
    // permanent plan days — book, cancel, and an expiring day came back with no expiry at all.
    if (s.fromRoll > 0) rollTok = `roll:${s.fromRoll}@${String(me.customFields?.[MS_ROLLOVER_EXP] || '')}`;
    if (!canCover) mark = 'Over allowance';
  }

  // Stamp the row FIRST — this is the ONLY idempotency marker (plannedConsumed reads dayCost +
  // the note). Writing it BEFORE the irreversible Memberstack decrement means the worst a
  // failure between the two can do is leave an UN-charged (free) day, which a re-run simply
  // skips — never a double-charge or a lost carnet pass, which is the harm that actually costs a
  // member. dayCost carries the total days spent; the machine note carries the rest. Keep any AM/PM.
  const period = length === 'Half' ? String(periodFromNotes(row?.fields?.[F.checkins.notes]) || '').toUpperCase() : '';
  const notes = [period, mark, rollTok].filter(Boolean).join(' · ');
  await updateRecord(T.checkins, row.id, {
    [F.checkins.dayCost]: dayCost,
    ...(notes ? { [F.checkins.notes]: notes } : {}),
  });

  // Only now the irreversible external decrement, with the row already marked spent.
  if (useCarnet) {
    await setCarnet(me, { ...carnet, remaining: carnetRemaining });
  } else if (dayFields) {
    await setDayBuckets(me.id, dayFields);
  }

  // SETTLEMENT. The stamp above records INTENT — it is what makes the sweep and a later check-in
  // idempotent (never charge twice), and it is deliberately written BEFORE the irreversible write.
  // This second marker, written only once the external debit has actually landed, is EVIDENCE, and
  // it is the ONLY thing a refund is allowed to pay out against.
  //
  // Without this split the two are indistinguishable: a row could claim a spend that never landed
  // (or that a later write reverted) and cancelling it would hand back a day/pass that was never
  // taken — minting currency on every book-then-cancel.
  if (useCarnet || dayFields) {
    try {
      await updateRecord(T.checkins, row.id, { [F.checkins.notes]: [notes, SETTLED].filter(Boolean).join(' · ') });
    } catch (e) {
      // Failing to confirm is safe in the direction that matters: the debit stands, and the row
      // simply isn't refundable until staff reconcile it. Never the other way round.
      console.error('[checkin] settle-stamp failed', row.id, e);
    }
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
export function renewalDateISO(me) {
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

  const existing = await checkinsFor(email, dateStr);
  const live = existing.filter((r) => r.fields[F.checkins.status] !== 'Cancelled');

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

  // Already committed to that date? Then never a SECOND day — but a room/pod booking is a FULL day,
  // so if the existing commitment is SMALLER (a booked half day) top it up by the difference. Blindly
  // short-circuiting on any live row handed a member a full day in a meeting room for half a day's
  // cost. Anything already covering the length (or bigger) stays exactly as it is.
  if (live.length) {
    const row = live.find((r) => r.fields[F.checkins.status] === 'Planned') || live[0];
    const haveCost = row.fields[F.checkins.length] === 'Half' ? 0.5 : 1;
    if (cost <= haveCost + 1e-9) return { ok: true, already: true, dayCost: 0 };
    const rowNotes = String(row.fields[F.checkins.notes] || '');
    // A pass covers a whole day and unlimited costs nothing, so those only relabel. A row that isn't
    // settled yet (a deferred future-cycle day, or an over-allowance courtesy) also just relabels —
    // the sweep settles the FULL length on the day.
    if (/carnet pass|unlimited|over allowance/i.test(rowNotes) || !isSettled(row)) {
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: length });
      return { ok: true, already: true, upgraded: true, dayCost: 0 };
    }
    // Plain plan/rollover-funded: charge the DIFFERENCE only.
    const delta = cost - haveCost;
    const availUp = (standingDays === null ? 0 : standingDays) + standingRoll;
    if (!unlimited && availUp + 1e-9 < delta) {
      if (block) return { ok: false, blocked: true, reason: 'no-allowance', dayCost: 0 };
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: length });
      return { ok: true, already: true, upgraded: true, overAllowance: true, dayCost: 0 };
    }
    if (unlimited) {
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: length });
      return { ok: true, already: true, upgraded: true, dayCost: 0 };
    }
    const s = splitSpend(standingDays === null ? 0 : standingDays, standingRoll, delta);
    const prevCost = Number(row.fields[F.checkins.dayCost]) || 0;
    await updateRecord(T.checkins, row.id, { [F.checkins.length]: length, [F.checkins.dayCost]: prevCost + s.covered });
    await setDayBuckets(me.id, spendFields(s));
    return { ok: true, already: true, upgraded: true, dayCost: s.covered, balance: String(s.newPlan + s.newRoll) };
  }

  const newRow = (status, dayCost, note = '') =>
    createRecord(
      T.checkins,
      {
        [F.checkins.ref]: `${name} · ${dateStr}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: dateStr,
        [F.checkins.length]: length,
        [F.checkins.notes]: note || (length === 'Half' && period ? String(period).toUpperCase() : ''),
        [F.checkins.dayCost]: dayCost,
        [F.checkins.status]: status,
        [F.checkins.source]: source,
      },
      { typecast: true },
    );

  // No plan, no live pass, no standing days → not entitled to attend at all.
  if (!unlimited && !hasPlan && !carnetLive && !hasStanding) {
    if (block) return { ok: false, blocked: true, reason: 'needs-plan-or-pass', dayCost: 0 };
    // They've PAID for room time, so never refuse — but never return WITHOUT a row either. A
    // missing Check-ins row is what the entitlement gate, the expected-today list and comms all
    // read as "not entitled to be here", so they'd be turned away at the door for a room they
    // bought. Leave a settled zero-cost marker instead.
    const over = await newRow('Planned', 0, [length === 'Half' && period ? String(period).toUpperCase() : '', 'Over allowance', SETTLED].filter(Boolean).join(' · '));
    return { ok: true, overAllowance: true, dayCost: 0, id: over?.id || null };
  }

  const today = londonNow().dateStr;
  const renewal = renewalDateISO(me);
  // Only DEFER when the member has a genuinely renewable allowance arriving next cycle. A member
  // with no managed plan (allowance undefined) has nothing coming, so deferring their booking just
  // postponed a spend that would never be funded — and let a finite pass balance act as cover in
  // EVERY future month at once. They now fall through to the current-cycle path and spend the pass
  // NOW: symmetric take/refund, and two passes buy exactly two days whenever they're booked.
  const futureCycle = typeof allowance === 'number' && !!renewal && renewal > today && dateStr >= renewal;

  if (futureCycle) {
    // Gate: the member's already-committed Planned days in D's cycle + this one must fit that
    // cycle's plan allowance, unless a carnet pass covers the overflow.
    const win = cycleWindowFor(renewal, dateStr);
    const plannedInCycle = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Planned', DATETIME_FORMAT({Date},'YYYY-MM-DD')>='${esc(win.start)}', DATETIME_FORMAT({Date},'YYYY-MM-DD')<'${esc(win.end)}')`,
    });
    const committed = plannedInCycle.reduce((a, r) => a + (r.fields[F.checkins.length] === 'Half' ? 0.5 : 1), 0);
    // A future-cycle booking must fit THAT cycle's own plan allowance. Carnet passes deliberately do
    // NOT extend it: `committed` is scoped to one cycle window but a pass balance is finite and
    // global, so counting it as cover in each window let N passes authorise N extra days in every
    // future month at once — all of which later swept into free "over allowance" days. Passes stay
    // fully usable; they're just spent NOW on current-cycle bookings rather than pledged
    // speculatively against months that haven't started.
    const planCap = allowance;
    const fits = committed + cost <= planCap + 1e-9;
    if (!fits) {
      if (block) return { ok: false, blocked: true, reason: 'no-allowance', dayCost: 0 };
      // Paid booking over the future cycle's allowance: never blocked, but leave a SETTLED marker so
      // the day-of check-in sees the date as already covered and never charges a fresh day.
      const over = await newRow('Planned', 0, [length === 'Half' && period ? String(period).toUpperCase() : '', 'Over allowance', SETTLED].filter(Boolean).join(' · '));
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
  // ensureDayForDate never books a co-working day for a weekend, so there is nothing of ours to
  // release — without this guard a weekend booking cancel would cancel (and try to refund) a
  // Planned row it never created.
  if (isWeekend(dateStr)) return { released: false, reason: 'weekend' };
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
      // Report what the refund ACTUALLY did — the settlement gate may decline to pay out on a row
      // whose debit never landed, and claiming `refunded: true` there would tell the member (and
      // the admin view) they'd been given a day back when they hadn't.
      refunded = await refundPlannedDay(me, planned);
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
export async function refundPlannedDay(me, row) {
  const notes = String(row.fields[F.checkins.notes] || '');
  if (/unlimited/i.test(notes)) return false; // nothing was ever taken
  // THE INVARIANT: pay out only against EVIDENCE of a debit that actually landed (the post-write
  // settled marker), never against the intent stamp. A row marked 'Carnet pass' whose decrement
  // never stuck took nothing, so it gets nothing back. Rows written before settlement existed are
  // deliberately treated as unsettled — under the old clobber their debit was being reverted, so
  // refunding them is precisely what minted passes.
  if (!isSettled(row)) return false;
  if (/carnet pass/i.test(notes)) {
    const carnet = me.metaData?.carnet || {};
    const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
    const total = Math.max(0, Number(carnet.total) || 0);
    // A wallet can never hold back more passes than were ever bought.
    const next = total > 0 ? Math.min(passesLeft + 1, total) : passesLeft + 1;
    await setCarnet(me, { ...carnet, remaining: next });
    return true;
  }
  const dc = Number(row.fields[F.checkins.dayCost]);
  if (Number.isFinite(dc) && dc > 0) {
    // Repay the bucket the spend actually took from. The row records the rollover share; anything
    // else came from plan days. Crediting it all to the plan bucket (as this used to) turned
    // EXPIRING rollover days into permanent ones on every book-then-cancel.
    const m = notes.match(/roll:([\d.]+)(?:@([\d-]*))?/i);
    const fromRoll = m ? Math.min(dc, Math.max(0, parseFloat(m[1]) || 0)) : 0;
    const fromPlan = Math.max(0, dc - fromRoll);
    const fields = {};
    if (fromPlan > 0) {
      const current = parseDays(me.customFields?.['days-remaining']);
      if (current !== null) fields['days-remaining'] = String(current + fromPlan);
    }
    if (fromRoll > 0) {
      fields[MS_ROLLOVER] = String(liveRollover(me, londonNow().dateStr) + fromRoll);
      // Restore the expiry the spend cleared, but NEVER extend one the member already has — a
      // later expiry would make the refund its own laundering path. Keep the earlier of the two.
      const stamped = (m && m[2]) || '';
      const cur = String(me.customFields?.[MS_ROLLOVER_EXP] || '').trim();
      const keep = cur && stamped ? (cur < stamped ? cur : stamped) : cur || stamped;
      if (keep) fields[MS_ROLLOVER_EXP] = keep;
    }
    if (Object.keys(fields).length) {
      await setDayBuckets(me.id, fields);
      return true;
    }
  }
  return false;
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
      // Live day-pass wallet, so the dashboard card can show it fresh (and a 0-plan-days member
      // with passes still sees a way in).
      carnetRemaining: Math.max(0, Number(vm.member.metaData?.carnet?.remaining) || 0),
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

    // Can they actually cover today? consumePlannedDay would otherwise let this through as a
    // zero-cost "over allowance" courtesy (which is right for an already-BOOKED day — the member
    // committed when they still had the days). A fresh walk-in is different: refuse it here, as the
    // old inline path did, so the client can offer the upgrade / buy-a-pass route instead of
    // silently handing out a free day.
    const availToday = (standingDays === null ? 0 : standingDays) + standingRoll;
    if (!unlimited && availToday + 1e-9 < cost && !carnetLiveOn(today)) {
      return json({ error: 'no-allowance' }, 400);
    }

    // A fresh walk-in goes through the SAME audited spend path as everything else: create the row,
    // then consumePlannedDay, then record arrival.
    //
    // This block used to duplicate the money logic inline, and the copy had drifted badly: it wrote
    // no 'Carnet pass' marker (so a pass spend was invisible to refunds, admin undo and
    // changeLength), its "flip an existing Planned row" branch was dead code (a Planned row for
    // today always returns earlier), it wrote the balance BEFORE the ledger row existed (breaking
    // the stamp-first rule), and it awarded points even on a zero-cost over-allowance day.
    // consumePlannedDay already gets every one of those right, so there is now one implementation.
    const rec = await createRecord(
      T.checkins,
      {
        [F.checkins.ref]: `${name} · ${today}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: today,
        [F.checkins.length]: length,
        [F.checkins.notes]: periodNote,
        [F.checkins.dayCost]: 0,
        [F.checkins.status]: 'Planned',
        [F.checkins.source]: source,
      },
      { typecast: true },
    );
    const c = await consumePlannedDay(me, { dateStr: today, length, row: rec });
    await updateRecord(T.checkins, rec.id, { [F.checkins.status]: 'Checked-in', [F.checkins.source]: source });
    return json({
      ok: true,
      balance: c.newBalance,
      dayCost: c.dayCost,
      pointsAwarded: c.pointsAwarded,
      usedCarnet: c.usedCarnet,
      carnetRemaining: c.carnetRemaining,
    });
  }

  // Change TODAY's booked / checked-in length between Half and Full. A booking already counts as
  // attendance, so this moves ONLY the day cost, by the difference — points are per-attendance and
  // never change, so they're left exactly as they are (no re-award, no claw-back). Idempotent, and
  // it refuses the one ambiguous case (an over-allowance day) rather than guess at the balance.
  if (body.action === 'changeLength') {
    const today = londonNow().dateStr;
    // Any booked day, not just today: members expect to tap a day in "Your visits" and switch it
    // between full and half. Defaults to today so the existing check-in sheet call site is unchanged.
    const target = body.date || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return json({ error: 'bad-date' }, 400);
    // A day that has already happened is history — its cost is settled and its attendance recorded.
    if (target < today) return json({ error: 'past-date' }, 400);
    const recs = await checkinsFor(email, target);
    // The attendance row for that day: a live check-in wins, else the booking.
    const row =
      recs.find((r) => r.fields[F.checkins.status] === 'Checked-in') ||
      recs.find((r) => r.fields[F.checkins.status] === 'Planned') ||
      recs.find((r) => r.fields[F.checkins.status] === 'Paid');
    if (!row) return json({ error: 'no-booking' }, 400);

    const curLen = row.fields[F.checkins.length] === 'Half' ? 'Half' : 'Full';
    const newLen = body.length === 'Half' ? 'Half' : 'Full';
    const newPeriod = newLen === 'Half' ? (String(body.period).toLowerCase() === 'pm' ? 'PM' : 'AM') : '';
    const notes = String(row.fields[F.checkins.notes] || '');
    // Preserve the machine marker (Carnet pass / Unlimited / Over allowance) while re-setting the
    // AM/PM period. Notes are stored as "[period · ]mark".
    // Notes are stored as "[AM|PM · ]rest", where `rest` carries machine tokens: the funding mark
    // (Carnet pass / Unlimited / Over allowance), the settlement marker, and on a PAID Day Pass row
    // the Stripe PaymentIntent id the webhook's duplicate guard depends on. Rebuilding from a
    // whitelist silently DROPPED everything not in it — settlement (so a genuine day stopped being
    // refundable) and the PI id (so a webhook retry could double-book). Keep everything except a
    // leading period segment, which is the only part this action owns.
    const segs = notes.split('·').map((s) => s.trim()).filter(Boolean);
    const tail = segs.filter((s, i) => !(i === 0 && /^(AM|PM)$/i.test(s)));
    const buildNotes = () => [newLen === 'Half' ? newPeriod : '', ...tail].filter(Boolean).join(' · ');

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
    // A day already PAID FOR outright (a Day Pass — £21.60 taken by Stripe) costs no plan days at
    // EITHER length, so relabel only. Its Day cost is unset, which read as 0 below and charged the
    // member half a plan day ON TOP of the pass they'd already bought.
    if (/day pass|paid/i.test(notes) || row.fields[F.checkins.status] === 'Paid') {
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: newLen, [F.checkins.notes]: buildNotes() });
      return json({ ok: true, length: newLen, dayDelta: 0 });
    }

    // Plain plan/rollover-funded day: move the balance by the difference only. Points untouched.
    const oldCost = Number(row.fields[F.checkins.dayCost]) || 0;
    const newCost = newLen === 'Half' ? 0.5 : 1;
    const delta = newCost - oldCost; // +0.5 half→full, −0.5 full→half
    // Shortening can only ever cost LESS. If the row records no spend there is nothing to move —
    // relabel and take nothing, rather than inventing a charge out of an unset Day cost.
    if (delta > 0 && oldCost === 0) {
      await updateRecord(T.checkins, row.id, { [F.checkins.length]: newLen, [F.checkins.notes]: buildNotes() });
      return json({ ok: true, length: newLen, dayDelta: 0 });
    }
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    const planNum = parseDays(me.customFields?.['days-remaining']) ?? 0;
    // Rollover liveness is judged on the day being CHANGED — a rollover day that expires before
    // then can't fund it.
    const roll = liveRollover(me, target);
    if (delta > 0 && planNum + roll + 1e-9 < delta) return json({ error: 'no-allowance' }, 400);

    // Keep the row's rollover marker HONEST across a length change — this is the crux of the bug the
    // money audit found. Both directions used to leave the original `roll:X` token untouched while
    // the day's cost changed, so a later cancel refunded against a stale split: shortening a
    // rollover-funded day credited the whole 0.5 to the permanent plan bucket, laundering an
    // expiring rollover day into a permanent one; extending under-recorded the extra rollover spent.
    // We now recompute the rollover share and re-stamp the token so refundPlannedDay always repays
    // the right buckets. `withRoll` swaps the token inside the notes buildNotes() produced.
    const rm = notes.match(/roll:([\d.]+)(?:@([\d-]*))?/i);
    const oldFromRoll = rm ? Math.min(oldCost, Math.max(0, parseFloat(rm[1]) || 0)) : 0;
    let rollExp = (rm && rm[2]) || String(me.customFields?.[MS_ROLLOVER_EXP] || '').trim();
    const withRoll = (n, fr, exp) => {
      const base = String(n).split('·').map((s) => s.trim()).filter((s) => s && !/^roll:/i.test(s)).join(' · ');
      const fr4 = Math.round(fr * 1e4) / 1e4;
      return fr4 > 1e-9 ? [base, `roll:${fr4}@${exp || ''}`].filter(Boolean).join(' · ') : base;
    };
    let newFromRoll = oldFromRoll;
    let buckets = null;
    if (delta > 0) {
      // Extend: spend the extra fraction — rollover first (it expires), then plan days.
      const s = splitSpend(planNum, roll, delta);
      newFromRoll = oldFromRoll + s.fromRoll;
      if (s.fromRoll > 0) rollExp = String(me.customFields?.[MS_ROLLOVER_EXP] || '').trim() || rollExp;
      buckets = spendFields(s);
      newBalance = String(s.newPlan + s.newRoll);
    } else if (delta < 0) {
      // Shorten: refund the fraction to the SAME buckets it came from, in proportion, so an expiring
      // rollover day is handed back as rollover (not converted to a permanent plan day).
      const ratio = oldCost > 0 ? newCost / oldCost : 0;
      newFromRoll = oldFromRoll * ratio;
      const creditRoll = oldFromRoll - newFromRoll;
      const creditPlan = -delta - creditRoll;
      const fields = {};
      const curPlan = parseDays(me.customFields?.['days-remaining']);
      if (curPlan !== null) {
        newBalance = String(Math.round((curPlan + creditPlan) * 1e4) / 1e4);
        fields['days-remaining'] = newBalance;
      }
      if (creditRoll > 1e-9) {
        fields[MS_ROLLOVER] = String(Math.round((liveRollover(me, londonNow().dateStr) + creditRoll) * 1e4) / 1e4);
        // Restore the expiry the spend cleared, never a later one (that would be its own laundering).
        const cur = String(me.customFields?.[MS_ROLLOVER_EXP] || '').trim();
        const keep = cur && rollExp ? (cur < rollExp ? cur : rollExp) : cur || rollExp;
        if (keep) {
          fields[MS_ROLLOVER_EXP] = keep;
          rollExp = keep;
        }
      }
      buckets = Object.keys(fields).length ? fields : null;
    }
    // Stamp the row (new cost + honest rollover token) FIRST, THEN move the balance — a failure
    // between the two leaves an un-charged change a re-tap no-ops, never a double-charge.
    await updateRecord(T.checkins, row.id, { [F.checkins.length]: newLen, [F.checkins.notes]: withRoll(buildNotes(), newFromRoll, rollExp), [F.checkins.dayCost]: newCost });
    if (buckets) await setDayBuckets(me.id, buckets);
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
    // Shape alone isn't enough: without a lower bound a member could book (and then cancel) any
    // date in the past, manufacturing ledger rows for days that have already happened.
    if (date < londonNow().dateStr) return json({ error: 'past-date' }, 400);
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
    // Checked-in is cancellable now too: a member who came in and realised they don't need to be can
    // undo it — the day goes back and the check-in points are reversed (below). Only Cancelled/Paid
    // rows are off-limits here.
    if (st !== 'Planned' && st !== 'Requested' && st !== 'Checked-in') return json({ error: 'only-planned-cancellable' }, 400);
    // This co-working day may be HELD by a room/pod booking on the same date (a booking books the
    // day). Refunding it here while the booking stays live would be a free room — so refuse, and
    // send them to cancel the booking instead (which releases the day). A plain reserve with no
    // booking on that date cancels normally.
    const rDate = isoToLondonDate(r.fields[F.checkins.date]);
    // A booked day counts as attendance and is spent on/for that date. Without a date bound a member
    // could cancel a day they ALREADY attended (or any past day the sweep already settled) and be
    // refunded for it — free attendance, repeatable over every past booking. Only today and future
    // days are cancellable; a past day is history.
    if (rDate < londonNow().dateStr) return json({ error: 'past-day' }, 400);
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
    const wasAttended = st === 'Checked-in';
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: 'Cancelled' });
    let refunded = false;
    if (wasConsumed) {
      try {
        // Report what actually happened: the settlement gate declines to pay out on a row whose
        // debit never landed, and telling the member "credited back" when nothing moved is how a
        // balance discrepancy becomes invisible.
        refunded = await refundPlannedDay(me, r);
      } catch (e) {
        console.error('[checkin] refund-after-cancel failed', body.id, e);
      }
    }
    // A cancelled check-in also gives back its check-in bonus — the visit didn't happen, so the
    // points for it shouldn't stand (and a check-in/cancel loop mustn't farm points). Refund the day
    // FIRST (customFields/carnet) then reverse points (metaData.points): different Memberstack keys,
    // so no clobber. Only for a genuine attendance row — a plain reserved day earned no bonus.
    let pointsReversed = 0;
    if (wasAttended) {
      try {
        pointsReversed = await reverseCheckinPoints(me, email, rDate);
      } catch (e) {
        console.error('[checkin] points-reversal-after-cancel failed', body.id, e);
      }
    }
    return json({ ok: true, refunded, pointsReversed });
  }

  return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: 'server' }, 500);
  }
}
