'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { getCheckinToday, checkInToday, type CheckinStatus } from '@/lib/booking';
import styles from './CheckInSheet.module.css';

/** "Monday 20 July" — the same long form the emails use. */
function longDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function friendly(code?: string): string {
  switch (code) {
    case 'closed-day':
      return 'We’re closed today (bank holiday or seasonal closure).';
    case 'weekend-request':
      return 'Weekends are by request — ask us and we’ll confirm.';
    case 'weekend-pending':
      return 'Your weekend request is in — we’ll confirm before the day.';
    case 'no-allowance':
      return 'You’ve used your allowance for this period — no days left.';
    case 'no-token':
    case 'invalid-token':
    case 'verify-failed':
    case 'no-member':
      return 'Please sign in again to check in.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Something went wrong — please try again.';
  }
}

/**
 * The check-in sheet behind the tab bar's centre button. A sheet rather than a page so a
 * member can check in from wherever they are without losing their place — checking in is
 * the one thing they do every day.
 */
export function CheckInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [half, setHalf] = useState(false);
  const [period, setPeriod] = useState<'am' | 'pm'>('am');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ points: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDone(null);
    setLoading(true);
    getCheckinToday().then((r) => {
      if (r.ok) setStatus(r.data);
      setLoading(false);
    });
  }, [open]);

  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const already = !!status?.checkedIn;

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await checkInToday(half ? 'Half' : 'Full', half ? period : null);
    if (!r.ok) setError(friendly(r.data?.error));
    else setDone({ points: r.data?.pointsAwarded ?? 0 });
    setBusy(false);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Check in" onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <span className={styles.grab} aria-hidden="true" />

        {done ? (
          <div className={styles.doneWrap}>
            <span className={styles.doneTick}>
              <Icon name="check" size={30} color="var(--ink-900)" strokeWidth={2.6} />
            </span>
            <h2 className={styles.title}>You&rsquo;re checked in</h2>
            <p className={styles.meta}>
              {half ? `Half day · ${period === 'am' ? 'morning' : 'afternoon'}` : 'Full day'}
              {done.points > 0 ? ` · +${done.points} points` : ''}
            </p>
            <button type="button" className={styles.cta} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>{already ? 'You’re already in today' : 'Checking in today'}</h2>
            <p className={styles.meta}>{status?.date ? longDate(status.date) : 'Today'}</p>

            {already ? (
              <>
                <p className={styles.note}>
                  {status?.length === 'Half'
                    ? `You’re here for a half day${status.period ? ` · ${status.period === 'am' ? 'morning' : 'afternoon'}` : ''}.`
                    : 'You’re here for a full day.'}{' '}
                  Enjoy The Quarter.
                </p>
                <button type="button" className={styles.cta} onClick={onClose}>
                  Close
                </button>
              </>
            ) : (
              <>
                <div className={styles.seg} role="tablist" aria-label="Day length">
                  <button type="button" role="tab" aria-selected={!half} className={cn(styles.segBtn, !half && styles.segOn)} onClick={() => setHalf(false)}>
                    Full day
                  </button>
                  <button type="button" role="tab" aria-selected={half} className={cn(styles.segBtn, half && styles.segOn)} onClick={() => setHalf(true)}>
                    Half day
                  </button>
                </div>

                {half ? (
                  <div className={styles.seg} role="tablist" aria-label="Which half">
                    <button type="button" role="tab" aria-selected={period === 'am'} className={cn(styles.segBtn, period === 'am' && styles.segOn)} onClick={() => setPeriod('am')}>
                      Morning
                    </button>
                    <button type="button" role="tab" aria-selected={period === 'pm'} className={cn(styles.segBtn, period === 'pm' && styles.segOn)} onClick={() => setPeriod('pm')}>
                      Afternoon
                    </button>
                  </div>
                ) : null}

                {error ? <p className={styles.error}>{error}</p> : null}

                <button type="button" className={styles.cta} onClick={submit} disabled={busy || loading}>
                  {busy ? 'Checking you in…' : 'Check in'}
                </button>
                <p className={styles.fine}>Checking in earns points — more on a quiet day.</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
