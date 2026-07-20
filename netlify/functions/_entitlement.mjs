/**
 * The Quarter — who may book what, and for how long.
 *
 * WHY THIS EXISTS. There were two booking backends and only one of them checked anything.
 * room-booking.mjs (the public/marketing path) enforced a plan check and a monthly free-hours
 * cap; bookings.mjs (the member dashboard's Book tab — the door members actually use every
 * day) enforced nothing at all beyond "you hold a valid token". A day-pass visitor with no
 * plan booked two meeting rooms for a day he had not bought, and a plan member could exceed
 * their monthly cap indefinitely simply by booking from the dashboard instead.
 *
 * So the rules live here, once, and both doors call them. Anything that decides entitlement
 * belongs in this file — if a third booking path ever appears it should import from here
 * rather than growing its own copy, which is exactly how the first hole opened.
 */

import { listRecords, T, F, esc } from './_airtable.mjs';
import { isoToLondonMin } from './_time.mjs';

/**
 * Free meeting-room hours per calendar month, by plan.
 *
 * COMMERCIAL SETTING — change these numbers here and nowhere else. They are deliberately
 * conservative: an allowance is far easier to increase than to claw back, and at list rates
 * (~£18–30/room-hour) generous free hours can exceed the plan's own price.
 *
 * Mirrors PLAN_ROOM_HOURS in lib/plans.ts, which drives the public plan pages. Netlify
 * functions are plain .mjs and cannot import the TypeScript module, so the two must be kept
 * in step by hand — hence a single obvious constant in each, rather than the numbers being
 * scattered through the logic.
 */
export const PLAN_ROOM_HOURS = {
  'day-pass': 0,
  'hybrid-office': 0,
  visitor: 2,
  resident: 4,
  citizen: 8,
};

/**
 * Memberstack plan id → the plan slug PLAN_ROOM_HOURS is keyed on.
 *
 * Deliberately NOT reusing PLAN_TIER from _quarter-sync.mjs. That map exists for the rewards
 * earn rate and folds Hybrid Office into 'resident' and Day Pass into 'visitor' — correct for
 * points, wrong here: borrowing it would hand Hybrid four free room-hours it isn't sold.
 */
const PLAN_ID_TO_SLUG = {
  'pln_citizen-plan-q9oa04p9': 'citizen',
  'pln_resident-plan-mqjy0f6w': 'resident',
  'pln_visitor-plan-blk50re2': 'visitor',
  'pln_hybrid-plan-r4k60rjp': 'hybrid-office',
  'pln_daily-plan-45nv0v26': 'day-pass',
};

const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

/** The member's plan slug, or null. Prefers an active connection over a lapsed one. */
export function planSlugForMember(member) {
  const conns = member?.planConnections || [];
  const active = conns.find((c) => c?.active || c?.status === 'ACTIVE') || conns[0];
  return PLAN_ID_TO_SLUG[planIdOf(active)] ?? null;
}

/** Anyone on a plan we don't recognise gets the old default rather than zero — failing
 *  closed here would lock out a member because of a naming mismatch, which is worse. */
const FALLBACK_ROOM_HOURS = 4;

/** A pod is for a call, not a desk. Two hours in one booking, so nobody holds one all day. */
export const POD_MAX_HOURS = 2;

const norm = (s) => String(s || '').trim().toLowerCase();
export const isPodSpace = (spaceRec) => /pod/.test(norm(spaceRec?.fields?.[F.spaces.type] || ''));

/** Mirrors the dashboard's own signal: a plan connection is what makes someone a member. */
export const hasPlan = (m) => (m?.planConnections?.length ?? 0) > 0;

/**
 * The member's monthly meeting-room hour allowance.
 * A per-member override on Memberstack metaData wins, so the team can grant hours to anyone
 * (a company deal, an apology, a trial) without a code change.
 */
export function roomHoursCap(member, planSlug) {
  const override = Number(member?.metaData?.meetingRoomHoursCap);
  if (Number.isFinite(override) && override >= 0) return override;
  if (!hasPlan(member)) return 0;
  const byPlan = PLAN_ROOM_HOURS[planSlug];
  return Number.isFinite(byPlan) ? byPlan : FALLBACK_ROOM_HOURS;
}

