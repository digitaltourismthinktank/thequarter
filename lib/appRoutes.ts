/**
 * Route groups shared by the root-layout scripts (Crisp gating in ThirdPartyScripts, the PWA
 * update banner in PWARegister). Kept in ONE place so "the member app + admin" and "the always-on
 * wall/kiosk screens" can't drift between the two components.
 */

/** The member app + admin — the PWA surface. Crisp is hidden here; the "app updated" banner
 *  shows ONLY here (never on public marketing pages or the wall screens). */
export const APP_ROUTES = ['/dashboard', '/book', '/rewards', '/perks', '/whats-on', '/plan', '/account', '/admin', '/admin-guide'];

/** Always-on wall-display / kiosk screens — no chrome, no chat, no update banner. */
export const DISPLAY_ROUTES = ['/screen', '/kiosk', '/arrive', '/guest', '/reception', '/signage', '/invite', '/unsubscribe'];

/** True when the path is within one of the given route prefixes. */
export const matchesRoute = (pathname: string, routes: string[]) =>
  routes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
