/**
 * The Quarter — Quarter Rewards API (member-facing).
 *
 * GET  (member token) → { points, catalogue (with availability), redemptions }
 * POST {action:'redeem', rewardId} → deduct points, log, mint a voucher token → /v/[token]
 *
 * `funding` is admin-only and never returned to members (CODE_BRIEF §8).
 */
import { verifyMember, memberEmail, tokenFromRequest } from './_member.mjs';
import { airtableReady } from './_airtable.mjs';
import { listRewards, listFloats, rewardAvailability, memberPoints, memberLifetimePoints, redeemReward, memberRedemptions, memberLedger } from './_rewards.mjs';
import { mintToken } from './_tokens.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

/** Member-safe reward shape — omits `funding` (admin-only). */
const publicReward = (r) => ({
  id: r.id,
  partner: r.partner,
  title: r.title,
  cost: r.cost,
  category: r.category,
  icon: r.icon,
  hero: r.hero,
  image: r.image,
  pos: r.pos,
});

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  if (req.method === 'GET') {
    // Public, no-auth teaser for the marketing /rewards page — the LIVE reward
    // catalogue from admin (partner/title/icon/category/hero, no member data), so
    // editing rewards in the back end updates the public site. Mirrors perks?public=1.
    if (new URL(req.url).searchParams.get('public') === '1') {
      const live = await listRewards({ liveOnly: true });
      return json({ rewards: live.map(publicReward) });
    }
    const vm = await verifyMember(tokenFromRequest(req, null));
    if (!vm.ok) return json({ error: vm.reason }, 401);
    const email = memberEmail(vm.member);
    const [rewards, floats, redemptions, ledger] = await Promise.all([
      listRewards(),
      listFloats(),
      memberRedemptions(email),
      memberLedger(email, 100),
    ]);
    const catalogue = rewards.map((r) => ({ ...publicReward(r), avail: rewardAvailability(r, floats) }));
    const cutoff = Date.now() - 30 * 86400000;
    const earnedLately = ledger
      .filter((e) => e.delta > 0 && e.at && Date.parse(e.at) >= cutoff)
      .reduce((s, e) => s + e.delta, 0);
    const meta = vm.member.metaData || {};
    const birthday = { bday: meta.bday || null, claimed: meta.bdayClaimed || null };
    // The ledger is already in hand for earnedLately, so returning a slice of it costs
    // nothing and gives the member the same earn history the admin view has always had.
    const activity = ledger.slice(0, 12).map((e) => ({ id: e.id, delta: e.delta, reason: e.reason, at: e.at }));
    return json({ points: memberPoints(vm.member), lifetimePoints: memberLifetimePoints(vm.member), earnedLately, catalogue, redemptions, birthday, activity });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  if (body.action === 'redeem') {
    if (!body.rewardId) return json({ error: 'missing-rewardId' }, 400);
    const res = await redeemReward(vm.member, body.rewardId);
    if (!res.ok) return json({ error: res.reason }, 400);
    const token = await mintToken({ email: memberEmail(vm.member), partner: res.reward.partner, perkId: res.reward.id, kind: 'reward' });
    return json({ ok: true, balance: res.balance, reward: publicReward(res.reward), token });
  }

  return json({ error: 'unknown-action' }, 400);
}
