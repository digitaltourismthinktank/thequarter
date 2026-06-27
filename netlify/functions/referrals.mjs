/**
 * The Quarter — refer-a-friend.
 *
 * GET  (member token) → { code, joined, pending, friends[] }  (the member's invite code = their id + tracker)
 * POST {action:'register', referrerId}  → create a pending referral for the signed-in friend
 *
 * The referrer is credited REFERRAL_BONUS when the friend starts their first paid plan
 * (handled in the Stripe webhook via creditReferral).
 */
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : null;
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const myEmail = memberEmail(me);

  if (req.method === 'GET') {
    const rows = await listRecords(T.referrals, {
      filterByFormula: `{Referrer id}='${esc(me.id)}'`,
      sort: [{ field: 'At', direction: 'desc' }],
    });
    const friends = rows.map((r) => ({
      name: r.fields[F.referrals.friendName] || 'A friend',
      status: r.fields[F.referrals.status] || 'pending',
      at: r.fields[F.referrals.at] || null,
    }));
    return json({
      code: me.id,
      joined: friends.filter((f) => f.status === 'joined').length,
      pending: friends.filter((f) => f.status !== 'joined').length,
      friends,
    });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  if (body.action === 'register') {
    const referrerId = String(body.referrerId || '').trim();
    if (!referrerId || referrerId === me.id) return json({ ok: false, reason: 'invalid' });
    // One referral per friend — don't double-register.
    const existing = await listRecords(T.referrals, { filterByFormula: `{Friend email}='${esc(myEmail)}'`, maxRecords: 1 });
    if (existing[0]) return json({ ok: true, already: true });
    await createRecord(T.referrals, {
      [F.referrals.entry]: `${referrerId} · ${myEmail}`,
      [F.referrals.referrerId]: referrerId,
      [F.referrals.friendEmail]: myEmail,
      [F.referrals.friendName]: memberName(me),
      [F.referrals.status]: 'pending',
      [F.referrals.at]: new Date().toISOString(),
    });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
