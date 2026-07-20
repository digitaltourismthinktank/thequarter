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
  amendBooking,
  sortBookings,
  type Space,
  type MyBooking,
} from '@/lib/booking';
import { WeekStrip } from './WeekStrip';
import { DatePickerModal } from './DatePickerModal';
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
/** 08:00–18:00 in 30-minute steps, for the amend pickers (mirrors the server's window). */
const AMEND_TIMES: string[] = [];
for (let m = 8 * 60; m <= 18 * 60; m += SLOT) AMEND_TIMES.push(minToHHMM(m));

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
function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

export function BookingClient() {
  const { loading, member } = useMember();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => nextWeekdays(1)[0]);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [start, setStart] = useState<number | null>(null); // pending start tap
  const [hover, setHover] = useState<number | null>(null); // slot under the cursor (block preview)
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null); // committed range
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [busyAction, setBusyAction] = useState(false);
  // Inline amend (move a booking's date/time, same room) — parity with the dashboard,
  // which already allowed this while the Book tab only offered Cancel.
  const [editId, setEditId] = useState<string | null>(null);
  const [eDate, setEDate] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [amendErr, setAmendErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

  const loadMine = useCallback(async () => {
    const r = await getMyBookings();
    if (r.ok) setMine(sortBookings(r.data.bookings));
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSpaces();
      if (s.ok) {
        setSpaces(s.data.spaces);
        // Preselect a room only from ?room= (e.g. a kiosk QR). Otherwise no room is
        // chosen by default — members pick the room that fits before booking.
        const wanted = new URLSearchParams(window.location.search).get('room');
        const pre = wanted ? s.data.spaces.find((x) => x.id === wanted)?.id : null;
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

  function openEdit(b: MyBooking) {
    setEditId(b.id);
    setEDate(b.date);
    setEStart(minToHHMM(b.startMin));
    setEEnd(minToHHMM(b.endMin));
    setAmendErr(null);
  }

  async function saveAmend(id: string) {
    if (eEnd <= eStart) {
      setAmendErr('The end time must be after the start.');
      return;
    }
    setBusyAction(true);
    setAmendErr(null);
    const r = await amendBooking(id, eDate, eStart, eEnd);
    if (!r.ok) {
      setAmendErr(friendly((r.data as { error?: string } | undefined)?.error));
      setBusyAction(false);
      return;
    }
    setEditId(null);
    await loadMine();
    await reloadAvail();
    setBusyAction(false);
  }

  if (loading) return <p className={styles.state}>Loading…</p>;
  if (!member) return <p className={styles.state}>Please sign in — taking you to the login page…</p>;

  const open = avail?.openMin ?? 8 * 60;
  const close = avail?.closeMin ?? 18 * 60;
  // Times that have already passed are noise you have to read past — on today, start the
  // grid at the next bookable slot. Other days are unaffected.
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = date === toISO(new Date());
  const firstSlot = isToday ? Math.ceil(nowMinutes / SLOT) * SLOT : open;
  const slots: number[] = [];
  for (let s = Math.max(open, firstSlot); s < close; s += SLOT) slots.push(s);
  const spaceName = (id: string | null) => spaces.find((x) => x.id === id)?.name ?? 'Room';

  const hint = sel
    ? `Selected ${fmtRange(sel.start, sel.end)}`
    : start !== null
      ? `Start ${minToHHMM(start)} — now tap your end time`
      : 'Tap a start time, then an end time (or use a preset)';

  // While choosing an end time, preview the whole block from the start to the
  // hovered slot, so it's obvious you're booking the range (not a single slot).
  const previewRange =
    start !== null && !sel && hover !== null && hover !== start
      ? (() => {
          const lo = Math.min(start, hover);
          const hi = Math.max(start, hover) + SLOT;
          return rangeFree(lo, hi) ? { lo, hi } : null;
        })()
      : null;

  return (
    <div>
      <div className={styles.head}>
        <h1 className={styles.title}>Book a room or pod</h1>
        <a className={`${styles.back} ${styles.backDesktop}`} href="/dashboard">
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

      {!spaceId ? (
        <p className={styles.state}>Choose a room or pod above to see its availability.</p>
      ) : (
        <>
          <div className={styles.bookDate}>
            <WeekStrip value={date} onSelect={setDate} />
            <button type="button" className={styles.dateBtn} onClick={() => setPickerOpen(true)}>
              + Pick a date
            </button>
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
            <div className={styles.grid} onMouseLeave={() => setHover(null)}>
              {slots.map((s) => {
                const isBusy = slotBusy(s);
                const isSel = !!sel && s >= sel.start && s < sel.end;
                const isStart = start === s && !sel;
                const isPreview = !!previewRange && s >= previewRange.lo && s < previewRange.hi;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isBusy}
                    onClick={() => clickSlot(s)}
                    onMouseEnter={() => setHover(s)}
                    className={`${styles.slot} ${isBusy ? styles.slotBusy : ''} ${isSel ? styles.slotSel : ''} ${isStart ? styles.slotStart : ''} ${isPreview ? styles.slotPreview : ''}`}
                  >
                    {minToHHMM(s)}
                  </button>
                );
              })}
            </div>
          )}

          {isWeekendISO(date) ? (
            <p className={styles.weekendNote}>
              {dayLabel(date)} is a weekend — outside our regular Monday–Friday hours, but the space is yours to book as a
              member.
            </p>
          ) : null}

          <div className={styles.confirm}>
            <span className={styles.selLabel}>
              {sel ? `${spaceName(spaceId)} · ${dayLabel(date)} · ${fmtRange(sel.start, sel.end)}` : 'Choose a time above.'}
            </span>
            <Button variant="primary" onClick={confirm} disabled={!sel || busyAction}>
              {busyAction ? 'Booking…' : isWeekendISO(date) ? 'Book the weekend' : 'Confirm booking'}
            </Button>
          </div>
          {msg ? <p className={styles.msg}>{msg}</p> : null}
        </>
      )}

      {mine.length ? (
        <div className={styles.mine}>
          <h2 className={styles.mineTitle}>Your upcoming bookings</h2>
          {mine.map((b) => (
            <div key={b.id} className={styles.mineRow}>
              <span>
                {spaceName(b.space)} · {dayLabel(b.date)} · {fmtRange(b.startMin, b.endMin)}
              </span>
              <span className={styles.mineBtns}>
                {b.kind === 'Member' ? (
                  <button
                    type="button"
                    className={styles.amend}
                    onClick={() => (editId === b.id ? setEditId(null) : openEdit(b))}
                    disabled={busyAction && editId !== b.id}
                  >
                    {editId === b.id ? 'Close' : 'Amend'}
                  </button>
                ) : null}
                <button type="button" className={styles.cancel} onClick={() => cancel(b.id)} disabled={busyAction}>
                  Cancel
                </button>
              </span>
              {editId === b.id ? (
                <div className={styles.amendEditor}>
                  <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                  <select value={eStart} onChange={(e) => setEStart(e.target.value)}>
                    {AMEND_TIMES.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select value={eEnd} onChange={(e) => setEEnd(e.target.value)}>
                    {AMEND_TIMES.filter((t) => t > eStart).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="primary" onClick={() => saveAmend(b.id)} disabled={busyAction}>
                    Save
                  </Button>
                  {amendErr ? <p className={styles.amendErr}>{amendErr}</p> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <DatePickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={setDate} single allowWeekend planned={[date]} />
    </div>
  );
}

function friendly(code?: string): string {
  switch (code) {
    case 'slot-taken':
      return 'Sorry, that slot was just taken — pick another.';
    case 'double-book':
      return 'You already have a booking at that time — cancel it first to book another room.';
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
