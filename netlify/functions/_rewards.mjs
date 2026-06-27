/**
 * The Quarter — Quarter Rewards server logic (economy + Airtable stores).
 *
 * The earn values below MIRROR lib/rewards.ts — keep the two in sync (same pattern as
 * PLAN_ALLOWANCE in _quarter-sync.mjs mirroring lib/plans.ts). Catalogue, perks,
 * floats, ledger and the member balance all live here so every function (rewards /
 * perks / verify / checkin / stripe-webhook) shares one implementation.
 *
 * Member points balance is stored on Memberstack metaData.points for fast reads; the
 * Airtable Points-ledger is the append-only audit trail (and powers the earn caps).
 */
import memberstackAdmin from '@memberstack/admin';
import { listRecords, createRecord, updateRecord, T, F, esc } from './_airtable.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;

// --- Economy (mirror of lib/rewards.ts — keep in sync) --------------------------
export const POINTS_PER_POUND_VALUE = 100; // 100 points = £1 of reward value
export const POINTS_PER_GBP = 2; // 2% give-back on real paid transactions
export const CHECKIN_BONUS = 15;
export const CHECKIN_QUIET_BONUS = 30;
export const CHECKIN_BONUS_CAP = 12; // counted check-ins per calendar month
export const REFERRAL_BONUS = 500;
export const WELCOME_BONUS = 150;

/** Carnet purchase: Stripe checkout amount (pence) → passes. Provisional — mirrors
 *  lib/rewards CARNET_BUNDLES (10 @ £194.40, 30 @ £550.80). Confirm + wire real Stripe
 *  products with Riva; update these amounts if the prices change. */
export const CARNET_AMOUNT_TO_PASSES = { 19440: 10, 55080: 30 };

export const pointsForGBP = (gbp) => Math.round(POINTS_PER_GBP * Math.max(0, Number(gbp) || 0));
export const poundsValue = (points) => Math.max(0, Number(points) || 0) / POINTS_PER_POUND_VALUE;

// --- Member points balance ------------------------------------------------------

export function memberPoints(m) {
  return Math.max(0, Math.round(Number(m?.metaData?.points) || 0));
}

/**
 * Append a ledger row and move the member's running balance by `delta`.
 * `reason` must be one of the Points-ledger Reason options. Returns the new balance.
 */
/** Append a points-ledger row only (no member write). Use when the caller owns the
 *  member's metaData write — e.g. the Stripe webhook folds points into its stampSync. */
export async function appendLedger(email, delta, reason, ref = '') {
  const d = Math.round(Number(delta) || 0);
  if (!email || !d) return;
  await createRecord(T.pointsLedger, {
    [F.pointsLedger.entry]: `${reason}-${Date.now()}`,
    [F.pointsLedger.email]: email,
    [F.pointsLedger.delta]: d,
    [F.pointsLedger.reason]: reason,
    [F.pointsLedger.ref]: ref,
    [F.pointsLedger.at]: new Date().toISOString(),
  });
}

export async function awardPoints(member, delta, reason, ref = '') {
  const d = Math.round(Number(delta) || 0);
  if (!member || !d) return memberPoints(member);
  const email = member.auth?.email || member.email || '';
  await appendLedger(email, d, reason, ref);
  const next = Math.max(0, memberPoints(member) + d);
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: member.id, data: { metaData: { ...(member.metaData || {}), points: next } } });
  return next;
}

/** Count this member's check-in bonus rows in a given London YYYY-MM (for the cap). */
export async function checkinBonusesThisMonth(email, yyyymm) {
  const rows = await listRecords(T.pointsLedger, {
    filterByFormula: `AND({Member email}='${esc(email)}', OR({Reason}='checkin', {Reason}='checkin-quiet'), DATETIME_FORMAT({At}, 'YYYY-MM')='${esc(yyyymm)}')`,
  });
  return rows.length;
}

