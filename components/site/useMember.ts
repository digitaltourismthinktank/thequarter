'use client';

import { useEffect, useState } from 'react';
import { getMemberstack, PLAN_ID_TO_SLUG, type Member } from '@/lib/memberstack';

export interface MemberState {
  loading: boolean;
  member: Member | null;
}

/** Subscribe to Memberstack auth state on the client. */
export function useMember(): MemberState {
  const [state, setState] = useState<MemberState>({ loading: true, member: null });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => boolean) | undefined;

    (async () => {
      const ms = await getMemberstack();
      if (!ms) {
        if (active) setState({ loading: false, member: null });
        return;
      }
      try {
        const { data } = await ms.getCurrentMember();
        if (active) setState({ loading: false, member: data ?? null });
      } catch {
        if (active) setState({ loading: false, member: null });
      }
      const sub = ms.onAuthChange((member) => {
        if (active) setState({ loading: false, member: member ?? null });
      });
      unsubscribe = sub?.unsubscribe;
    })();

    return () => {
      active = false;
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
