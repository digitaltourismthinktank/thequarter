/**
 * The Quarter — shared Stripe→Memberstack sync logic.
 *
 * Imported by both stripe-webhook.mjs (real renewals) and sim-renewal.mjs (the
 * admin test endpoint) so the day-reset + rollover rule lives in ONE place and
 * can never drift between them. The leading underscore tells Netlify this is a
 * helper module, not a deployable function endpoint.
 */
import memberstackAdmin from '@memberstack/admin';

/** Day allowance per Memberstack plan id (null = unlimited). */
export const PLAN_ALLOWANCE = {
  'pln_citizen-plan-q9oa04p9': null, // Citizen — unlimited
  'pln_resident-plan-mqjy0f6w': 10, // Resident — 10/month
  'pln_visitor-plan-blk50re2': 5, // Visitor — 5/month
  'pln_hybrid-plan-r4k60rjp': 12, // Hybrid Office — 12/year
  'pln_daily-plan-45nv0v26': 1, // Day Pass — one-off (no recurring renewal)
};

/** Memberstack plan id → display name (admin views + dashboards). */
export const PLAN_NAMES = {
  'pln_citizen-plan-q9oa04p9': 'Citizen',
  'pln_resident-plan-mqjy0f6w': 'Resident',
  'pln_visitor-plan-blk50re2': 'Visitor',
  'pln_hybrid-plan-r4k60rjp': 'Hybrid Office',
  'pln_daily-plan-45nv0v26': 'Day Pass',
  'pln_paused-fns0m38': 'Paused',
};

/**
 * Quarter Rewards earn-tier per plan. The higher a member's commitment, the faster
 * they earn (see EARN_MULTIPLIER in _rewards.mjs). Hybrid earns at Resident level;
 * the one-off Day Pass earns at the base (Visitor) level.
 */
export const PLAN_TIER = {
  'pln_citizen-plan-q9oa04p9': 'citizen',
  'pln_resident-plan-mqjy0f6w': 'resident',
  'pln_visitor-plan-blk50re2': 'visitor',
  'pln_hybrid-plan-r4k60rjp': 'resident',
  'pln_daily-plan-45nv0v26': 'visitor',
};

const TIER_RANK = { visitor: 1, resident: 2, citizen: 3 };

/** A member's earn tier from their Memberstack plan(s) — the highest tier wins. */
export function tierForMember(member) {
  let best = 'visitor';
  for (const c of member?.planConnections || []) {
    const t = PLAN_TIER[c.planId];
    if (t && (TIER_RANK[t] || 0) > (TIER_RANK[best] || 0)) best = t;
  }
  return best;
}

/** The dedicated "Paused" Memberstack plan + the Stripe £0 "Pause my Plan" price. */
export const PAUSED_PLAN_ID = 'pln_paused-fns0m38';
export const PAUSE_PRICE_ID = 'price_0PoNQ6w5GSGOu4zJbBJkYlBT';

/**
 * Stripe price id → Memberstack plan id. Lets the webhook re-tag a member when
 * they switch plan in the Stripe portal.
 */
export const PRICE_TO_PLAN = {
  'price_0PgS1pw5GSGOu4zJQpVlN6Gm': 'pln_citizen-plan-q9oa04p9', // Citizen
  'price_0PgRphw5GSGOu4zJ0dnCFwjp': 'pln_resident-plan-mqjy0f6w', // Resident
  'price_0PgRo1w5GSGOu4zJdycNlCpy': 'pln_visitor-plan-blk50re2', // Visitor
  'price_0OtrBRw5GSGOu4zJC3vsROvC': 'pln_hybrid-plan-r4k60rjp', // Hybrid Office
  'price_0PgRmsw5GSGOu4zJxWrmYHWg': 'pln_daily-plan-45nv0v26', // Day Pass (one-off)
  'price_0Tn4MXw5GSGOu4zJLe6oAQEu': 'pln_citizen-plan-q9oa04p9', // Citizen (annual) → same plan tag
  'price_0Tn4Nmw5GSGOu4zJwV8L1Imz': 'pln_resident-plan-mqjy0f6w', // Resident (annual) → same plan tag
  'price_0Tn4ucw5GSGOu4zJ7UqWhlO8': 'pln_visitor-plan-blk50re2', // Visitor (annual) → same plan tag
};

