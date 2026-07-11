'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { useMember } from './useMember';
import { memberName } from '@/lib/memberstack';
import { getCheckinToday, checkInToday, type CheckinStatus } from '@/lib/booking';
import styles from './ArriveClient.module.css';

/**
 * The arrival screen — a member scans the entrance QR (pointing here) on their
 * phone: one tap to check in, an optional half-day toggle, a warm confirmation,
 * then a gentle drift to their dashboard. Deliberately single-purpose.
 */
export function ArriveClient() {
  const { loading: memberLoading, member } = useMember();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [half, setHalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    getCheckinToday().then((r) => {
      if (r.ok) setStatus(r.data);
      setLoaded(true);
    });
  }, [member]);

  async function doCheckIn() {
    setBusy(true);
    setError(null);
    const r = await checkInToday(half ? 'Half' : 'Full');
    setBusy(false);
    if (!r.ok) {
      setError(friendly(r.data?.error));
      return;
    }
    setDone(true);
    // Let them enjoy the confirmation, then drift to the dashboard.
    setTimeout(() => window.location.assign('/dashboard/'), 3500);
  }

  const first = (memberName(member) || '').split(' ')[0] || null;

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <Image src="/brand/logo-wordmark-black.png" alt="The Quarter" width={150} height={60} priority className={styles.logo} />

        {memberLoading ? (
          <p className={styles.muted}>One moment…</p>
        ) : !member ? (
          <>
            <h1 className={styles.h1}>Welcome</h1>
            <p className={styles.lead}>Log in on your phone to check in.</p>
            <a className={styles.bigBtn} href="/login">
              Log in
            </a>
          </>
        ) : done ? (
          <div className={styles.doneWrap}>
            <span className={styles.tick} aria-hidden="true">
              <Icon name="check" size={44} color="var(--ink-900)" />
            </span>
            <h1 className={styles.h1}>You&rsquo;re in{first ? `, ${first}` : ''}</h1>
            <p className={styles.lead}>Have a lovely day at The Quarter.</p>
            <a className={styles.textLink} href="/dashboard/">
              Go to your dashboard
            </a>
          </div>
        ) : loaded && status?.checkedIn ? (
          <div className={styles.doneWrap}>
            <span className={styles.tick} aria-hidden="true">
              <Icon name="check" size={44} color="var(--ink-900)" />
            </span>
            <h1 className={styles.h1}>Already in{first ? `, ${first}` : ''}</h1>
            <p className={styles.lead}>You checked in earlier — enjoy the day.</p>
            <a className={styles.textLink} href="/dashboard/">
              Go to your dashboard
            </a>
          </div>
        ) : (
          <>
            <h1 className={styles.h1}>Hello{first ? `, ${first}` : ''}</h1>
            <p className={styles.lead}>Tap to check in.</p>

            <div className={styles.seg} role="tablist" aria-label="Day length">
              <button type="button" role="tab" aria-selected={!half} className={cn(styles.segBtn, !half && styles.segOn)} onClick={() => setHalf(false)}>
                Full day
              </button>
              <button type="button" role="tab" aria-selected={half} className={cn(styles.segBtn, half && styles.segOn)} onClick={() => setHalf(true)}>
                Half day
              </button>
            </div>

            <button type="button" className={styles.bigBtn} onClick={doCheckIn} disabled={busy}>
              {busy ? 'Checking you in…' : 'Check in'}
            </button>
            {error ? <p className={styles.error}>{error}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}

function friendly(code?: string): string {
  switch (code) {
    case 'closed-day':
      return 'The Quarter is closed today.';
    case 'not-configured':
      return 'Check-in isn’t available just now — please see the team.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Something went wrong — please see the team.';
  }
}