/** A member's recent ledger rows (for the redemption/earn history). */
export async function memberLedger(email, max = 30) {
  const rows = await listRecords(T.pointsLedger, {
    filterByFormula: `{Member email}='${esc(email)}'`,
    sort: [{ field: 'At', direction: 'desc' }],
    maxRecords: max,
  });
  return rows.map((r) => ({
    id: r.id,
    delta: Number(r.fields[F.pointsLedger.delta]) || 0,
    reason: r.fields[F.pointsLedger.reason] || '',
    ref: r.fields[F.pointsLedger.ref] || '',
    at: r.fields[F.pointsLedger.at] || null,
  }));
}

// --- Catalogue / perks / floats -------------------------------------------------

function rewardFromRow(r) {
  const f = r.fields;
  return {
    id: r.id,
    partner: f[F.rewards.partner] || '',
    title: f[F.rewards.title] || '',
    cost: Number(f[F.rewards.cost]) || 0,
    funding: f[F.rewards.funding] || 'inventory',
    category: f[F.rewards.category] || '',
    icon: f[F.rewards.icon] || 'gift',
    pos: f[F.rewards.pos] || '',
    hero: !!f[F.rewards.hero],
    status: f[F.rewards.status] || 'draft',
    image: f[F.rewards.image] || null,
  };
}

export async function listRewards({ liveOnly = true } = {}) {
  const rows = await listRecords(T.rewards, { sort: [{ field: 'Order' }] });
  const all = rows.map(rewardFromRow);
  return liveOnly ? all.filter((r) => r.status === 'live') : all;
}

function perkFromRow(r) {
  const f = r.fields;
  return {
    id: r.id,
    partner: f[F.perks.partner] || '',
    offer: f[F.perks.offer] || '',
    category: f[F.perks.browseCategory] || '',
    type: f[F.perks.perkType] || '',
    days: f[F.perks.days] || '',
    pos: f[F.perks.pos] || '',
    authorisedBy: f[F.perks.authorisedBy] || '',
    ref: f[F.perks.ref] || '',
    contact: f[F.perks.contact] || '',
    icon: f[F.perks.icon] || 'gift',
    image: f[F.perks.image] || null,
    status: f[F.perks.status] || 'draft',
  };
}

export async function listPerks({ liveOnly = true } = {}) {
  const rows = await listRecords(T.perks, { sort: [{ field: 'Order' }] });
  const all = rows.map(perkFromRow);
  return liveOnly ? all.filter((p) => p.status === 'live') : all;
}

export async function getPerk(id) {
  const rows = await listRecords(T.perks, { filterByFormula: `RECORD_ID()='${esc(id)}'`, maxRecords: 1 });
  return rows[0] ? perkFromRow(rows[0]) : null;
}

function floatFromRow(r) {
  const f = r.fields;
  const balance = Number(f[F.partners.balance]) || 0;
  const total = Number(f[F.partners.floatTotal]) || 0;
  return {
    id: r.id,
    partner: f[F.partners.partner] || '',
    reward: f[F.partners.reward] || '',
    balance,
    floatTotal: total,
    usesThisMonth: Number(f[F.partners.usesThisMonth]) || 0,
    lastUsed: f[F.partners.lastUsed] || null,
    status: f[F.partners.status] || floatStatus(balance, total),
  };
}

export function floatStatus(balance, total) {
  if (balance <= 0) return 'Spent';
  if (total > 0 && balance < total * 0.2) return 'Running low';
  return 'Healthy';
}

export async function listFloats() {
  const rows = await listRecords(T.partners);
  return rows.map(floatFromRow);
}

/** A reward is "back soon" when it's funded (partner/quarter) and its float is spent. */
export function rewardAvailability(reward, floats) {
  if (reward.funding === 'inventory') return 'ok';
  const fl = floats.find((x) => x.partner === reward.partner);
  if (!fl) return 'ok'; // no float tracked → treat as available
  return fl.balance > 0 ? 'ok' : 'soon';
}

