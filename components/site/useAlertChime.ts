'use client';

import { useEffect, useRef } from 'react';
import { playChime, type Chime } from '@/lib/feedback';

/**
 * Chime when a count of things-needing-attention goes UP.
 *
 * Deliberately silent on first load: the admin dashboard opens with a backlog most days,
 * and a chime for things you already knew about is noise. It also stays silent when the
 * count falls, so working through a queue doesn't sound like new work arriving. Only a
 * genuine increase — something landed while you were looking at the screen — makes a sound.
 */
export function useAlertChime(count: number | null | undefined, kind: Chime = 'attention'): void {
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (count == null) return;
    if (seen.current != null && count > seen.current) playChime(kind);
    seen.current = count;
  }, [count, kind]);
}
