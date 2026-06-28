/**
 * The Quarter — Memberstack client helper (phase 2 member portal).
 *
 * The Memberstack DOM SDK is loaded via the hosted CDN script in app/layout.tsx
 * (`data-memberstack-app`), which exposes `window.$memberstackDom`. We use it
 * programmatically so the auth/portal UI stays on-brand. App ID is public.
 *
 * Payment stays on Stripe Payment Links (to avoid Memberstack's cut); the
 * Memberstack plans below are FREE access tiers used only for gating/labels.
 */

export const MEMBERSTACK_APP_ID = 'app_cmd30v5y700cg0wux95ltg5ky';

/**
 * Our plan id → Memberstack plan id (`pln_…`). FILL THESE IN (free plans).
 * Slugs supplied by the client: daily, visitor, resident, citizen, hybrid-plan.
 * Env vars win so they can be set in Netlify without a code change.
 */
export const MEMBERSTACK_PLAN_IDS: Record<string, string> = {
  'day-pass': process.env.NEXT_PUBLIC_MS_PLAN_DAILY ?? '',
  visitor: process.env.NEXT_PUBLIC_MS_PLAN_VISITOR ?? '',
  resident: process.env.NEXT_PUBLIC_MS_PLAN_RESIDENT ?? '',
  citizen: process.env.NEXT_PUBLIC_MS_PLAN_CITIZEN ?? '',
  'hybrid-office': process.env.NEXT_PUBLIC_MS_PLAN_HYBRID ?? '',
};

/** Reverse lookup: Memberstack plan id → our plan id (for showing the tier). */
export const PLAN_ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(MEMBERSTACK_PLAN_IDS)
    .filter(([, id]) => id)
    .map(([slug, id]) => [id, slug]),
);

/** Minimal shape of the member object we read. */
export interface MemberPlanConnection {
  id?: string;
  planId?: string;
  active?: boolean;
  status?: string;
  type?: string;
}
export interface Member {
  id: string;
  auth?: { email?: string };
  planConnections?: MemberPlanConnection[];
  customFields?: Record<string, unknown>;
  metaData?: Record<string, unknown>;
}

/** The subset of the Memberstack DOM SDK we call. */
export interface MemberstackDom {
  getCurrentMember(opts?: { useCache?: boolean }): Promise<{ data: Member | null }>;
  loginMemberEmailPassword(p: { email: string; password: string }): Promise<{ data: unknown }>;
  signupMemberEmailPassword(p: {
    email: string;
    password: string;
    plans?: { planId: string }[];
    customFields?: Record<string, unknown>;
    metaData?: Record<string, unknown>;
  }): Promise<{ data: unknown }>;
  logout(): Promise<{ data: { redirect?: string } }>;
  onAuthChange(cb: (member: Member | null) => void): { unsubscribe: () => boolean };
  sendMemberResetPasswordEmail(p: { email: string }): Promise<{ data: string }>;
  resetMemberPassword(p: { token: string; newPassword: string }): Promise<{ data: unknown }>;
  addPlan(p: { planId: string }): Promise<{ data: unknown }>;
  getPlan(p: { planId: string }): Promise<{ data: { id?: string; name?: string } | null }>;
  getPlans(): Promise<{ data: Array<{ id?: string; name?: string }> }>;
  getMemberCookie(): string | undefined;
}

declare global {
  interface Window {
    $memberstackDom?: MemberstackDom;
  }
}

/** Resolve the Memberstack instance once the CDN script has loaded (client only). */
export function getMemberstack(): Promise<MemberstackDom | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.$memberstackDom) return Promise.resolve(window.$memberstackDom);
  return new Promise((resolve) => {
    const start = Date.now();
    const id = window.setInterval(() => {
      if (window.$memberstackDom) {
        window.clearInterval(id);
        resolve(window.$memberstackDom);
      } else if (Date.now() - start > 10000) {
        window.clearInterval(id);
        resolve(null);
      }
    }, 50);
  });
}

/** The member's Memberstack JWT (to authenticate Netlify Function calls), or null. */
export async function getMemberToken(): Promise<string | null> {
  const ms = await getMemberstack();
  let token = ms?.getMemberCookie?.() ?? undefined;
  if (!token && typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)_ms-mid=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }
  return token ?? null;
}

/** A friendly message from a Memberstack error. */
export function memberstackError(e: unknown): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: string };
    if (obj.message) return obj.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Read a custom field off the member by a key predicate (tolerant of key-naming variants). */
function findCustomField(member: Member | null, test: (key: string) => boolean): string | null {
  const cf = member?.customFields;
  if (!cf) return null;
  for (const [k, v] of Object.entries(cf)) {
    if (v === null || v === undefined || v === '') continue;
    if (test(k.toLowerCase())) return String(v);
  }
  return null;
}

/** The member's remaining day balance (Memberstack custom field), or null. */
export function memberDaysRemaining(member: Member | null): string | null {
  return findCustomField(member, (k) => k.includes('day'));
}

/** The member's plan renewal / reset date (custom field), or null. */
export function memberRenewalDate(member: Member | null): string | null {
  return findCustomField(member, (k) => k.includes('renew'));
}

/** The member's door entry code (custom field), or null if not set. */
export function memberDoorCode(member: Member | null): string | null {
  return findCustomField(member, (k) => k.includes('door'));
}

/** The member's display name. Stored in metaData.name at signup; falls back to a
    name-ish custom field, then the local part of their email. */
export function memberName(member: Member | null): string | null {
  const md = member?.metaData;
  const fromMeta = md && typeof md.name === 'string' && md.name.trim() ? md.name.trim() : null;
  const fromCf = findCustomField(member, (k) => k === 'name' || k === 'full-name' || k === 'fullname' || k === 'first-name');
  const email = member?.auth?.email;
  const fromEmail = email ? email.split('@')[0].replace(/[._]+/g, ' ') : null;
  return fromMeta || fromCf || fromEmail || null;
}

/** Up-to-two-letter initials for an avatar, from a name (or email). */
export function memberInitials(member: Member | null): string {
  const name = memberName(member) || '';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'Q';
}