/** Draw a funded reward/perk's real £ cost from its partner float (called on scan). */
export async function drawFloat(partner, gbp) {
  if (!partner || !(gbp > 0)) return;
  const rows = await listRecords(T.partners, { filterByFormula: `{Partner}='${esc(partner)}'`, maxRecords: 1 });
  const r = rows[0];
  if (!r) return;
  const f = floatFromRow(r);
  const balance = Math.max(0, f.balance - gbp);
  await updateRecord(T.partners, r.id, {
    [F.partners.balance]: balance,
    [F.partners.usesThisMonth]: f.usesThisMonth + 1,
    [F.partners.lastUsed]: new Date().toISOString().slice(0, 10),
    [F.partners.status]: floatStatus(balance, f.floatTotal),
  });
}

// --- Redeem a reward (deduct points + log; the voucher token is minted by caller) -

export async function redeemReward(member, rewardId) {
  const email = member.auth?.email || member.email || '';
  const [rewards, floats] = await Promise.all([listRewards({ liveOnly: false }), listFloats()]);
  const reward = rewards.find((r) => r.id === rewardId);
  if (!reward) return { ok: false, reason: 'not-found' };
  if (reward.status !== 'live') return { ok: false, reason: 'unavailable' };
  if (rewardAvailability(reward, floats) === 'soon') return { ok: false, reason: 'back-soon' };
  if (memberPoints(member) < reward.cost) return { ok: false, reason: 'insufficient' };

  const balance = await awardPoints(member, -reward.cost, 'redeem', reward.id);
  await createRecord(T.redemptions, {
    [F.redemptions.entry]: `${reward.title} · ${email}`,
    [F.redemptions.email]: email,
    [F.redemptions.reward]: reward.title,
    [F.redemptions.rewardId]: reward.id,
    [F.redemptions.partner]: reward.partner,
    [F.redemptions.cost]: reward.cost,
    [F.redemptions.status]: 'redeemed',
    [F.redemptions.at]: new Date().toISOString(),
  });
  return { ok: true, balance, reward };
}

/**
 * On a referred friend's first paid plan: flip their pending referral to "joined" and
 * credit the referrer REFERRAL_BONUS. Safe to call on every first invoice (no-op if the
 * friend wasn't referred or was already credited). Credits a DIFFERENT member than the
 * one being synced, so it won't collide with the webhook's friend metaData write.
 */
export async function creditReferral(friendEmail) {
  if (!friendEmail) return { credited: false };
  const rows = await listRecords(T.referrals, {
    filterByFormula: `AND({Friend email}='${esc(friendEmail)}', {Status}='pending')`,
    maxRecords: 1,
  });
  const row = rows[0];
  if (!row) return { credited: false };
  await updateRecord(T.referrals, row.id, { [F.referrals.status]: 'joined' });
  const referrerId = row.fields[F.referrals.referrerId];
  if (!referrerId) return { credited: false };
  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: referrerId });
    const referrer = r?.data;
    if (referrer) {
      await awardPoints(referrer, REFERRAL_BONUS, 'referral', friendEmail);
      return { credited: true, referrerId };
    }
  } catch {
    /* ignore */
  }
  return { credited: false };
}

/** A member's redemptions (most recent first). */
export async function memberRedemptions(email, max = 20) {
  const rows = await listRecords(T.redemptions, {
    filterByFormula: `{Member email}='${esc(email)}'`,
    sort: [{ field: 'At', direction: 'desc' }],
    maxRecords: max,
  });
  return rows.map((r) => ({
    id: r.id,
    reward: r.fields[F.redemptions.reward] || '',
    rewardId: r.fields[F.redemptions.rewardId] || '',
    partner: r.fields[F.redemptions.partner] || '',
    cost: Number(r.fields[F.redemptions.cost]) || 0,
    status: r.fields[F.redemptions.status] || 'redeemed',
    at: r.fields[F.redemptions.at] || null,
  }));
}
