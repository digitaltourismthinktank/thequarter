'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMemberstack, PLAN_ID_TO_SLUG, type Member } from '@/lib/memberstack';
import { PREVIEW, previewMember } from '@/lib/devMock';

export interface MemberState {
  loading: boolean;
  member: Member | null;
}
export interface UseMember extends MemberState {
  /** Re-read the member from Memberstack (uncached) — e.g. after a plan change. */
  refresh: () => Promise<void>;
}

/** Subscribe to Memberstack auth state on the client.
   Retries getCurrentMember briefly to ride out the session not being readable
   immediately after a fresh page load post-login (which otherwise bounced the
   dashboard back to /login). */
export function useMember(): UseMember {
  // Local preview seeds the mock member synchronously so it's present from the
  // first client render (no redirect race). Never runs in production.
  const [state, setState] = useState<MemberState>(
    PREVIEW ? { loading: false, member: previewMember } : { loading: true, member: null },
  );

  // Re-read the member on demand (e.g. after a plan switch — poll for the webhook).
  const refresh = useCallback(async () => {
    if (PREVIEW) return;
    const ms = await getMemberstack();
    if (!ms) return;
    try {
      const { data } = await ms.getCurrentMember({ useCache: false });
      setState({ loading: false, member: data ?? null });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (PREVIEW) return;
    let cancelled = false;
    let unsubscribe: (() => boolean) | undefined;

    (async () => {
      const ms = await getMemberstack();
      if (!ms) {
        if (!cancelled) setState({ loading: false, member: null });
        return;
      }

      // React to login/logout while on the page.
      const sub = ms.onAuthChange((member) => {
        if (!cancelled) setState({ loading: false, member: member ?? null });
      });
      unsubscribe = sub?.unsubscribe;

      // Try a few times so a just-logged-in session is picked up.
      for (let i = 0; i < 6; i += 1) {
        try {
          const { data } = await ms.getCurrentMember({ useCache: false });
          if (data) {
            if (!cancelled) setState({ loading: false, member: data });
            return;
          }
        } catch {
          /* keep trying */
        }
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelled) setState({ loading: false, member: null });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { ...state, refresh };
}

/** The member's current Quarter plan slug (e.g. 'visitor'), or null. */
export function memberPlanSlug(member: Member | null): string | null {
  const active = member?.planConnections?.find((p) => p.active || p.status === 'ACTIVE');
  const planId = active?.planId ?? member?.planConnections?.[0]?.planId;
  return planId ? PLAN_ID_TO_SLUG[planId] ?? null : null;
}
