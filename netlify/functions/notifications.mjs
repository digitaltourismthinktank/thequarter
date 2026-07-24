/**
 * The Quarter — notifications inbox API (the bell).
 *
 * GET  ?scope=member|admin           → { ok, configured, notifications:[...], unread:n }
 * POST { action, scope, ids? }        → mutate, then return the fresh list
 *   action: 'read' { ids }  · 'readAll'  · 'clear' { ids }  · 'clearAll'
 *
 * scope 'member' = the caller's own inbox (keyed on their verified email).
 * scope 'admin'  = the shared staff feed — requires an admin caller.
 *
 * Env-gated: if AIRTABLE_NOTIFICATIONS_TABLE is unset the endpoint still 200s with
 * configured:false and an empty list, so the bell simply shows nothing until the table exists.
 */
import { verifyMember, tokenFromRequest, memberEmail, isAdmin } from './_member.mjs';
import {
  notificationsConfigured,
  listNotifications,
  markRead,
  markAllRead,
  clear,
} from './_notifications.mjs';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  const url = new URL(req.url);
  const scope = (body.scope || url.searchParams.get('scope') || 'member') === 'admin' ? 'admin' : 'member';
  if (scope === 'admin' && !isAdmin(vm.member)) return json({ error: 'not-admin' }, 403);

  const email = memberEmail(vm.member);
  const key = { recipient: email, audience: scope };

  // Not configured → behave as an empty inbox rather than erroring, so the UI degrades cleanly.
  if (!notificationsConfigured()) {
    return json({ ok: true, configured: false, notifications: [], unread: 0 });
  }

  if (req.method === 'POST') {
    const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
    switch (body.action) {
      case 'read': await markRead({ ...key, ids }); break;
      case 'readAll': await markAllRead(key); break;
      case 'clear': await clear({ ...key, ids }); break;
      case 'clearAll': await clear({ ...key, ids: [] }); break;
      default: return json({ error: 'bad-action' }, 400);
    }
  }

  const { notifications, unread } = await listNotifications(key);
  return json({ ok: true, configured: true, notifications, unread });
}