/** Hours already booked in MEETING ROOMS (pods excluded) this calendar month. */
export async function monthlyMeetingRoomHours(email, dateStr, excludeBookingId = null) {
  const ym = dateStr.slice(0, 7);
  const spaces = await listRecords(T.spaces, {});
  const meetingIds = new Set(spaces.filter((r) => !isPodSpace(r)).map((r) => r.id));
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(LOWER({Member email})='${esc(norm(email))}', {Status}='Confirmed', DATETIME_FORMAT({Date}, 'YYYY-MM')='${esc(ym)}')`,
  });
  let hours = 0;
  for (const r of recs) {
    // When amending, the booking being moved must not count against the member twice.
    if (excludeBookingId && r.id === excludeBookingId) continue;
    const sp = r.fields[F.bookings.space];
    if (!Array.isArray(sp) || !sp.length || !meetingIds.has(sp[0])) continue;
    // Only FREE member bookings consume the allowance — a paid booking is recorded as
    // 'Company' and must not eat the free hours the member has also paid for.
    if (r.fields[F.bookings.kind] !== 'Member') continue;
    const s = isoToLondonMin(r.fields[F.bookings.start]);
    const e = isoToLondonMin(r.fields[F.bookings.end]);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) hours += (e - s) / 60;
  }
  return hours;
}

/**
 * Does this person have any right to be in the building on this date?
 *
 * A plan holder does: their days are managed separately, and requiring them to reserve the
 * day before booking a room would be friction with no safety gain. Someone with NO plan is a
 * day-pass buyer, and their access is exactly the dates they have paid for — one Check-ins
 * row per date, Status 'Paid' (written by the Stripe webhook). That is the join the booking
 * path never made, which is how a room got booked for a day nobody had bought.
 */
export async function hasAccessOn(member, email, dateStr) {
  if (hasPlan(member)) return true;
  const rows = await listRecords(T.checkins, {
    filterByFormula: `AND(LOWER({Member email})='${esc(norm(email))}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}')`,
  });
  return rows.some((r) => ['Paid', 'Planned', 'Checked-in'].includes(String(r.fields[F.checkins.status] || '')));
}

/**
 * The single decision both booking paths ask. Returns { ok: true } or { ok: false, error, ... }
 * with an error code the client can turn into a sentence.
 *
 * Deliberately ordered cheapest-check-first, so the common refusals cost no Airtable reads.
 */
export async function canBook({ member, email, spaceRec, dateStr, startMin, endMin, excludeBookingId = null }) {
  const planSlug = planSlugForMember(member);
  const hours = (endMin - startMin) / 60;
  if (!(hours > 0)) return { ok: false, error: 'bad-slot' };

  const pod = isPodSpace(spaceRec);

  if (pod && hours > POD_MAX_HOURS + 1e-6) {
    return { ok: false, error: 'pod-too-long', maxHours: POD_MAX_HOURS };
  }

  // Meeting rooms belong to plans. A day-pass visitor gets the pods, which is what they're
  // usually after anyway — somewhere private for a call.
  if (!pod && !hasPlan(member)) {
    return { ok: false, error: 'rooms-need-plan' };
  }

  if (!(await hasAccessOn(member, email, dateStr))) {
    return { ok: false, error: 'no-access-that-day' };
  }

  if (!pod) {
    const cap = roomHoursCap(member, planSlug);
    if (cap <= 0) return { ok: false, error: 'rooms-need-plan' };
    const used = await monthlyMeetingRoomHours(email, dateStr, excludeBookingId);
    if (used + hours > cap + 1e-6) {
      return {
        ok: false,
        error: 'cap-exceeded',
        capHours: cap,
        usedHours: Math.round(used * 100) / 100,
        remaining: Math.round(Math.max(0, cap - used) * 100) / 100,
      };
    }
  }

  return { ok: true };
}
