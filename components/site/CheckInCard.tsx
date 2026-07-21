'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { getCheckinToday, checkInToday, reserveDay, cancelReservation, type CheckinStatus } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { WeekStrip } from './WeekStrip';
import { DatePickerModal } from './DatePickerModal';
import styles from './CheckInCard.module.css';

/** Format a YYYY-MM-DD as e.g. "Mon 29 Jun" (treat as a calendar date, UTC). */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
/** Weekday index (0 Sun … 6 Sat) of a YYYY-MM-DD. */
function dowOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function weekdayLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}
/** The next OPEN day after a YYYY-MM-DD — skips Sat/Sun. */
function nextOpenDay(iso: string): string {
  let out = addDaysIso(iso, 1);
  while (dowOf(out) === 0 || dowOf(out) === 6) out = addDaysIso(out, 1);
  return out;
}

/** Dashboard card: self check-in (Today), reserve a future day, full/half. */
export function CheckInCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [half, setHalf] = useState(false);
  const [period, setPeriod] = useState<'am' | 'pm'>('am');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<string[]>([]); // optimistic reservations in flight
  const [note, setNote] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ points: number; already: boolean } | null>(null);
  // Planning a future day is useful but secondary — on a phone the tab bar's check-in
  // sheet handles today, so this folds away behind a toggle rather than filling Home.
  const [planOpen, setPlanOpen] = useState(false);

  async function refresh() {
    const r = await getCheckinToday();
    if (r.ok) setStatus(r.data);
    else setError(friendly(r.data?.error));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function doCheckIn() {
    setBusy(true);
    setError(null);
    const r = await checkInToday(half ? 'Half' : 'Full', half ? period : null);
    if (!r.ok) setError(friendly(r.data?.error));
    else {
      // Members told us they couldn't tell whether checking in had worked — there was no
      // acknowledgement at all. Show an explicit confirmation, with the points just earned.
      setConfirmed({ points: r.data?.pointsAwarded ?? 0, already: !!r.data?.alreadyCheckedIn });
    }
    await refresh();
    setBusy(false);
  }

  async function doReserveDate(v: string) {
    if (!v) return;
    setBusy(true);
    setError(null);
    setNote(null);
    setPending((p) => (p.includes(v) ? p : [...p, v])); // instant feedback
    const r = await reserveDay(v, half ? 'Half' : 'Full', half ? period : null);
    if (!r.ok) setError(friendly(r.data?.error));
    else if (r.data.requested) setNote('Weekend access requested — we’ll confirm by email.');
    await refresh();
    setPending((p) => p.filter((x) => x !== v));
    setBusy(false);
  }

  async function doCancel(id: string) {
    setBusy(true);
    const r = await cancelReservation(id);
    // Never call it a "refund" — cancelling returns the day (or pass) to their balance.
    if (r.ok) setNote(r.data?.refunded ? 'Cancelled — that day’s been credited back to your balance.' : 'Cancelled.');
    await refresh();
    setBusy(false);
  }

  const todayIso = status?.date ?? new Date().toISOString().slice(0, 10);
  const openToday = dowOf(todayIso) >= 1 && dowOf(todayIso) <= 5;
  const nextOpen = nextOpenDay(todayIso);
  const nextLabel = nextOpen === addDaysIso(todayIso, 1) ? 'tomorrow' : weekdayLong(nextOpen);

  // The first question Home should answer is "when am I next in?" — so the heading states it
  // rather than opening with a form. Planned days come back sorted, but don't rely on it.
  const nextPlanned = (status?.planned ?? []).filter((p) => p.date > todayIso).sort((a, b) => a.date.localeCompare(b.date))[0];

  const plannedDates = status?.planned?.map((p) => p.date) ?? [];
  const pendingOnly = pending.filter((d) => !plannedDates.includes(d));
  const showPlanned = plannedDates.length > 0 || pendingOnly.length > 0;

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>Your visits</span>

      {/* Unmissable acknowledgement that the check-in landed, and what it earned. */}
      {confirmed ? (
        <div className={styles.confirm} role="status" aria-live="polite">
          <span className={styles.confirmTick} aria-hidden="true">
            ✓
          </span>
          <span className={styles.confirmText}>
            <strong>{confirmed.already ? 'You were already checked in' : "You're checked in"}</strong>
            {confirmed.points > 0 ? <span className={styles.confirmPoints}>+{confirmed.points} points</span> : null}
          </span>
          <button type="button" className={styles.confirmX} onClick={() => setConfirmed(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className={styles.meta}>Loading…</p>
      ) : (
        <>
          {status?.checkedIn ? (
            <>
              <h2 className={styles.title}>You&rsquo;re in today</h2>
              <p className={styles.meta}>
                {status.length === 'Half' ? `Half day${status.period ? ` · ${status.period === 'am' ? 'morning' : 'afternoon'}` : ''}` : 'Full day'} — enjoy The Quarter.
              </p>
            </>
          ) : nextPlanned ? (
            <>
              <h2 className={styles.title}>Next in {fmtDate(nextPlanned.date)}</h2>
              <p className={styles.meta}>
                {nextPlanned.length === 'Half'
                  ? `Half day${nextPlanned.period ? ` · ${nextPlanned.period === 'am' ? 'morning' : 'afternoon'}` : ''}`
                  : 'Full day'}
                {nextPlanned.kind === 'pass' ? ' · day pass' : ''}
              </p>
            </>
          ) : (
            <>
              <h2 className={styles.title}>Nothing booked yet</h2>
              <p className={cn(styles.meta, styles.metaPhone)}>Tap the check-in button below when you arrive, or plan a day.</p>
            </>
          )}

          {/* Full / Half — applies to checking in today and to any days you plan. */}
          <div className={styles.seg} role="tablist" aria-label="Day length">
            <button type="button" role="tab" aria-selected={!half} className={cn(styles.segBtn, !half && styles.segOn)} onClick={() => setHalf(false)}>
              Full day
            </button>
            <button type="button" role="tab" aria-selected={half} className={cn(styles.segBtn, half && styles.segOn)} onClick={() => setHalf(true)}>
              Half day
            </button>
          </div>

          {/* Which half — only for a half day, so the team knows when to expect you. */}
          {half ? (
            <div className={cn(styles.seg, styles.periodSeg)} role="tablist" aria-label="Which half of the day">
              <button type="button" role="tab" aria-selected={period === 'am'} className={cn(styles.segBtn, period === 'am' && styles.segOn)} onClick={() => setPeriod('am')}>
                Morning
              </button>
              <button type="button" role="tab" aria-selected={period === 'pm'} className={cn(styles.segBtn, period === 'pm' && styles.segOn)} onClick={() => setPeriod('pm')}>
                Afternoon
              </button>
            </div>
          ) : null}

          {!status?.checkedIn ? (
            <div className={styles.actions}>
              {openToday ? (
                <Button variant="primary" size="sm" onClick={doCheckIn} disabled={busy}>
                  I&rsquo;m in today
                </Button>
              ) : null}
              <Button variant={openToday ? 'secondary' : 'primary'} size="sm" onClick={() => doReserveDate(nextOpen)} disabled={busy}>
                I&rsquo;ll be in {nextLabel}
              </Button>
            </div>
          ) : null}

          {/* Plan-ahead stays available even once you're checked in today. */}
          <button type="button" className={styles.planToggle} onClick={() => setPlanOpen((v) => !v)} aria-expanded={planOpen}>
            {planOpen ? 'Hide other days' : 'Book another day'}
          </button>
          <div className={cn(styles.planAhead, planOpen && styles.planAheadOpen)}>
            <WeekStrip label={status?.checkedIn ? 'Book another day' : 'Book for the coming week'} onSelect={doReserveDate} booked={[...plannedDates, ...pending]} />
            <button type="button" className={styles.dateBtn} onClick={() => setPickerOpen(true)}>
              + Pick a date
            </button>
          </div>
        </>
      )}

      {showPlanned ? (
        <div className={styles.planned}>
          <span className={styles.plannedLabel}>Your upcoming check-ins</span>
          {/* Copy before sorting: sort() mutates, and this array is held in React state.
              Check-ins carry no start time, so date is the whole key. */}
          {[...(status?.planned ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map((p) => (
            <span key={p.id} className={styles.chip}>
              {fmtDate(p.date)}
              {p.length === 'Half' ? (p.period ? ` · ½ ${p.period.toUpperCase()}` : ' · ½') : ''}
              {p.kind === 'pass' ? <span className={styles.passTag}>Day Pass</span> : null}
              <button className={styles.chipX} onClick={() => doCancel(p.id)} aria-label="Cancel reservation" disabled={busy}>
                ×
              </button>
            </span>
          ))}
          {pendingOnly.map((d) => (
            <span key={`pend-${d}`} className={cn(styles.chip, styles.chipPending)} aria-live="polite">
              {fmtDate(d)} · adding…
            </span>
          ))}
        </div>
      ) : null}

      {status?.requested?.length ? (
        <div className={styles.planned}>
          <span className={styles.plannedLabel}>Weekend requests — awaiting confirmation</span>
          {status.requested.map((p) => (
            <span key={p.id} className={cn(styles.chip, styles.chipPending)}>
              {fmtDate(p.date)}
              <button className={styles.chipX} onClick={() => doCancel(p.id)} aria-label="Cancel request" disabled={busy}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {note ? <p className={styles.meta}>{note}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <DatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={doReserveDate}
        allowWeekend
        planned={[...plannedDates, ...pending]}
      />
    </div>
  );
}

function friendly(code?: string): string {
  switch (code) {
    case 'closed-weekend':
      return 'The Quarter is open Monday to Friday.';
    case 'closed-day':
      return 'The Quarter is closed that day (bank holiday or seasonal closure).';
    case 'weekend-request':
      return 'Weekends are by request — pick a weekend day and we’ll confirm.';
    case 'weekend-pending':
      return 'Your weekend request is in — we’ll confirm by email before the day.';
    case 'needs-plan-or-pass':
      return 'Checking in needs a plan or a day pass. Grab a day pass, choose a plan, or have a word with the team.';
    case 'no-allowance':
      return 'You’ve used your allowance for this period — no days left.';
    case 'no-token':
    case 'invalid-token':
    case 'verify-failed':
    case 'no-member':
      return 'Please sign in again to book.';
    case 'server':
      return 'We couldn’t reach bookings just now — please try again in a moment.';
    case 'bad-date':
      return 'Please choose a valid weekday.';
    case 'not-configured':
      return 'Check-in isn’t available just yet.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Something went wrong — please try again.';
  }
}
