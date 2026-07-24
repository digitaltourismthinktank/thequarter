'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { reserveDay, checkInToday, cancelReservation, changeCheckinLength, announceBalancesChanged, type DayPeriod } from '@/lib/booking';
import { haptic, playChime } from '@/lib/feedback';
import { BuyPassSheet } from './BuyPassSheet';
import styles from './DaySheet.module.css';

/** The hour (0–23) right now in London — so a same-day check-in can assume the sensible length.
 *  Falls back to the device clock if Intl is unhappy. */
function londonHourNow(): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date())) % 24;
  } catch {
    return new Date().getHours();
  }
}

export type DaySheetDay = {
  id: string;
  date: string;
  length: 'Full' | 'Half';
  period?: DayPeriod | null;
  kind?: 'pass' | 'reserved';
  /** Already walked in — attendance is a fact, so it can't be released. */
  in?: boolean;
};

/** "Tuesday 28 July" */
function longDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

function friendly(code?: string): string {
  switch (code) {
    case 'closed-weekend':
      return 'The Quarter is open Monday to Friday.';
    case 'closed-day':
      return 'We’re closed that day (bank holiday or seasonal closure).';
    case 'weekend-request':
      return 'Weekends are by request — we’ll confirm by email.';
    case 'needs-plan-or-pass':
      return 'Booking a day needs a plan or a day pass.';
    case 'no-allowance':
      return 'You’ve no days left for that period.';
    case 'past-date':
      return 'That day has already been and gone.';
    case 'change-unsupported':
      return 'To change this day, cancel it and book again.';
    case 'held-by-booking':
      return 'This day is held by a room or pod booking — cancel that booking to free the day.';
    case 'past-day':
      return 'That day has already passed.';
    case 'no-booking':
      return 'That day isn’t booked any more — pull to refresh.';
    case 'no-token':
    case 'invalid-token':
    case 'verify-failed':
    case 'no-member':
      return 'Please sign in again.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Something went wrong — please try again.';
  }
}

/** The union of what a booking and a check-in report back — the two calls answer the same
 *  questions ("what did it cost, what's left, what did it earn") with overlapping shapes. */
type DayWriteResult = {
  requested?: boolean;
  alreadyReserved?: boolean;
  alreadyCheckedIn?: boolean;
  alreadyBooked?: boolean;
  dayCost?: number;
  balance?: string | null;
  pointsAwarded?: number;
  usedCarnet?: boolean;
  carnetRemaining?: number | null;
  deferred?: boolean;
  error?: string;
};

/** "Uses 1 day — 3 left", "Uses 1 day pass — 1 left", "Uses half a day — 3.5 left". */
function costLine(d: { dayCost?: number; balance?: string | null; usedCarnet?: boolean; carnetRemaining?: number | null }): string | null {
  if (d.usedCarnet) return `Used 1 day pass${typeof d.carnetRemaining === 'number' ? ` — ${d.carnetRemaining} left in your carnet` : ''}.`;
  if (typeof d.dayCost === 'number' && d.dayCost > 0) {
    const amount = d.dayCost === 0.5 ? 'half a day' : `${d.dayCost} day${d.dayCost === 1 ? '' : 's'}`;
    const left = d.balance != null && String(d.balance).toLowerCase() !== 'unlimited' ? ` — ${d.balance} left` : '';
    return `Used ${amount} from your plan${left}.`;
  }
  return null;
}

/**
 * One sheet for a single day — used both to BOOK a day just picked and to CHANGE one already
 * booked. It exists because the old flow booked a day the moment you tapped a date on the week
 * strip or the calendar, silently applying whatever Full/Half toggle happened to be set further up
 * the card: members were never actually asked, and a booked day couldn't be changed at all without
 * cancelling it. Every path now goes through the same explicit question and the same confirmation
 * that says what it cost.
 */
