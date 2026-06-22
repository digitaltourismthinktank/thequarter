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

/** A friendly message from a Memberstack error. */
export function memberstackError(e: unknown): string {
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: string };
    if (obj.message) return obj.message;
  }
  return 'Something went wrong. Please try again.';
}
