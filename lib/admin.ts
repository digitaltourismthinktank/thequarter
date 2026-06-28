/**
 * The Quarter — client-side staff detection.
 *
 * Staff are identified by email domain (anyone @thinkdigital.travel). The server
 * enforces this independently in netlify/functions/_member.mjs (isAdmin); this is
 * only for UI affordances (admin redirect on login, the admin↔member switch in the
 * member shell). Mirror any change to the domain in _member.mjs.
 */
export const ADMIN_EMAIL_DOMAIN = 'thinkdigital.travel';

export function isAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}
