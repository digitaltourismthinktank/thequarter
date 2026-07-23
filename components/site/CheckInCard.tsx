'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { getCheckinToday, cancelReservation, announceBalancesChanged, BALANCES_EVENT, type CheckinStatus } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { WeekStrip } from './WeekStrip';
import { DatePickerModal } from './DatePickerModal';
import { DaySheet, type DaySheetDay } from './DaySheet';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // The one place a day is booked, changed or released. Every route in — the week strip, the
  // calendar, "I'm in today", tapping a day you've already booked — opens this, so the full/half
  // question is always asked out loud and the answer always comes back with what it cost.
  const [sheet, setSheet] = useState<{ date: string; existing?: DaySheetDay | null; checkinNow?: boolean } | null>(null);
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
    // Another surface (the geo card, the check-in sheet) spent/booked a day — re-read so
    // "Your Visits" reflects it (e.g. today's checked-in chip) without a manual reload.
    const onChange = () => refresh();
    window.addEventListener(BALANCES_EVENT, onChange);
    return () => window.removeEventListener(BALANCES_EVENT, onChange);
  }, []);

  // Weekend requests only — a booked DAY is released from the day sheet, which asks first.
  async function doCancel(id: string) {
    setBusy(true);
    const r = await cancelReservation(id);
    if (r.ok) {
      setNote('Request withdrawn.');
      announceBalancesChanged();
    }
    await refresh();
    setBusy(false);
  }

  const todayIso = status?.date ?? new Date().toISOString().slice(0, 10);
  const openToday = dowOf(todayIso) >= 1 && dowOf(todayIso) <= 5;
  const nextOpen = nextOpenDay(todayIso);
  const nextLabel = nextOpen === addDaysIso(todayIso, 1) ? 'tomorrow' : weekdayLong(nextOpen);

  // The first question Home should answer is "when am I next in?" — so the heading states it
  // rather than opening with a form. Planned days come back sorted, but don't rely on it. Include
  // TODAY (>=): a day planned for today but not yet checked in is still "next in" — it was being
  // skipped, so a half-day booked for today showed tomorrow's date instead.
  const nextPlanned = (status?.planned ?? []).filter((p) => p.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))[0];
  // Booked for TODAY = already counted as in (the overnight sweep spends the day), so there's no
  // need to tap "I'm in today" — we say so and drop the redundant button.
  const bookedToday = !!nextPlanned && nextPlanned.date === todayIso;

  const plannedDates = status?.planned?.map((p) => p.date) ?? [];
  const showPlanned = plannedDates.length > 0;

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>Your visits</span>

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
              <h2 className={styles.title}>{bookedToday ? 'You’re in today' : `Next in ${fmtDate(nextPlanned.date)}`}</h2>
              <p className={styles.meta}>
                {nextPlanned.length === 'Half'
                  ? `Half day${nextPlanned.period ? ` · ${nextPlanned.period === 'am' ? 'morning' : 'afternoon'}` : ''}`
                  : 'Full day'}
                {nextPlanned.kind === 'pass' ? ' · day pass' : ''}
                {bookedToday ? ' · booked in — no need to check in when you arrive' : ''}
              </p>
            </>
          ) : (
            <>
              <h2 className={styles.title}>Nothing booked yet</h2>
              <p className={cn(styles.meta, styles.metaPhone)}>Tap the check-in button below when you arrive, or plan a day.</p>
            </>
          )}

          {!status?.checkedIn ? (
            <div className={styles.actions}>
              {openToday && !bookedToday ? (
                <Button variant="primary" size="sm" onClick={() => setSheet({ date: todayIso, checkinNow: true })} disabled={busy}>
                  I&rsquo;m in today
                </Button>
              ) : null}
              <Button variant={openToday && !bookedToday ? 'secondary' : 'primary'} size="sm" onClick={() => setSheet({ date: nextOpen })} disabled={busy}>
                I&rsquo;ll be in {nextLabel}
              </Button>
            </div>
          ) : null}

          {/* Plan-ahead stays available even once you're checked in today. */}
          <button type="button" className={styles.planToggle} onClick={() => setPlanOpen((v) => !v)} aria-expanded={planOpen}>
            {planOpen ? 'Hide other days' : 'Book another day'}
          </button>
          <div className={cn(styles.planAhead, planOpen && styles.planAheadOpen)}>
            <WeekStrip
              label={status?.checkedIn ? 'Book another day' : 'Book for the coming week'}
              onSelect={(d) => {
                // Tapping a day you already have opens it for changing, not double-booking.
                const owned = (status?.planned ?? []).find((p) => p.date === d);
                setSheet({ date: d, existing: owned ?? null });
              }}
              booked={plannedDates}
            />
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
          {[...(status?.planned ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map((p) => {
            // A day booked for today counts as in already (the sweep spends it) — mark it with a
            // tick and a pill so it reads as done.
            const isToday = p.date === todayIso;
            // The whole chip is the control now. The bare × was the only thing you could do to a
            // booked day, and it released it (and its money) on a single tap; tapping the day now
            // opens it, where the length can be changed and cancelling asks first.
            return (
              <button
                type="button"
                key={p.id}
                className={cn(styles.chip, styles.chipBtn, isToday && styles.chipIn)}
                onClick={() => setSheet({ date: p.date, existing: p })}
                disabled={busy}
                aria-label={`${fmtDate(p.date)} — ${p.length === 'Half' ? 'half day' : 'full day'}. Change or cancel.`}
              >
                {isToday ? (
                  <span className={styles.chipTick} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                {fmtDate(p.date)}
                {p.length === 'Half' ? (p.period ? ` · ½ ${p.period.toUpperCase()}` : ' · ½') : ''}
                {isToday ? <span className={styles.chipInTag}>In today</span> : null}
                {p.kind === 'pass' ? <span className={styles.passTag}>Day Pass</span> : null}
                {/* A walked-in day is attendance — it can still be opened to read, not to release. */}
                {p.in ? null : (
                  <span className={styles.chipEdit} aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            );
          })}
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
        onPick={(d) => {
          const owned = (status?.planned ?? []).find((p) => p.date === d);
          setSheet({ date: d, existing: owned ?? null });
        }}
        allowWeekend
        planned={plannedDates}
      />

      <DaySheet
        open={!!sheet}
        date={sheet?.date ?? null}
        existing={sheet?.existing ?? null}
        checkinNow={sheet?.checkinNow}
        onClose={() => setSheet(null)}
        onChanged={refresh}
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
