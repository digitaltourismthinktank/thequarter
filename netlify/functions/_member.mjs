/**
 * The Quarter — Memberstack token verification + member helpers for the booking/
 * check-in/admin functions. Verifies the member JWT server-side via the Admin SDK.
 */
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
// Admins are identified by email domain — anyone @thinkdigital.travel is staff.
// No Memberstack permission to manage. Both are env-configurable; ADMIN_EMAILS is an
// optional comma-separated allowlist for any extra admins outside the domain.
const ADMIN_DOMAIN = (process.env.ADMIN_EMAIL_DOMAIN || 'thinkdigital.travel').toLowerCase();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

/** Is this member staff? True if their (verified) email is on the admin domain or allowlist. */
export function isAdmin(m) {
  const email = (memberEmail(m) || '').toLowerCase();
  if (!email) return false;
  return email.endsWith(`@${ADMIN_DOMAIN}`) || ADMIN_EMAILS.includes(email);
}

/** Read the member's Bearer token from the request (Authorization header or JSON body). */
export function tokenFromRequest(req, body) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return body?.token || null;
}
