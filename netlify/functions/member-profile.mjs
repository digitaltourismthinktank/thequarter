/**
 * The Quarter — member self-service profile fields stored on Memberstack metaData.
 *
 * POST (member token) { bday?: 'MM-DD' | null, company?: string }
 *   bday    — birthday as month-day only (no year); captured at signup, optional.
 *   company — optional company for soft team grouping (CODE_BRIEF §15).
 *
 * metaData is free-form, so these need no Memberstack dashboard setup.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, tokenFromRequest } from './_member.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!MS_SECRET) return json({ error: 'not-configured' }, 503);
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  const meta = { ...(vm.member.metaData || {}) };
  if (body.bday === null) delete meta.bday;
  else if (typeof body.bday === 'string' && /^\d{2}-\d{2}$/.test(body.bday)) meta.bday = body.bday;
  if (typeof body.company === 'string') {
    const c = body.company.trim();
    if (c) meta.company = c;
    else delete meta.company;
  }

  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: vm.member.id, data: { metaData: meta } });
  return json({ ok: true, bday: meta.bday || null, company: meta.company || null });
}
