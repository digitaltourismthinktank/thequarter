'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { cn } from '@/lib/cn';
import { getMyBookings, getSpaces, cancelBooking, type MyBooking } from '@/lib/booking';
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

/** Dashboard card: the member's upcoming room/pod bookings, with cancel. */
export function MyBookingsCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [b, s] = await Promise.all([getMyBookings(), getSpaces()]);
    if (s.ok) {
      const map: Record<string, string> = {};
      for (const sp of s.data.spaces) map[sp.id] = sp.name;
      setSpaceNames(map);
    }
    if (b.ok) setBookings(b.data.bookings);
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

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>Your bookings</span>
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
                <button type="button" className={styles.cancel} onClick={() => cancel(b.id)} disabled={busy}>
                  Cancel booking
                </button>
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
