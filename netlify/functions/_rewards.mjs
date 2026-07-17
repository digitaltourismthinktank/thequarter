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
import { sendEmail, emailShell, escapeHtml, notifyAdmins } from './_email.mjs';
import { partnerToken } from './_partner.mjs';
import { pushToEmail } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
// Server equivalent of lib/site.ts SITE.url — same env + same default, so links in
// partner emails point at the real domain and never hardcode it here.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.work').replace(/\/$/, '');

// --- Economy (mirror of lib/rewards.ts — keep in sync) --------------------------
export const POINTS_PER_POUND_VALUE = 100; // 100 points = £1 of reward value
export const POINTS_PER_GBP = 1; // 1% spend give-back on real paid transactions
export const CHECKIN_BONUS = 10; // base per check-in (× the member's level)
export const CHECKIN_QUIET_BONUS = 20; // base per check-in on a busyness 'quiet' day
export const CHECKIN_BONUS_CAP = 12; // counted check-ins per calendar month
export const REFERRAL_BONUS = 500;
export const WELCOME_BONUS = 150;

/**
 * Levels — earned status tiers (mirror of lib/rewards.ts LEVELS). Everyone climbs
 * the same ladder by EARNING points over time (not by plan). Higher tiers give a
 * small, capped check-in earn boost (perks-led), so the most-active members can't
 * run the give-back away. Thresholds are on lifetime points (spending never demotes).
 */
export const LEVEL_TIERS = [
  { min: 0, boost: 1 }, // Newbie
  { min: 750, boost: 1.15 }, // Regular
  { min: 2500, boost: 1.3 }, // Family
  { min: 6000, boost: 1.5 }, // Ambassador
];
// Display names aligned 1:1 with LEVEL_TIERS (for the level-up push copy).
export const LEVEL_NAMES = ['Newbie', 'Regular', 'Family', 'Ambassador'];
export function levelBoost(lifetime) {
  let b = 1;
  const n = Number(lifetime) || 0;
  for (const l of LEVEL_TIERS) if (n >= l.min) b = l.boost;
  return b;
}
/** Index of the highest LEVEL_TIERS band a lifetime total has reached (0-based). */
export function levelIndex(lifetime) {
  const n = Number(lifetime) || 0;
  let idx = 0;
  for (let i = 0; i < LEVEL_TIERS.length; i++) if (n >= LEVEL_TIERS[i].min) idx = i;
  return idx;
}
/** Lifetime points earned. Back-fills from the current balance for members from
 *  before lifetime tracking, so nobody is demoted to Newcomer on rollout. */
export function memberLifetimePoints(m) {
  const life = Number(m?.metaData?.lifetimePoints);
  return Number.isFinite(life) && life >= 0 ? Math.round(life) : memberPoints(m);
}
export const earnBoostForMember = (m) => levelBoost(memberLifetimePoints(m));

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
  // Lifetime only ever grows (earning), so redemptions don't demote a member's level.
  const oldLife = memberLifetimePoints(member);
  const life = oldLife + (d > 0 ? d : 0);
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: member.id, data: { metaData: { ...(member.metaData || {}), points: next, lifetimePoints: life } } });
  // Level-up push (best-effort). Only on a genuine earn (d>0) that crosses a tier boundary.
  // Guarded end-to-end so the index math + push can never change awardPoints' return or throw.
  if (d > 0 && email) {
    try {
      const oldIdx = levelIndex(oldLife);
      const newIdx = levelIndex(life);
      if (newIdx > oldIdx) {
        await pushToEmail(email, { title: 'You reached a new level', body: `You're now ${LEVEL_NAMES[newIdx]} at The Quarter.`, url: '/rewards/' });
      }
    } catch {
      /* level-up push is best-effort — never affect the award */
    }
  }
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

// --- Partner payouts (arrears — what we owe each partner) -----------------------
// PAYOUT MODEL (no pre-purchase): every PARTNER-FUNDED redemption (funding 'partner'
// or 'quarter') creates a payable we settle on a monthly/quarterly basis — only our
// OWN 'inventory' rewards cost a partner nothing. Each redemption's £ value is the
// anchor value of its points cost. "Owed" = unsettled partner-funded redemptions;
// marking a partner paid flips theirs to 'settled'. A month filter is for view/export.