export function DaySheet({
  open,
  date,
  existing,
  checkinNow = false,
  onClose,
  onChanged,
}: {
  open: boolean;
  date: string | null;
  /** Present = editing a day already booked; absent = booking the picked date. */
  existing?: DaySheetDay | null;
  /** Arriving right now rather than planning ahead — records attendance, not just a booking. */
  checkinNow?: boolean;
  onClose: () => void;
  /** Something was written — the parent should re-read its data. */
  onChanged: () => void;
}) {
  const editing = !!existing;
  const [length, setLength] = useState<'Full' | 'Half'>('Full');
  const [period, setPeriod] = useState<DayPeriod>('am');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The refusal code, kept separately: "no days left" isn't really an error, it's a decision point,
  // and it deserves the two ways out rather than a red line telling them they can't come in.
  const [blocked, setBlocked] = useState<'no-allowance' | 'needs-plan-or-pass' | null>(null);
  const [done, setDone] = useState<{ title: string; detail: string | null } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [buyPass, setBuyPass] = useState(false);

  // Open fresh every time.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setBlocked(null);
    setDone(null);
    setBusy(false);
    setConfirmCancel(false);
    if (existing) {
      // Editing a booked/checked-in day → seed from what it already is.
      setLength(existing.length === 'Half' ? 'Half' : 'Full');
      setPeriod(existing.period === 'pm' ? 'pm' : 'am');
    } else if (checkinNow) {
      // Arriving now → assume the sensible length from the clock, but leave every option one tap
      // away. Someone checking in after lunch almost always means the afternoon half, not a full
      // day they've already half-missed; before 1pm, morning is the natural default for a half.
      const afternoon = londonHourNow() >= 13;
      setLength(afternoon ? 'Half' : 'Full');
      setPeriod(afternoon ? 'pm' : 'am');
    } else {
      // Planning a future day — no time-of-day to infer, so start on a full day.
      setLength('Full');
      setPeriod('am');
    }
  }, [open, checkinNow, existing?.id, existing?.length, existing?.period]);

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

  if (!open || !date) return null;

  const isPass = existing?.kind === 'pass';
  // Already walked in. Attendance is a fact, so the day can't be RELEASED — but the length can
  // still change: someone who checked in for the morning and stayed on should be able to say so,
  // and the server settles the half-day difference.
  const attended = !!existing?.in;

  async function book() {
    if (!date) return;
    setBusy(true);
    setError(null);
    setBlocked(null);
    const r = checkinNow ? await checkInToday(length, length === 'Half' ? period : null) : await reserveDay(date, length, length === 'Half' ? period : null);
    const d = (r.data || {}) as DayWriteResult;
    if (!r.ok) {
      if (d.error === 'no-allowance' || d.error === 'needs-plan-or-pass') setBlocked(d.error);
      else setError(friendly(d.error));
      haptic([8, 40, 8]);
    } else if (d.requested) {
      setDone({ title: 'Weekend request sent', detail: 'We’ll confirm by email before the day.' });
      haptic(12);
      onChanged();
    } else if (d.alreadyReserved || d.alreadyCheckedIn || d.alreadyBooked) {
      setDone({ title: checkinNow ? 'You were already in' : 'Already booked', detail: 'You were already down for that day.' });
      onChanged();
    } else {
      setDone({
        title: checkinNow ? 'You’re checked in' : 'Booked',
        detail:
          [costLine(d), d.pointsAwarded ? `+${d.pointsAwarded} points.` : null].filter(Boolean).join(' ') ||
          (d.deferred
            ? 'This day falls in your next cycle — it’ll come out of next month’s allowance.'
            : checkinNow
              ? 'Enjoy The Quarter.'
              : 'Your day is booked.'),
      });
      announceBalancesChanged({ balance: d.balance ?? null, carnetRemaining: d.carnetRemaining ?? null });
      haptic(18);
      playChime('success');
      onChanged();
    }
    setBusy(false);
  }

  async function change(nextLen: 'Full' | 'Half', nextPeriod?: DayPeriod) {
    if (!date) return;
    setBusy(true);
    setError(null);
    const r = await changeCheckinLength(nextLen, nextLen === 'Half' ? nextPeriod ?? period : null, date);
    if (!r.ok || r.data?.error) {
      if (r.data?.error === 'no-allowance') setBlocked('no-allowance');
      else setError(friendly(r.data?.error));
      haptic([8, 40, 8]);
    } else {
      const delta = r.data?.dayDelta ?? 0;
      setLength(nextLen);
      if (nextLen === 'Half' && nextPeriod) setPeriod(nextPeriod);
      setDone({
        title: nextLen === 'Half' ? `Changed to a half day${(nextPeriod ?? period) === 'pm' ? ' · afternoon' : ' · morning'}` : 'Changed to a full day',
        detail:
          delta > 0
            ? `Half a day taken from your balance${r.data?.balance != null ? ` — ${r.data.balance} left` : ''}.`
            : delta < 0
              ? `Half a day credited back${r.data?.balance != null ? ` — ${r.data.balance} left` : ''}.`
              : r.data?.pending
                ? 'Nothing taken yet — this day is paid for on the morning itself.'
                : 'No change to your balance.',
      });
      haptic(12);
      announceBalancesChanged();
      onChanged();
    }
    setBusy(false);
  }

  async function release() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    const r = await cancelReservation(existing.id);
    if (!r.ok) {
      setError(friendly(r.data?.error));
      haptic([8, 40, 8]);
    } else {
      // A checked-in day that's cancelled hands the day back AND reverses the check-in points —
      // say so plainly, so a points drop is never a surprise.
      const parts: string[] = [];
      if (r.data?.refunded) parts.push('that day’s back in your balance');
      const pts = r.data?.pointsReversed ?? 0;
      if (pts > 0) parts.push(`${pts} check-in ${pts === 1 ? 'point' : 'points'} reversed`);
      setDone({
        title: attended ? 'Check-in cancelled' : 'Day cancelled',
        detail: parts.length ? `${parts.join(' · ')}.` : 'Nothing had been taken for it, so there’s nothing to credit back.',
      });
      haptic(12);
      announceBalancesChanged();
      onChanged();
    }
    setBusy(false);
  }

  const lengthSummary = length === 'Half' ? `half day · ${period === 'pm' ? 'afternoon' : 'morning'}` : 'full day';

  const sheet = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={editing ? 'Change this day' : 'Book this day'} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <span className={styles.grab} aria-hidden="true" />

        {done ? (
          <div className={styles.doneWrap}>
            <span className={styles.doneTick} aria-hidden="true">
              <Icon name="check" size={30} color="var(--ink-900)" strokeWidth={2.6} />
            </span>
            <h2 className={styles.title}>{done.title}</h2>
            <p className={styles.meta}>{longDate(date)}</p>
            {done.detail ? <p className={styles.note}>{done.detail}</p> : null}
            <button type="button" className={styles.cta} onClick={onClose}>
              Done
            </button>
          </div>
        ) : attended ? (
          /* Already in today. Lead with the confirmation — a tick and "You're checked in" — so it
             reads as done, THEN offer changing the length or cancelling underneath as the secondary
             thing it is. (This used to be a faint line of text with all the emphasis on the change.) */
          <>
            <div className={styles.inHeader}>
              <span className={styles.inTick} aria-hidden="true">
                <Icon name="check" size={22} color="var(--ink-900)" strokeWidth={2.8} />
              </span>
              <div className={styles.inHeadText}>
                <h2 className={styles.title}>You&rsquo;re checked in</h2>
                <p className={styles.meta}>
                  {longDate(date)} · {lengthSummary}
                </p>
              </div>
            </div>
            <p className={styles.changeLabel}>Staying longer, or leaving? Change or cancel below.</p>

            <div className={styles.choices} role="radiogroup" aria-label="Day length">
              <button
                type="button"
                role="radio"
                aria-checked={length === 'Full'}
                className={cn(styles.choice, length === 'Full' && styles.choiceOn)}
                disabled={busy}
                onClick={() => change('Full')}
              >
                <span className={styles.choiceTitle}>Full day</span>
                <span className={styles.choiceSub}>{isPass ? 'Covered by your pass' : '9am–6pm · uses 1 day'}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={length === 'Half'}
                className={cn(styles.choice, length === 'Half' && styles.choiceOn)}
                disabled={busy}
                onClick={() => change('Half', period)}
              >
                <span className={styles.choiceTitle}>Half day</span>
                <span className={styles.choiceSub}>{isPass ? 'Covered by your pass' : 'Morning or afternoon · uses ½ day'}</span>
              </button>
            </div>

            {length === 'Half' ? (
              <div className={styles.choices} role="radiogroup" aria-label="Which half of the day">
                <button type="button" role="radio" aria-checked={period === 'am'} className={cn(styles.choice, styles.choiceSlim, period === 'am' && styles.choiceOn)} disabled={busy} onClick={() => change('Half', 'am')}>
                  <span className={styles.choiceTitle}>Morning</span>
                  <span className={styles.choiceSub}>9am–1pm</span>
                </button>
                <button type="button" role="radio" aria-checked={period === 'pm'} className={cn(styles.choice, styles.choiceSlim, period === 'pm' && styles.choiceOn)} disabled={busy} onClick={() => change('Half', 'pm')}>
                  <span className={styles.choiceTitle}>Afternoon</span>
                  <span className={styles.choiceSub}>1pm–6pm</span>
                </button>
              </div>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}

            {confirmCancel ? (
              <div className={styles.confirmRow}>
                <p className={styles.confirmAsk}>Cancel your check-in? The day goes back to your balance and the check-in points are reversed.</p>
                <div className={styles.confirmBtns}>
                  <button type="button" className={styles.ghost} onClick={() => setConfirmCancel(false)} disabled={busy}>
                    Keep it
                  </button>
                  <button type="button" className={styles.danger} onClick={release} disabled={busy}>
                    {busy ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.linkDanger} onClick={() => setConfirmCancel(true)} disabled={busy}>
                Cancel my check-in
              </button>
            )}
            <button type="button" className={cn(styles.cta, styles.ctaQuiet)} onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.title}>{editing ? longDate(date) : checkinNow ? 'Checking in today' : `Coming in on ${longDate(date)}?`}</h2>
            <p className={styles.meta}>
              {editing
                ? isPass
                  ? 'Booked with a day pass — a pass covers the whole day either way.'
                  : `Currently a ${lengthSummary}.`
                : checkinNow
                  ? longDate(date)
                  : 'How long are you in for?'}
            </p>

            {/* The question itself — proper, full-width buttons, never a silent default. */}
            <div className={styles.choices} role="radiogroup" aria-label="Day length">
              <button
                type="button"
                role="radio"
                aria-checked={length === 'Full'}
                className={cn(styles.choice, length === 'Full' && styles.choiceOn)}
                disabled={busy}
                onClick={() => (editing ? change('Full') : setLength('Full'))}
              >
                <span className={styles.choiceTitle}>Full day</span>
                <span className={styles.choiceSub}>{isPass ? 'Covered by your pass' : '9am–6pm · uses 1 day'}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={length === 'Half'}
                className={cn(styles.choice, length === 'Half' && styles.choiceOn)}
                disabled={busy}
                onClick={() => (editing ? change('Half', period) : setLength('Half'))}
              >
                <span className={styles.choiceTitle}>Half day</span>
                <span className={styles.choiceSub}>{isPass ? 'Covered by your pass' : 'Morning or afternoon · uses ½ day'}</span>
              </button>
            </div>

            {length === 'Half' ? (
              <div className={styles.choices} role="radiogroup" aria-label="Which half of the day">
                <button
                  type="button"
                  role="radio"
                  aria-checked={period === 'am'}
                  className={cn(styles.choice, styles.choiceSlim, period === 'am' && styles.choiceOn)}
                  disabled={busy}
                  onClick={() => (editing ? change('Half', 'am') : setPeriod('am'))}
                >
                  <span className={styles.choiceTitle}>Morning</span>
                  <span className={styles.choiceSub}>9am–1pm</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={period === 'pm'}
                  className={cn(styles.choice, styles.choiceSlim, period === 'pm' && styles.choiceOn)}
                  disabled={busy}
                  onClick={() => (editing ? change('Half', 'pm') : setPeriod('pm'))}
                >
                  <span className={styles.choiceTitle}>Afternoon</span>
                  <span className={styles.choiceSub}>1pm–6pm</span>
                </button>
              </div>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}

            {/* Out of days. Two real ways forward — a bigger plan for a habit, a pass for a one-off —
                rather than a refusal that leaves them working out who to email. */}
            {blocked ? (
              <div className={styles.blocked} role="status">
                <strong className={styles.blockedTitle}>
                  {blocked === 'needs-plan-or-pass' ? 'You’ll need a plan or a day pass' : 'You’ve no days left'}
                </strong>
                <p className={styles.blockedBody}>
                  {blocked === 'needs-plan-or-pass'
                    ? 'Coming in draws on a membership plan or a day pass.'
                    : 'Your plan’s days for this period are all used. Add a day pass for one-offs, or change plan if you’re here more often than it allows.'}
                </p>
                <div className={styles.blockedActions}>
                  <button type="button" className={styles.blockedPrimary} onClick={() => setBuyPass(true)}>
                    Buy a day pass
                  </button>
                  <a className={styles.blockedGhost} href="/plan/">
                    {blocked === 'needs-plan-or-pass' ? 'Choose a plan' : 'Change plan'}
                  </a>
                </div>
              </div>
            ) : null}

            {/* A booked-but-not-yet-attended day: change its length above, or release it here. */}
            {editing ? (
              <>
                {confirmCancel ? (
                  <div className={styles.confirmRow}>
                    <p className={styles.confirmAsk}>Cancel this day?</p>
                    <div className={styles.confirmBtns}>
                      <button type="button" className={styles.ghost} onClick={() => setConfirmCancel(false)} disabled={busy}>
                        Keep it
                      </button>
                      <button type="button" className={styles.danger} onClick={release} disabled={busy}>
                        {busy ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={styles.linkDanger} onClick={() => setConfirmCancel(true)} disabled={busy}>
                    Cancel this day
                  </button>
                )}
                <button type="button" className={cn(styles.cta, styles.ctaQuiet)} onClick={onClose}>
                  Close
                </button>
              </>
            ) : blocked ? (
              <button type="button" className={cn(styles.cta, styles.ctaQuiet)} onClick={onClose}>
                Not now
              </button>
            ) : (
              <button type="button" className={styles.cta} onClick={book} disabled={busy}>
                {busy ? (checkinNow ? 'Checking you in…' : 'Booking…') : checkinNow ? `Check in for ${length === 'Half' ? 'half a day' : 'the day'}` : `Book ${length === 'Half' ? 'half a day' : 'the day'}`}
              </button>
            )}
          </>
        )}
      </div>
      <BuyPassSheet
        open={buyPass}
        onClose={() => setBuyPass(false)}
        onPurchased={() => {
          // Pass bought — clear the block and re-read, so they can carry straight on.
          setBuyPass(false);
          setBlocked(null);
          announceBalancesChanged();
          onChanged();
        }}
      />
    </div>
  );

  // Portal to <body>: the sheet is a viewport-fixed overlay, but it was rendered deep inside the
  // dashboard where a transformed/animated ancestor (the collapsible plan-ahead panel) traps
  // position:fixed to that ancestor's box — which is exactly why the sheet appeared BEHIND the
  // membership card and clashed with the page instead of covering it. Rendering into <body> frees
  // it from every such stacking trap.
  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : null;
}
