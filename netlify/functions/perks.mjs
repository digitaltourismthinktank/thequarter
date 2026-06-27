/**
 * The Quarter — member Perks API.
 *
 * GET  (member token) → { perks } (live perks for the member browse + detail)
 * POST {action:'use', perkId} → mint a perk token for the redemption screen → /v/[token]
 *
 * The public marketing perks teaser stays static (lib/perks.ts); this serves the
 * gated member experience backed by the Airtable Perks table.
 */
import { verifyMember, memberEmail, tokenFromRequest } from './_member.mjs';
import { airtableReady } from './_airtable.mjs';
import { listPerks, getPerk } from './_rewards.mjs';
import { mintToken } from './_tokens.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  if (req.method === 'GET') {
    const vm = await verifyMember(tokenFromRequest(req, null));
    if (!vm.ok) return json({ error: vm.reason }, 401);
    const perks = await listPerks();
    return json({ perks });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  if (body.action === 'use') {
    if (!body.perkId) return json({ error: 'missing-perkId' }, 400);
    const perk = await getPerk(body.perkId);
    if (!perk || perk.status !== 'live') return json({ error: 'not-found' }, 404);
    const token = await mintToken({ email: memberEmail(vm.member), partner: perk.partner, perkId: perk.id, kind: 'perk' });
    return json({ ok: true, token, perk });
  }

  return json({ error: 'unknown-action' }, 400);
}
