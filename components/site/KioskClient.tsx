'use client';

import { useCallback, useEffect, useState } from 'react';
import { kioskRoom, kioskBook, type KioskRoom } from '@/lib/booking';
import styles from './KioskClient.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const ceil30 = (m: number) => Math.ceil(m / 30) * 30;

function londonNowMin(): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const h = p.hour === '24' ? 0 : Number(p.hour);
  return h * 60 + Number(p.minute);
}

function friendly(code?: string): string {
  switch (code) {
    case 'bad-pin':
      return 'PIN not recognised — please try again.';
    case 'slot-taken':
      return 'Just taken — pick another time.';
    case 'closed-weekend':
      return 'Open Monday to Friday.';
    case 'outside-hours':
      return 'Bookings run 08:00–18:00.';
    default:
      return 'Could not book — please try again.';
  }
}

export function KioskClient() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [data, setData] = useState<KioskRoom | null>(null);
  const [nowMin, setNowMin] = useState<number>(() => londonNowMin());
  const [pending, setPending] = useState<{ start: number; end: number } | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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

  const { space, bookings, openMin, closeMin, weekday } = data;
  const current = bookings.find((b) => b.startMin <= nowMin && nowMin < b.endMin);
  const free = !current && weekday && nowMin < closeMin;
  const isFree = (s: number, e: number) => !bookings.some((b) => s < b.endMin && e > b.startMin);

  function startBook(durMin: number) {
    setMsg(null);
    const s = Math.max(openMin, ceil30(nowMin));
    const e = s + durMin;
    if (s >= closeMin || e > closeMin) {
      setMsg('No time left today.');
      return;
    }
    if (!isFree(s, e)) {
      setMsg('That time isn’t free — see today’s schedule.');
      return;
    }
    setPending({ start: s, end: e });
    setPin('');
  }
  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setMsg(null);
    const r = await kioskBook({ spaceId: roomId, date: data.date, start: minToHHMM(pending.start), end: minToHHMM(pending.end), pin });
    if (r.ok) {
      setMsg(`Booked for ${r.data.member}. Enjoy.`);
      setPending(null);
      setPin('');
      await load();
    } else {
      setMsg(friendly(r.data?.error));
    }
    setBusy(false);
  }

  const statusText = !weekday
    ? 'Closed today'
    : current
      ? `Busy until ${minToHHMM(current.endMin)}`
      : nowMin >= closeMin
        ? 'Closed for today'
        : 'Available now';

  return (
    <div className={`${styles.kiosk} ${free ? styles.kFree : styles.kBusy}`}>
      <div className={styles.header}>
        <span className={styles.roomName}>{space.name}</span>
        <span className={styles.roomMeta}>
          {space.type === 'Phone pod' ? 'Phone pod' : `Meeting room${space.capacityLabel ? ` · up to ${space.capacityLabel}` : ''}`}
        </span>
      </div>

      <div className={styles.statusBig}>{statusText}</div>

      {weekday && space.bookable && free ? (
        pending ? (
          <div className={styles.bookBox}>
            <p className={styles.bookLine}>
              Book {minToHHMM(pending.start)}–{minToHHMM(pending.end)} — enter your PIN
            </p>
            <input
              className={styles.pinInput}
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              aria-label="Booking PIN"
              autoFocus
            />
            <div className={styles.bookBtns}>
              <button type="button" className={styles.primary} onClick={confirm} disabled={busy || pin.length < 4}>
                Confirm
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setPending(null);
                  setMsg(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.bookBtns}>
            <button type="button" className={styles.primary} onClick={() => startBook(30)}>
              Book 30 min
            </button>
            <button type="button" className={styles.primary} onClick={() => startBook(60)}>
              Book 1 hour
            </button>
          </div>
        )
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

      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
