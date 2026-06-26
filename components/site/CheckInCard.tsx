'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import {
  getCheckinToday,
  checkInToday,
  reserveDay,
  cancelReservation,
  type CheckinStatus,
} from '@/lib/booking';
import styles from './CheckInCard.module.css';

/** Format a YYYY-MM-DD as e.g. "Mon 29 Jun" (treat as a calendar date, UTC). */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** The day after a YYYY-MM-DD (calendar maths, UTC). */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Dashboard card: self check-in (Today), reserve (Tomorrow), full/half day. */
export function CheckInCard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [half, setHalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function doTomorrow() {
    setBusy(true);
    setError(null);
    const date = nextDay(status?.date ?? new Date().toISOString().slice(0, 10));
    const r = await reserveDay(date, half ? 'Half' : 'Full');
    if (!r.ok) setError(friendly(r.data?.error));
    await refresh();
    setBusy(false);
  }

  async function doCancel(id: string) {
    setBusy(true);
    await cancelReservation(id);
    await refresh();
    setBusy(false);
  }

  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Your visits</span>

      {loading ? (
        <p className={styles.meta}>Loading…</p>
      ) : status?.checkedIn ? (
        <>
          <h2 className={styles.title}>You&rsquo;re in today ✓</h2>
          <p className={styles.meta}>{status.length === 'Half' ? 'Half day' : 'Full day'} — enjoy The Quarter.</p>
        </>
      ) : (
        <>
          <h2 className={styles.title}>Coming in?</h2>
          <label className={styles.toggle}>
            <input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} />
            Half day
          </label>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" onClick={doCheckIn} disabled={busy}>
              I&rsquo;m in today
            </Button>
            <Button variant="secondary" size="sm" onClick={doTomorrow} disabled={busy}>
              I&rsquo;ll be in tomorrow
            </Button>
          </div>
        </>
      )}

      {status?.planned?.length ? (
        <div className={styles.planned}>
          <span className={styles.plannedLabel}>Planned</span>
          {status.planned.map((p) => (
            <span key={p.id} className={styles.chip}>
              {fmtDate(p.date)}
              {p.length === 'Half' ? ' · ½' : ''}
              <button className={styles.chipX} onClick={() => doCancel(p.id)} aria-label="Cancel reservation" disabled={busy}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

function friendly(code?: string): string {
  switch (code) {
    case 'closed-weekend':
      return 'The Quarter is open Monday to Friday.';
    case 'not-configured':
      return 'Check-in isn’t available just yet.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Something went wrong — please try again.';
  }
}