/** Every Memberstack plan we manage — we only swap among these, never touching others. */
const MANAGED_PLANS = new Set([...Object.values(PRICE_TO_PLAN), PAUSED_PLAN_ID]);

/** The Memberstack plan a Stripe subscription should map to (the £0 pause price = paused). */
export function targetPlanForPrice(priceId, amount) {
  if (priceId === PAUSE_PRICE_ID || amount === 0) return PAUSED_PLAN_ID;
  return PRICE_TO_PLAN[priceId];
}

/** Format a unix-seconds timestamp as DD/MM/YYYY (UTC), or '' if absent. */
export function formatDate(unixSeconds) {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/**
 * Day allowance for a member; null = unlimited.
 *
 * Per-member override FIRST: a manually-managed member can carry customFields
 * ['allowance-override'] — a numeric string set by the admin. When present and it
 * parses to a finite number ≥ 0, it wins outright over the plan default (so e.g. a
 * Resident on a bespoke deal can be given 20 days/month without changing their plan).
 * The override is numeric only — "unlimited" stays plan-driven (leave the override
 * blank and put the member on the Citizen plan for unlimited). Because renewMember's
 * flat/rollover reset and daysUsedThisCycle both call this, the override automatically
 * flows through the dashboard display, usage maths AND every renewal reset.
 */
export function allowanceForMember(member) {
  const ov = member?.customFields?.['allowance-override'];
  if (ov !== undefined && ov !== null && String(ov).trim() !== '') {
    const n = Number(ov);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  let found;
  for (const c of member?.planConnections || []) {
    if (c.planId in PLAN_ALLOWANCE) {
      const a = PLAN_ALLOWANCE[c.planId];
      if (a === null) return null; // unlimited wins
      if (found === undefined) found = a;
    }
  }
  return found;
}

/** Days used so far this cycle = allowance − remaining (0 if unlimited/unknown). */
export function daysUsedThisCycle(member) {
  const allowance = allowanceForMember(member);
  if (allowance === null || allowance === undefined) return 0;
  const raw = member?.customFields?.['days-remaining'];
  const remaining = String(raw).toLowerCase() === 'unlimited' ? 0 : Math.max(0, parseFloat(String(raw)) || 0);
  return Math.max(0, allowance - remaining);
}

/**
 * The new day balance at a renewal, given the previous balance + allowance.
 * Rollover rule: a fresh allowance PLUS at most one month's unused days, with
 * the total hard-capped at 2x the allowance — so days can never accumulate
 * beyond two months' worth. Pure function (easy to reason about / test).
 */
export function nextBalance(prevRaw, allowance) {
  if (allowance === null) return 'Unlimited';
  const prev = String(prevRaw).toLowerCase() === 'unlimited' ? 0 : Math.max(0, parseInt(String(prevRaw), 10) || 0);
  const carried = Math.min(prev, allowance);
  return String(Math.min(allowance + carried, allowance * 2));
}

/**
 * Renew a member in Memberstack: set the renewal date and (unless resetDays is
 * false) reset the day balance with rollover. lapse zeroes the balance.
 * Returns a small status object; never throws on a missing member.
 */
export async function renewMember(secret, email, { renewalDate, resetDays = true, lapse = false, flat = false, explicitDays } = {}) {
  if (!secret || !email) return { ok: false, reason: 'missing-args' };
  const admin = memberstackAdmin.init(secret);

  let member;
  try {
    const r = await admin.members.retrieve({ email });
    member = r?.data;
  } catch {
    return { ok: false, reason: 'lookup-failed' };
  }
  if (!member) return { ok: false, reason: 'not-found' };

  const fields = {};
  if (renewalDate !== undefined) fields['renewal-date'] = renewalDate;

  if (lapse) {
    fields['days-remaining'] = '0';
  } else if (explicitDays !== undefined && explicitDays !== null) {
    fields['days-remaining'] = explicitDays;
  } else if (resetDays) {
    const allowance = allowanceForMember(member);
    if (allowance !== undefined) {
      // flat = set to the plan's base allowance (used on a plan switch);
      // otherwise apply the 1-month rollover (used on a genuine renewal).
      fields['days-remaining'] = flat
        ? allowance === null
          ? 'Unlimited'
          : String(allowance)
        : nextBalance(member?.customFields?.['days-remaining'], allowance);
    }
  }

  if (Object.keys(fields).length === 0) return { ok: true, memberId: member.id, fields: {} };
  await admin.members.update({ id: member.id, data: { customFields: fields } });
  return { ok: true, memberId: member.id, fields };
}

/**
 * Ensure the member holds exactly `targetPlanId` among the plans we manage:
 * add it if missing, and remove any other managed plan (so a switch/pause leaves
 * one clean tag). Untouched: any plan we don't manage. Days are left alone here
 * (a switch resets them on the next invoice.paid; a pause freezes them).
 */
export async function setMemberPlan(secret, email, targetPlanId) {
  if (!secret || !email || !targetPlanId) return { ok: false, reason: 'missing-args' };
  const admin = memberstackAdmin.init(secret);

  let member;
  try {
    const r = await admin.members.retrieve({ email });
    member = r?.data;
  } catch {
    return { ok: false, reason: 'lookup-failed' };
  }
  if (!member) return { ok: false, reason: 'not-found' };

  // Admin SDK may return each connection as a plain id string OR an object — handle both.
  const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);
  const current = (member.planConnections || []).map(planIdOf).filter(Boolean);
  const added = [];
  const removed = [];

  if (!current.includes(targetPlanId)) {
    await admin.members.addFreePlan({ id: member.id, data: { planId: targetPlanId } });
    added.push(targetPlanId);
  }
  for (const planId of current) {
    if (planId !== targetPlanId && MANAGED_PLANS.has(planId)) {
      await admin.members.removeFreePlan({ id: member.id, data: { planId } });
      removed.push(planId);
    }
  }
  return { ok: true, memberId: member.id, targetPlanId, added, removed };
}

/** Read the member + the last-applied event time/id (for the stale-event guard). */
export async function getMemberSync(secret, email) {
  if (!secret || !email) return { member: null };
  const admin = memberstackAdmin.init(secret);
  try {
    const r = await admin.members.retrieve({ email });
    const m = r?.data;
    if (!m) return { member: null };
    const md = m.metaData || {};
    return { member: m, lastSyncAt: Number(md.lastSyncAt) || 0, lastEventId: md.lastEventId || null, metaData: md };
  } catch {
    return { member: null };
  }
}

/** Record the last-applied event time + id on the member (merged into metaData). */
export async function stampSync(secret, memberId, metaData, eventCreated, eventId) {
  const admin = memberstackAdmin.init(secret);
  try {
    await admin.members.update({
      id: memberId,
      data: { metaData: { ...(metaData || {}), lastSyncAt: eventCreated, lastEventId: eventId } },
    });
  } catch {
    /* ignore */
  }
}

/** Read-only: a member's plan tags + custom fields (admin view) for debugging. */
export async function inspectMember(secret, email) {
  if (!secret || !email) return { ok: false, reason: 'missing-args' };
  const admin = memberstackAdmin.init(secret);
  try {
    const r = await admin.members.retrieve({ email });
    const m = r?.data;
    if (!m) return { ok: false, reason: 'not-found' };
    return { ok: true, id: m.id, planConnections: m.planConnections, customFields: m.customFields, metaData: m.metaData || {} };
  } catch (e) {
    return { ok: false, reason: 'lookup-failed', detail: String(e?.message || e) };
  }
}
