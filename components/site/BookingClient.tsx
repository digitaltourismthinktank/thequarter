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
import { WeekStrip } from './WeekStrip';
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
  const [date, setDate] = useState<string>(() => nextWeekdays(1)[0]);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [start, setStart] = useState<number | null>(null); // pending start tap
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null); // committed range
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
        // Preselect a room from ?room= (e.g. scanned from a kiosk QR), else the first.
        const wanted = new URLSearchParams(window.location.search).get('room');
        const pre = (wanted && s.data.spaces.find((x) => x.id === wanted)?.id) || s.data.spaces[0]?.id;
        if (pre) setSpaceId(pre);
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
    setStart(null);
    setSel(null);
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

  const slotBusy = (s: number) => (avail?.busy || []).some((b) => s < b.endMin && s + SLOT > b.startMin);
  const rangeFree = (lo: number, hi: number) => {
    for (let s = lo; s < hi; s += SLOT) if (slotBusy(s)) return false;
    return true;
  };

  // Two-tap selection: tap a start time, then an end time.
  function clickSlot(s: number) {
    setMsg(null);
    if (slotBusy(s)) return;
    if (sel) {
      // already have a range -> start a fresh selection
      setSel(null);
      setStart(s);
      return;
    }
    if (start === null) {
      setStart(s); // first tap = start
      return;
    }
    const lo = Math.min(start, s);
    const hi = Math.max(start, s) + SLOT; // end tap is inclusive
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setStart(null);
    } else {
      setStart(s); // crossed a busy slot -> restart here
    }
  }

  function preset(lo: number, hi: number) {
    setMsg(null);
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setStart(null);
    } else {
      setMsg('That block isn’t free.');
    }
  }

  function clearSel() {
    setStart(null);
    setSel(null);
    setMsg(null);
  }

  async function confirm() {
    if (!sel || !spaceId) return;
    setBusyAction(true);
    setMsg(null);
    const r = await createBooking({ spaceId, date, start: minToHHMM(sel.start), end: minToHHMM(sel.end) });
    if (r.ok) {
      setMsg('Booked ✓');
      clearSel();
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

  const hint = sel
    ? `Selected ${fmtRange(sel.start, sel.end)}`
    : start !== null
      ? `Start ${minToHHMM(start)} — now tap your end time`
      : 'Tap a start time, then an end time (or use a preset)';

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

      <WeekStrip value={date} onSelect={setDate} />

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

      <div className={styles.hintRow}>
        <span className={styles.hint}>{hint}</span>
        {start !== null || sel ? (
          <button type="button" className={styles.clear} onClick={clearSel}>
            Clear
          </button>
        ) : null}
      </div>

      {loadingAvail ? (
        <p className={styles.state}>Checking availability…</p>
      ) : (
        <div className={styles.grid}>
          {slots.map((s) => {
            const isBusy = slotBusy(s);
            const isSel = !!sel && s >= sel.start && s < sel.end;
            const isStart = start === s && !sel;
            return (
              <button
                key={s}
                type="button"
                disabled={isBusy}
                onClick={() => clickSlot(s)}
                className={`${styles.slot} ${isBusy ? styles.slotBusy : ''} ${isSel ? styles.slotSel : ''} ${isStart ? styles.slotStart : ''}`}
              >
                {minToHHMM(s)}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.confirm}>
        <span className={styles.selLabel}>
          {sel ? `${spaceName(spaceId)} · ${dayLabel(date)} · ${fmtRange(sel.start, sel.end)}` : 'Choose a time above.'}
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
    case 'closed-day':
      return 'The Quarter is closed that day (bank holiday or seasonal closure).';
    case 'bad-increment':
      return 'Please use 30-minute increments.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Could not book — please try again.';
  }
}
