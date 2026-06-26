'use client';

import { useCallback, useEffect, useState } from 'react';
import { kioskRoom, type KioskRoom } from '@/lib/booking';
import styles from './KioskClient.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

function londonNowMin(): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const h = p.hour === '24' ? 0 : Number(p.hour);
  return h * 60 + Number(p.minute);
}

/**
 * Per-room kiosk. Shows live status + today's schedule, and a QR that opens the
 * room's booking page on the member's phone (logged into their own account). No
 * PIN, no kiosk input — works on a plain display too.
 */
export function KioskClient() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [data, setData] = useState<KioskRoom | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => londonNowMin());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRoomId(new URLSearchParams(window.location.search).get('room'));
  }, []);

  const load = useCallback(async () => {
    if (!roomId) return;
    const r = await kioskRoom(roomId);
    if (r.ok) setData(r.data);
    setLoaded(true);
  }, [roomId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNowMin(londonNowMin()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!roomId) {
    return (
      <div className={styles.kiosk}>
        <p className={styles.dim}>Set this screen to /kiosk?room=SPACE_ID</p>
      </div>
    );
  }
  if (!loaded || !data) {
    return (
      <div className={styles.kiosk}>
        <p className={styles.dim}>Loading…</p>
      </div>
    );
  }

  const { space, bookings, closeMin, weekday } = data;
  const current = bookings.find((b) => b.startMin <= nowMin && nowMin < b.endMin);
  const free = !current && weekday && nowMin < closeMin;

  const statusText = !weekday
    ? 'Closed today'
    : current
      ? `Busy until ${minToHHMM(current.endMin)}`
      : nowMin >= closeMin
        ? 'Closed for today'
        : 'Available now';

  const bookUrl = typeof window !== 'undefined' ? `${window.location.origin}/book?room=${encodeURIComponent(roomId)}` : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(bookUrl)}`;

  return (
    <div className={`${styles.kiosk} ${free ? styles.kFree : styles.kBusy}`}>
      <div className={styles.header}>
        <span className={styles.roomName}>{space.name}</span>
        <span className={styles.roomMeta}>
          {space.type === 'Phone pod' ? 'Phone pod' : `Meeting room${space.capacityLabel ? ` · up to ${space.capacityLabel}` : ''}`}
        </span>
      </div>

      <div className={styles.statusBig}>{statusText}</div>

      {space.bookable ? (
        <div className={styles.qrBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.qr} src={qrUrl} alt="Scan to book" width={200} height={200} />
          <span className={styles.qrLabel}>Scan to book on your phone</span>
        </div>
      ) : null}

      {bookings.length ? (
        <div className={styles.schedule}>
          <span className={styles.schedTitle}>Today</span>
          {bookings.map((b, i) => (
            <div key={i} className={styles.schedRow}>
              <span>
                {minToHHMM(b.startMin)}–{minToHHMM(b.endMin)}
              </span>
              <span className={styles.schedKind}>{b.kind === 'Block' ? 'Reserved' : 'Booked'}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
