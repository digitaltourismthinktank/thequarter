'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { getCarnet, BALANCES_EVENT, type CarnetState } from '@/lib/booking';
import styles from './CarnetMini.module.css';

/**
 * Compact day-pass balance for the dashboard rail — shown only when the member
 * holds passes. The carnet sits alongside the plan (no monthly cycle); tapping
 * through goes to /plan where they can use or top it up.
 */
export function CarnetMini() {
  const [carnet, setCarnet] = useState<CarnetState | null>(null);

  const load = useCallback(async () => {
    const r = await getCarnet();
    if (r.ok) setCarnet(r.data.carnet);
  }, []);
  useEffect(() => {
    load();
    // Refresh the moment a check-in / booking spends a pass — optimistically from the event detail
    // if it carried a fresh count, then re-fetch for the source of truth.
    const onChange = (e: Event) => {
      const n = (e as CustomEvent).detail?.carnetRemaining;
      if (typeof n === 'number') setCarnet((c) => (c ? { ...c, remaining: Math.max(0, n) } : c));
      load();
    };
    window.addEventListener(BALANCES_EVENT, onChange);
    return () => window.removeEventListener(BALANCES_EVENT, onChange);
  }, [load]);

  if (!carnet || carnet.remaining <= 0) return null;
  const validUntil = carnet.expires
    ? new Date(`${carnet.expires}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <a className={styles.pane} href="/plan">
      <span className={styles.icon} aria-hidden="true">
        <Icon name="ticket" size={20} color="var(--gold-700)" />
      </span>
      <span className={styles.text}>
        <strong className={styles.n}>
          {carnet.remaining} day pass{carnet.remaining === 1 ? '' : 'es'} left
        </strong>
        <span className={styles.sub}>{validUntil ? `Valid until ${validUntil}` : 'Use any day'}</span>
      </span>
      <Icon name="arrow-right" size={16} color="var(--gold-600)" />
    </a>
  );
}
