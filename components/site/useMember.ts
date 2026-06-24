'use client';

import { useEffect, useState } from 'react';
import { getMemberstack, PLAN_ID_TO_SLUG, type Member } from '@/lib/memberstack';

export interface MemberState {
  loading: boolean;
  member: Member | null;
}

/** Subscribe to Memberstack auth state on the client.
   Retries getCurrentMember briefly to ride out the session not being readable
   immediately after a fresh page load post-login (which otherwise bounced the
   dashboard back to /login). */
export function useMember(): MemberState {
  const [state, setState] = useState<MemberState>({ loading: true, member: null });

  useEffect(() => {
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

  return state;
}

/** The member's current Quarter plan slug (e.g. 'visitor'), or null. */
export function memberPlanSlug(member: Member | null): string | null {
  const active = member?.planConnections?.find((p) => p.active || p.status === 'ACTIVE');
  const planId = active?.planId ?? member?.planConnections?.[0]?.planId;
  return planId ? PLAN_ID_TO_SLUG[planId] ?? null : null;
}