export async function partnerPayouts({ month } = {}) {
  const [rewards, rows] = await Promise.all([
    listRewards({ liveOnly: false }),
    listRecords(T.redemptions, { sort: [{ field: 'At', direction: 'desc' }] }),
  ]);
  const fundingById = new Map(rewards.map((r) => [r.id, r.funding]));
  const byPartner = new Map();
  for (const r of rows) {
    const f = r.fields;
    const rewardId = f[F.redemptions.rewardId] || '';
    if ((fundingById.get(rewardId) || 'inventory') === 'inventory') continue; // our stock — not a payable
    const at = f[F.redemptions.at] || null;
    const ym = at ? String(at).slice(0, 7) : '';
    if (month && ym !== month) continue;
    const partner = f[F.redemptions.partner] || '—';
    const gbp = (Number(f[F.redemptions.cost]) || 0) / POINTS_PER_POUND_VALUE;
    const settled = (f[F.redemptions.status] || 'redeemed') === 'settled';
    const cur = byPartner.get(partner) || { partner, owed: 0, owedCount: 0, paid: 0, paidCount: 0, lastAt: at };
    if (settled) {
      cur.paid += gbp;
      cur.paidCount += 1;
    } else {
      cur.owed += gbp;
      cur.owedCount += 1;
    }
    if (at && (!cur.lastAt || at > cur.lastAt)) cur.lastAt = at;
    byPartner.set(partner, cur);
  }
  return [...byPartner.values()]
    .map((p) => ({ ...p, owed: Math.round(p.owed * 100) / 100, paid: Math.round(p.paid * 100) / 100 }))
    .sort((a, b) => b.owed - a.owed);
}

/** Settle a partner's owed redemptions (optionally just one month) → status 'settled'. */
export async function markPartnerPaid(partner, month) {
  const [rewards, rows] = await Promise.all([
    listRewards({ liveOnly: false }),
    listRecords(T.redemptions, { filterByFormula: `AND({Partner}='${esc(partner)}', {Status}='redeemed')` }),
  ]);
  const fundingById = new Map(rewards.map((r) => [r.id, r.funding]));
  let settled = 0;
  for (const r of rows) {
    const f = r.fields;
    if ((fundingById.get(f[F.redemptions.rewardId]) || 'inventory') === 'inventory') continue;
    if (month && String(f[F.redemptions.at] || '').slice(0, 7) !== month) continue;
    await updateRecord(T.redemptions, r.id, { [F.redemptions.status]: 'settled' }, { typecast: true });
    settled += 1;
  }
  return { settled };
}

/**
 * Itemised statement for ONE partner: every partner-funded redemption as a line
 * (reward, member, £ value, date, owed|paid) plus running owed/paid totals. Powers the
 * expandable per-partner breakdown in the admin Partners tab so each payout can be
 * reconciled line by line. Optional `month` (YYYY-MM) scopes to one period.
 */
export async function partnerStatement(partner, { month } = {}) {
  const [rewards, rows] = await Promise.all([
    listRewards({ liveOnly: false }),
    listRecords(T.redemptions, { filterByFormula: `{Partner}='${esc(partner)}'`, sort: [{ field: 'At', direction: 'desc' }] }),
  ]);
  const fundingById = new Map(rewards.map((r) => [r.id, r.funding]));
  const items = [];
  let owed = 0;
  let paid = 0;
  for (const r of rows) {
    const f = r.fields;
    if ((fundingById.get(f[F.redemptions.rewardId]) || 'inventory') === 'inventory') continue;
    const at = f[F.redemptions.at] || null;
    if (month && String(at || '').slice(0, 7) !== month) continue;
    const gbp = Math.round(((Number(f[F.redemptions.cost]) || 0) / POINTS_PER_POUND_VALUE) * 100) / 100;
    const status = (f[F.redemptions.status] || 'redeemed') === 'settled' ? 'paid' : 'owed';
    if (status === 'paid') paid += gbp;
    else owed += gbp;
    items.push({ reward: f[F.redemptions.reward] || '', email: f[F.redemptions.email] || '', gbp, at, status });
  }
  return { partner, items, owed: Math.round(owed * 100) / 100, paid: Math.round(paid * 100) / 100, count: items.length };
}

