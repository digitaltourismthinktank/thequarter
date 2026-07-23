'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { getCheckinToday, checkInToday, changeCheckinLength, announceBalancesChanged, type CheckinStatus } from '@/lib/booking';
import { haptic, playChime } from '@/lib/feedback';
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
    case 'needs-plan-or-pass':
      return 'Checking in needs a plan or a day pass. Grab a day pass, choose a plan, or have a word with the team.';
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
  const [changeNote, setChangeNote] = useState<string | null>(null);
  const [done, setDone] = useState<{ points: number; usedCarnet?: boolean; passesLeft?: number | null; balance?: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setChangeNote(null);
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
    if (!r.ok) {
      setError(friendly(r.data?.error));
      haptic([8, 40, 8]); // a stutter, so a failure doesn't feel like a success
    } else {
      setDone({
        points: r.data?.pointsAwarded ?? 0,
        usedCarnet: r.data?.usedCarnet,
        passesLeft: r.data?.carnetRemaining ?? null,
        balance: r.data?.balance ?? null,
      });
      // Refresh the dashboard's days / pass counts the instant this spend lands.
      announceBalancesChanged({ balance: r.data?.balance ?? null, carnetRemaining: r.data?.carnetRemaining ?? null });
      haptic(18);
      playChime('success');
    }
    setBusy(false);
  }

  // Change today's length once already in — moves only the day difference (points don't change),
  // and re-reads status so the sheet reflects it immediately.
  async function changeLength(length: 'Full' | 'Half', p?: 'am' | 'pm') {
    setBusy(true);
    setError(null);
    setChangeNote(null);
    const r = await changeCheckinLength(length, length === 'Half' ? p ?? 'am' : null);
    if (!r.ok || r.data?.error) {
      const code = r.data?.error;
      setError(code === 'no-allowance' ? 'Not enough days left to make it a full day.' : code === 'change-unsupported' ? 'To change this day, cancel it and book again.' : friendly(code));
      haptic([8, 40, 8]);
    } else {
      const d = r.data?.dayDelta ?? 0;
      setChangeNote(d > 0 ? 'Changed to a full day — half a day used.' : d < 0 ? 'Changed to a half day — half a day credited back.' : 'Updated.');
      haptic(12);
      const s = await getCheckinToday();
      if (s.ok) setStatus(s.data);
      // The length change moved a half-day of balance — refresh the dashboard counts.
      announceBalancesChanged();
    }
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
            {/* Say plainly what this cost — a day off the plan, so it never feels like a day vanished. */}
            {!done.usedCarnet && done.balance != null && String(done.balance).toLowerCase() !== 'unlimited' && Number.isFinite(Number(done.balance)) ? (
              <p className={styles.note}>
                Used {half ? 'half a day' : '1 day'} from your plan — {Number(done.balance)} {Number(done.balance) === 1 ? 'day' : 'days'} left.
              </p>
            ) : null}
            {/* Spending a pass without saying so would look like a pass going missing. */}
            {done.usedCarnet ? (
              <p className={styles.note}>
                Your plan days were used up, so this came from a day pass in your carnet
                {typeof done.passesLeft === 'number' ? ` — ${done.passesLeft} left` : ''}.
                {half ? ' A pass covers a whole day.' : ''}
              </p>
            ) : null}
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

                {/* Change your mind — switch half↔full (and morning↔afternoon). Only the day
                    difference moves; points don't change. */}
                <div className={styles.seg} role="group" aria-label="Change today">
                  {status?.length === 'Half' ? (
                    <>
                      <button type="button" className={styles.segBtn} onClick={() => changeLength('Full')} disabled={busy}>
                        Make it a full day
                      </button>
                      <button type="button" className={styles.segBtn} onClick={() => changeLength('Half', status.period === 'am' ? 'pm' : 'am')} disabled={busy}>
                        Move to {status.period === 'am' ? 'afternoon' : 'morning'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.segBtn} onClick={() => changeLength('Half', 'am')} disabled={busy}>
                        Half day · morning
                      </button>
                      <button type="button" className={styles.segBtn} onClick={() => changeLength('Half', 'pm')} disabled={busy}>
                        Half day · afternoon
                      </button>
                    </>
                  )}
                </div>
                {changeNote ? <p className={styles.fine}>{changeNote}</p> : null}
                {error ? <p className={styles.error}>{error}</p> : null}

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
