'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember } from './useMember';
import {
  getSpaces,
  getAvailability,
  getMyBookings,
  createBooking,
  cancelBooking,
  type Space,
  type MyBooking,
} from '@/lib/booking';
import styles from './BookingClient.module.css';

const SLOT = 30;

interface Avail {
  openMin: number;
  closeMin: number;
  slotMin: number;
  busy: { startMin: number; endMin: number }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fmtRange = (a: number, b: number) => `${minToHHMM(a)}–${minToHHMM(b)}`;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nextWeekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < n) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) out.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function BookingClient() {
  const { loading, member } = useMember();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [days] = useState<string[]>(() => nextWeekdays(10));
  const [date, setDate] = useState<string>(() => nextWeekdays(1)[0]);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [busyAction, setBusyAction] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

  const loadMine = useCallback(async () => {
    const r = await getMyBookings();
    if (r.ok) setMine(r.data.bookings);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSpaces();
      if (s.ok) {
        setSpaces(s.data.spaces);
        if (s.data.spaces[0]) setSpaceId(s.data.spaces[0].id);
      }
      await loadMine();
    })();
  }, [loadMine]);

  const reloadAvail = useCallback(async () => {
    if (!spaceId || !date) return;
    const r = await getAvailability(spaceId, date);
    if (r.ok) setAvail(r.data);
  }, [spaceId, date]);

  useEffect(() => {
    if (!spaceId || !date) return;
    let active = true;
    setLoadingAvail(true);
    setSel(null);
    setAnchor(null);
    (async () => {
      const r = await getAvailability(spaceId, date);
      if (!active) return;
      setAvail(r.ok ? r.data : null);
      setLoadingAvail(false);
    })();
    return () => {
      active = false;
    };
  }, [spaceId, date]);

  const slotBusy = (start: number) => (avail?.busy || []).some((b) => start < b.endMin && start + SLOT > b.startMin);
  const rangeFree = (lo: number, hi: number) => {
    for (let s = lo; s < hi; s += SLOT) if (slotBusy(s)) return false;
    return true;
  };

  function clickSlot(s: number) {
    setMsg(null);
    if (slotBusy(s)) return;
    if (anchor === null) {
      setAnchor(s);
      setSel({ start: s, end: s + SLOT });
      return;
    }
    const lo = Math.min(anchor, s);
    const hi = Math.max(anchor, s) + SLOT;
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setAnchor(null);
    } else {
      setAnchor(s);
      setSel({ start: s, end: s + SLOT });
    }
  }

  function preset(lo: number, hi: number) {
    setMsg(null);
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setAnchor(null);
    } else {
      setMsg('That block isn’t free.');
    }
  }

  async function confirm() {
    if (!sel || !spaceId) return;
    setBusyAction(true);
    setMsg(null);
    const r = await createBooking({ spaceId, date, start: minToHHMM(sel.start), end: minToHHMM(sel.end) });
    if (r.ok) {
      setMsg('Booked ✓');
      setSel(null);
      setAnchor(null);
      await reloadAvail();
      await loadMine();
    } else {
      setMsg(friendly(r.data?.error));
    }
    setBusyAction(false);
  }

  async function cancel(id: string) {
    setBusyAction(true);
    await cancelBooking(id);
    await loadMine();
    await reloadAvail();
    setBusyAction(false);
  }

  if (loading) return <p className={styles.state}>Loading…</p>;
  if (!member) return <p className={styles.state}>Please sign in — taking you to the login page…</p>;

  const open = avail?.openMin ?? 8 * 60;
  const close = avail?.closeMin ?? 18 * 60;
  const slots: number[] = [];
  for (let s = open; s < close; s += SLOT) slots.push(s);
  const spaceName = (id: string | null) => spaces.find((x) => x.id === id)?.name ?? 'Room';

  return (
    <div>
      <div className={styles.head}>
        <h1 className={styles.title}>Book a room or pod</h1>
        <a className={styles.back} href="/dashboard">
          ← Dashboard
        </a>
      </div>

      <div className={styles.spaces}>
        {spaces.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.space} ${spaceId === s.id ? styles.spaceOn : ''}`}
            onClick={() => setSpaceId(s.id)}
          >
            <span className={styles.spaceName}>{s.name}</span>
            <span className={styles.spaceMeta}>
              {s.type === 'Phone pod' ? 'Phone pod' : `Up to ${s.capacityLabel ?? s.capacity ?? ''}`}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.days}>
        {days.map((d) => (
          <button key={d} type="button" className={`${styles.day} ${date === d ? styles.dayOn : ''}`} onClick={() => setDate(d)}>
            {dayLabel(d)}
          </button>
        ))}
      </div>

      <div className={styles.presets}>
        <button type="button" className={styles.preset} onClick={() => preset(8 * 60, 13 * 60)}>
          Morning · 08–13
        </button>
        <button type="button" className={styles.preset} onClick={() => preset(13 * 60, 18 * 60)}>
          Afternoon · 13–18
        </button>
        <button type="button" className={styles.preset} onClick={() => preset(8 * 60, 18 * 60)}>
          Full day
        </button>
      </div>

      {loadingAvail ? (
        <p className={styles.state}>Checking availability…</p>
      ) : (
        <div className={styles.grid}>
          {slots.map((s) => {
            const isBusy = slotBusy(s);
            const isSel = !!sel && s >= sel.start && s < sel.end;
            return (
              <button
                key={s}
                type="button"
                disabled={isBusy}
                onClick={() => clickSlot(s)}
                className={`${styles.slot} ${isBusy ? styles.slotBusy : ''} ${isSel ? styles.slotSel : ''}`}
              >
                {minToHHMM(s)}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.confirm}>
        <span className={styles.selLabel}>
          {sel ? `${spaceName(spaceId)} · ${dayLabel(date)} · ${fmtRange(sel.start, sel.end)}` : 'Tap slots or a preset to choose a time.'}
        </span>
        <Button variant="primary" onClick={confirm} disabled={!sel || busyAction}>
          {busyAction ? 'Booking…' : 'Confirm booking'}
        </Button>
      </div>
      {msg ? <p className={styles.msg}>{msg}</p> : null}

      {mine.length ? (
        <div className={styles.mine}>
          <h2 className={styles.mineTitle}>Your upcoming bookings</h2>
          {mine.map((b) => (
            <div key={b.id} className={styles.mineRow}>
              <span>
                {spaceName(b.space)} · {dayLabel(b.date)} · {fmtRange(b.startMin, b.endMin)}
              </span>
              <button type="button" className={styles.cancel} onClick={() => cancel(b.id)} disabled={busyAction}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function friendly(code?: string): string {
  switch (code) {
    case 'slot-taken':
      return 'Sorry, that slot was just taken — pick another.';
    case 'outside-hours':
      return 'Bookings are Monday–Friday, 08:00–18:00.';
    case 'closed-weekend':
      return 'The Quarter is open Monday to Friday.';
    case 'bad-increment':
      return 'Please use 30-minute increments.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Could not book — please try again.';
  }
}
