/**
 * The Quarter — Memberstack token verification + member helpers for the booking/
 * check-in/admin functions. Verifies the member JWT server-side via the Admin SDK.
 */
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
// The Memberstack permission that marks staff/admins. Configurable so we can match
// whatever the client names it without a code change.
const ADMIN_PERMISSION = process.env.MS_ADMIN_PERMISSION || 'admin';

/** Verify a member token → { ok, member } or { ok:false, reason }. */
export async function verifyMember(token) {
  if (!MS_SECRET) return { ok: false, reason: 'not-configured' };
  if (!token) return { ok: false, reason: 'no-token' };
  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const v = await admin.verifyToken({ token });
    if (!v?.id) return { ok: false, reason: 'invalid-token' };
    const r = await admin.members.retrieve({ id: v.id });
    const member = r?.data;
    if (!member) return { ok: false, reason: 'no-member' };
    return { ok: true, member };
  } catch (e) {
    return { ok: false, reason: 'verify-failed', detail: String(e?.message || e) };
  }
}

export function memberEmail(m) {
  return m?.auth?.email || m?.email || null;
}

export function memberName(m) {
  const cf = m?.customFields || {};
  const name = [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim();
  return name || memberEmail(m) || 'Member';
}

/** Does the member hold the admin permission? (Memberstack permissions[] array.) */
export function isAdmin(m) {
  const perms = m?.permissions || [];
  return Array.isArray(perms) && perms.includes(ADMIN_PERMISSION);
}

/** Read the member's Bearer token from the request (Authorization header or JSON body). */
export function tokenFromRequest(req, body) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return body?.token || null;
}
