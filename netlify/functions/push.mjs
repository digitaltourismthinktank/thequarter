/**
 * The Quarter — member push-notification subscriptions.
 *
 *   POST {action:'subscribe', subscription}  (member token) → store on metaData
 *   POST {action:'unsubscribe', endpoint}                   → remove
 *   POST {action:'test'}                                    → send a test push to this member
 *
 * Subscriptions are stored on the member's Memberstack metaData.pushSubscriptions
 * (capped to a few devices). Env: MEMBERSTACK_SECRET_KEY (+ VAPID keys for sending).
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, tokenFromRequest } from './_member.mjs';
import { sendPush, pushConfigured } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!MS_SECRET) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const admin = memberstackAdmin.init(MS_SECRET);
  const subs = Array.isArray(me.metaData?.pushSubscriptions) ? me.metaData.pushSubscriptions : [];

  if (body.action === 'subscribe') {
    const sub = body.subscription;
    if (!sub?.endpoint) return json({ error: 'bad-subscription' }, 400);
    const next = [...subs.filter((s) => s.endpoint !== sub.endpoint), sub].slice(-8); // keep last few devices
    await admin.members.update({ id: me.id, data: { metaData: { ...(me.metaData || {}), pushSubscriptions: next } } });
    return json({ ok: true, configured: pushConfigured() });
  }

  if (body.action === 'unsubscribe') {
    if (!body.endpoint) return json({ error: 'missing-endpoint' }, 400);
    const next = subs.filter((s) => s.endpoint !== body.endpoint);
    await admin.members.update({ id: me.id, data: { metaData: { ...(me.metaData || {}), pushSubscriptions: next } } });
    return json({ ok: true });
  }

  if (body.action === 'test') {
    const r = await sendPush(subs, { title: 'The Quarter', body: 'Notifications are on — see you soon.', url: '/dashboard/' });
    return json({ ok: true, ...r });
  }

  return json({ error: 'unknown-action' }, 400);
}