// --- Partner activity email (best-effort, never blocks the redemption) -----------

/**
 * Email the partner's Contact when a member redeems one of their rewards. Loads the
 * partner's float row for the Contact email + current balance, then sends the "a
 * member just redeemed …" note with the £ value, updated balance, the monthly-payout
 * reassurance and a link to their self-service balance page. Guarded end-to-end:
 * sendEmail never throws, and any Airtable hiccup is swallowed — a redemption must
 * never fail because of an email. Silently no-ops for inventory rewards / partners
 * with no Contact email on file.
 */
async function notifyPartnerOfRedemption(reward) {
  try {
    if (!reward || !reward.partner) return;
    const rows = await listRecords(T.partners, { filterByFormula: `{Partner}='${esc(reward.partner)}'`, maxRecords: 1 });
    const row = rows[0];
    if (!row) return;
    const contactEmail = String(row.fields[F.partners.contactEmail] || '').trim();
    if (!contactEmail) return; // e.g. our own inventory rewards — nobody to notify.

    const value = poundsValue(reward.cost);
    const balance = Number(row.fields[F.partners.balance]) || 0;
    const total = Number(row.fields[F.partners.floatTotal]) || 0;
    const gbp = (n) => `£${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;
    const link = `${SITE_URL}/partner/${partnerToken(reward.partner)}`;
    const funded = reward.funding !== 'inventory' && total > 0;

    const body = `
      <p style="margin:0 0 14px;">Good news — a Quarter member has just redeemed a reward with you.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ece3d2;border-radius:12px;overflow:hidden;margin:0 0 16px;">
        <tr><td style="padding:12px 16px;border-bottom:1px solid #f0e8d8;font-size:13px;color:#8a8172;">Reward</td><td style="padding:12px 16px;border-bottom:1px solid #f0e8d8;text-align:right;font-weight:700;">${escapeHtml(reward.title)}</td></tr>
        <tr><td style="padding:12px 16px;border-bottom:1px solid #f0e8d8;font-size:13px;color:#8a8172;">Value</td><td style="padding:12px 16px;border-bottom:1px solid #f0e8d8;text-align:right;font-weight:700;">${gbp(value)}</td></tr>
        ${funded ? `<tr><td style="padding:12px 16px;font-size:13px;color:#8a8172;">Float balance</td><td style="padding:12px 16px;text-align:right;font-weight:700;">${gbp(balance)}</td></tr>` : ''}
      </table>
      ${funded ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#8a8172;">This ${gbp(value)} is drawn from your float when the member's voucher is scanned at the till, so your balance updates then. The live figure is always on your balance page.</p>` : ''}
      <p style="margin:0 0 16px;">
        <a href="${link}" style="display:inline-block;background:#b08a3e;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:10px;">View your balance</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8172;">
        The Quarter settles partner payouts on a monthly or quarterly basis — you don't need to invoice; we reconcile and pay per our agreement. Bookmark the balance link above to check in any time.
      </p>`;

    await sendEmail({
      to: contactEmail,
      subject: `A member just redeemed ${reward.title} at The Quarter`,
      html: emailShell('A member just redeemed a reward', body, `${reward.title} — ${gbp(value)}`),
    });
  } catch {
    /* best-effort — never block or fail the redemption */
  }
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
  // Nudge the member their voucher is live (best-effort — pushToEmail can't throw).
  await pushToEmail(email, { title: 'Your reward is ready', body: `Show your QR at the till for ${reward.title}.`, url: '/rewards/' });
  // Tell the partner (best-effort). Awaited-but-guarded so it completes within the
  // serverless lifecycle yet can never throw or block the redemption result.
  await notifyPartnerOfRedemption(reward);
  // Copy the ops inbox so every claim is tracked (best-effort — never blocks).
  await notifyAdmins('Reward redeemed', `${email} · ${reward.title}`, {
    link: '/admin/#partners',
    rows: [
      ['Reward', reward.title],
      ['Partner', reward.partner || '—'],
      ['Value', `£${poundsValue(reward.cost).toFixed(2)} (${reward.cost} pts)`],
      ['Member', email],
    ],
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
