'use client';

import { useEffect, useState } from 'react';
import styles from './VerifyClient.module.css';

/**
 * /i/[code] — a friend's invite link. Captures the referrer code in localStorage and
 * sends them to plans; the referrer is credited when the friend starts a paid plan.
 * Served by the netlify.toml /i/* rewrite (static export can't pre-render codes).
 */
export function InviteClient() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const code = window.location.pathname.replace(/^\/i\//, '').replace(/\/$/, '');
    if (code) {
      try {
        window.localStorage.setItem('q_ref', code);
      } catch {
        /* ignore */
      }
    }
    setReady(true);
    const t = setTimeout(() => window.location.assign('/plans'), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={styles.screen}>
      <div className={`${styles.card} ${styles.muted}`}>
        <h1 className={styles.h1}>You&rsquo;ve been invited to The Quarter</h1>
        <p className={styles.body}>
          A friend thinks you&rsquo;d like it here. {ready ? 'Taking you to the plans…' : ''}
        </p>
        <p className={styles.body}>
          <a href="/plans">See the plans ›</a>
        </p>
      </div>
    </div>
  );
}
