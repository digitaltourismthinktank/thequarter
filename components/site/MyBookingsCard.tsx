'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { cn } from '@/lib/cn';
import { getMyBookings, getSpaces, cancelBooking, amendBooking, type MyBooking, sortBookings } from '@/lib/booking';
import styles from './MyBookingsCard.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

// 08:00–18:00 in 30-minute steps — the bookable business day (mirrors the server).
const TIMES: string[] = [];
for (let m = 8 * 60; m <= 18 * 60; m += 30) TIMES.push(minToHHMM(m));

function amendError(code?: string): string {
  switch (code) {
    case 'slot-taken':
      return 'That time’s already taken — try another.';
    case 'double-book':
      return 'You’ve got another booking then — pick a different time.';
    case 'closed-day':
      return 'We’re closed that day (bank holiday or seasonal closure).';
    case 'outside-hours':
    case 'bad-time':
    case 'bad-increment':
      return 'Pick a time between 08:00 and 18:00.';
    case 'bad-date':
      return 'Please choose a valid date.';
    case 'paid-booking':
      return 'Paid bookings are changed by the team — just give us a shout.';
    // A booking holds a co-working day for its date, so moving it to another day means cancelling
    // and re-booking (which hands back the old day and books the new). Same-day time changes are fine.
    case 'date-move-unsupported':
      return 'To move a booking to a different day, cancel it and book the new day — that keeps your co-working days right.';
    default:
      return 'We couldn’t change that booking — please try again.';
  }
}

/** Dashboard card: the member's upcoming room/pod bookings, with cancel. */
export function MyBookingsCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Inline "amend" (change date/time, same room) editor — one booking at a time.
  const [editId, setEditId] = useState<string | null>(null);
  const [eDate, setEDate] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  async function refresh() {
    const [b, s] = await Promise.all([getMyBookings(), getSpaces()]);
    if (s.ok) {
      const map: Record<string, string> = {};
      for (const sp of s.data.spaces) map[sp.id] = sp.name;
      setSpaceNames(map);
    }
    if (b.ok) setBookings(sortBookings(b.data.bookings));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function cancel(id: string) {
    setBusy(true);
    await cancelBooking(id);
    await refresh();
    setBusy(false);
  }

  function openEdit(b: MyBooking) {
    setEditId(b.id);
    setEDate(b.date);
    setEStart(minToHHMM(b.startMin));
    setEEnd(minToHHMM(b.endMin));
    setError(null);
  }

  async function saveAmend(id: string) {
    if (eEnd <= eStart) {
      setError('The end time must be after the start.');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await amendBooking(id, eDate, eStart, eEnd);
    if (!r.ok) {
      setError(amendError((r.data as { error?: string })?.error));
      setBusy(false);
      return;
    }
    setEditId(null);
    await refresh();
    setBusy(false);
  }

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>Meeting Room &amp; Pod Bookings</span>
      {loading ? (
        <p className={styles.meta}>Loading…</p>
      ) : bookings.length === 0 ? (
        <>
          <p className={styles.meta}>No upcoming room or pod bookings.</p>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" href="/book">
              Book a room or pod
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className={styles.list}>
            {bookings.map((b) => (
              <li key={b.id} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowMain}>{spaceNames[b.space ?? ''] ?? 'Room'}</span>
                  <span className={styles.rowSub}>
                    {dayLabel(b.date)} · {minToHHMM(b.startMin)}–{minToHHMM(b.endMin)}
                  </span>
                </span>
                {b.kind === 'Member' ? (
                  <span className={styles.rowBtns}>
                    <button
                      type="button"
                      className={styles.amend}
                      onClick={() => (editId === b.id ? setEditId(null) : openEdit(b))}
                      disabled={busy && editId !== b.id}
                    >
                      {editId === b.id ? 'Close' : 'Amend'}
                    </button>
                    <button type="button" className={styles.cancel} onClick={() => cancel(b.id)} disabled={busy}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className={styles.note}>Paid booking · contact us to change</span>
                )}

                {editId === b.id ? (
                  <div className={styles.editor}>
                    <label className={styles.field}>
                      <span>Date</span>
                      <input type="date" value={eDate} min={todayIso} onChange={(e) => setEDate(e.target.value)} />
                    </label>
                    <label className={styles.field}>
                      <span>From</span>
                      <select value={eStart} onChange={(e) => setEStart(e.target.value)}>
                        {TIMES.slice(0, -1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>To</span>
                      <select value={eEnd} onChange={(e) => setEEnd(e.target.value)}>
                        {TIMES.filter((t) => t > eStart).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={styles.editActions}>
                      <Button size="sm" variant="primary" onClick={() => saveAmend(b.id)} disabled={busy}>
                        Save change
                      </Button>
                    </div>
                    {error ? <p className={styles.error}>{error}</p> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" href="/book">
              Book another
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
