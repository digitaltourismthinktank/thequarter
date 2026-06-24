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

/** Format a unix-seconds timestamp as DD/MM/YYYY (UTC), or '' if absent. */
export function formatDate(unixSeconds) {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Day allowance for a member from their Memberstack plan(s); null = unlimited. */
export function allowanceForMember(member) {
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
export async function renewMember(secret, email, { renewalDate, resetDays = true, lapse = false } = {}) {
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
  } else if (resetDays) {
    const allowance = allowanceForMember(member);
    if (allowance !== undefined) {
      fields['days-remaining'] = nextBalance(member?.customFields?.['days-remaining'], allowance);
    }
  }

  if (Object.keys(fields).length === 0) return { ok: true, memberId: member.id, fields: {} };
  await admin.members.update({ id: member.id, data: { customFields: fields } });
  return { ok: true, memberId: member.id, fields };
}
