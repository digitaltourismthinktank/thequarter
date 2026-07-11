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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<string[]>([]); // optimistic reservations in flight

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
    const r = await checkInToday(half ? 'Half' : 'Full');
    if (!r.ok) setError(friendly(r.data?.error));
    await refresh();
    setBusy(false);
  }

  async function doReserveDate(v: string) {
    if (!v) return;
    setBusy(true);
    setError(null);
    setPending((p) => (p.includes(v) ? p : [...p, v])); // instant feedback
    const r = await reserveDay(v, half ? 'Half' : 'Full');
    if (!r.ok) setError(friendly(r.data?.error));
    await refresh();
    setPending((p) => p.filter((x) => x !== v));
    setBusy(false);
  }

  async function doCancel(id: string) {
    setBusy(true);
    await cancelReservation(id);
    await refresh();
    setBusy(false);
  }

  const todayIso = status?.date ?? new Date().toISOString().slice(0, 10);
  const openToday = dowOf(todayIso) >= 1 && dowOf(todayIso) <= 5;
  const nextOpen = nextOpenDay(todayIso);
  const nextLabel = nextOpen === addDaysIso(todayIso, 1) ? 'tomorrow' : weekdayLong(nextOpen);

  const plannedDates = status?.planned?.map((p) => p.date) ?? [];
  const pendingOnly = pending.filter((d) => !plannedDates.includes(d));
  const showPlanned = plannedDates.length > 0 || pendingOnly.length > 0;

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>Book a visit</span>

      {loading ? (
        <p className={styles.meta}>Loading…</p>
      ) : (
        <>
          {status?.checkedIn ? (
            <>
              <h2 className={styles.title}>You&rsquo;re in today</h2>
              <p className={styles.meta}>{status.length === 'Half' ? 'Half day' : 'Full day'} — enjoy The Quarter.</p>
            </>
          ) : (
            <h2 className={styles.title}>Coming in?</h2>
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
          <div className={styles.planAhead}>
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
          {status?.planned?.map((p) => (
            <span key={p.id} className={styles.chip}>
              {fmtDate(p.date)}
              {p.length === 'Half' ? ' · ½' : ''}
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
    case 'not-configured':
      return 'Check-in isn’t available just yet.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Something went wrong — please try again.';
  }
}
