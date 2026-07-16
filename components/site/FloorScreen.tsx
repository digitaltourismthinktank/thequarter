'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getFloorScreen,
  kioskMemberSearch,
  kioskBookFor,
  kioskCheckinBooking,
  type FloorScreenData,
  type FloorSpace,
  type FloorBooking,
  type MemberMatch,
} from '@/lib/booking';
import { Qr } from '@/components/ds/Qr';
import { Icon } from '@/components/ds/Icon';
import styles from './FloorScreen.module.css';

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

const normName = (s: string) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[‘’ʼ′]/g, "'")
    .replace(/\s+/g, ' ');

const isChapterHouse = (name: string) => normName(name) === 'the chapter house';

function roomMeta(s: FloorSpace): string {
  if (s.type === 'Phone pod') return 'Phone pod';
  const cap = s.capacityLabel || (s.capacity != null ? String(s.capacity) : null);
  return `Meeting room${cap ? ` · up to ${cap}` : ''}`;
}

interface RoomStatus {
  busy: boolean;
  text: string;
  sub: string | null;
}

function roomStatus(space: FloorSpace, bookings: FloorBooking[], nowMin: number): RoomStatus {
  const active = bookings.filter((b) => b.space === space.id && !b.released);
  const current = active.find((b) => b.startMin <= nowMin && nowMin < b.endMin);
  if (current) {
    const who = current.name ? ` for ${current.name}` : '';
    return { busy: true, text: `Reserved${who}`, sub: `Until ${minToHHMM(current.endMin)}` };
  }
  const next = active.filter((b) => b.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0];
  return {
    busy: false,
    text: 'Available',
    sub: next ? `Next${next.name ? ` · ${next.name}` : ''} at ${minToHHMM(next.startMin)}` : null,
  };
}

/**
 * On-screen reserve / check-in panel (rooms & pods only). Offers BOTH an hour picker to
 * book the room now AND a check-in for an existing booking today — each attributed via a
 * privacy-safe member name lookup (kioskMemberSearch → { id, name }, no browsable list).
 */
function ReservePanel({
  space,
  data,
  onClose,
  onDone,
}: {
  space: FloorSpace;
  data: FloorScreenData;
  onClose: () => void;
  onDone: () => void;
}) {
  const { openMin, closeMin, slotMin, date } = data;
  const startOptions = useMemo(() => {
    const out: number[] = [];
    for (let m = openMin; m < closeMin; m += slotMin) out.push(m);
    return out;
  }, [openMin, closeMin, slotMin]);

  const nowMin = londonNowMin();
  const firstStart = startOptions.find((m) => m >= nowMin) ?? startOptions[0] ?? openMin;
  const [start, setStart] = useState<number>(firstStart);
  const [end, setEnd] = useState<number>(Math.min(firstStart + 60, closeMin));
  const endOptions = useMemo(() => {
    const out: number[] = [];
    for (let m = start + slotMin; m <= closeMin; m += slotMin) out.push(m);
    return out;
  }, [start, slotMin, closeMin]);

  useEffect(() => {
    if (end <= start) setEnd(Math.min(start + slotMin, closeMin));
  }, [start, end, slotMin, closeMin]);

  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<MemberMatch[]>([]);
  const [picked, setPicked] = useState<MemberMatch | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await kioskMemberSearch(value.trim());
      setMatches(r.ok ? r.data.members : []);
      setSearching(false);
    }, 250);
  }, []);

  const errorText = (code?: string) => {
    switch (code) {
      case 'slot-taken':
        return 'That time was just taken — pick another.';
      case 'outside-hours':
        return 'Choose a time within opening hours.';
      case 'closed-weekend':
        return 'The Quarter is closed at weekends.';
      case 'unknown-member':
        return 'Couldn’t find that member — search again.';
      default:
        return 'Something went wrong — try again.';
    }
  };

  async function reserve() {
    if (!picked || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await kioskBookFor({
      spaceId: space.id,
      date,
      start: minToHHMM(start),
      end: minToHHMM(end),
      memberId: picked.id,
    });
    setBusy(false);
    if (r.ok && r.data.ok) {
      setMsg(`Booked ${minToHHMM(start)}–${minToHHMM(end)} for ${r.data.member || picked.name}.`);
      onDone();
      setTimeout(onClose, 1400);
    } else {
      setMsg(errorText(r.data.error));
    }
  }

  const todays = data.bookings
    .filter((b) => b.space === space.id && !b.released)
    .sort((a, b) => a.startMin - b.startMin);

  async function checkIn(id: string) {
    setBusy(true);
    await kioskCheckinBooking(id);
    onDone();
    setBusy(false);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <Icon name="x" size={28} />
        </button>
        <h3 className={styles.panelTitle}>{space.name}</h3>
        <p className={styles.panelMeta}>{roomMeta(space)}</p>

        <section className={styles.panelBlock}>
          <h4 className={styles.panelH4}>
            <Icon name="clock" size={22} /> Reserve now
          </h4>
          <div className={styles.pickRow}>
            <label className={styles.pickField}>
              <span className={styles.pickLabel}>From</span>
              <select className={styles.select} value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {startOptions.map((m) => (
                  <option key={m} value={m}>
                    {minToHHMM(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.pickField}>
              <span className={styles.pickLabel}>To</span>
              <select className={styles.select} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
                {endOptions.map((m) => (
                  <option key={m} value={m}>
                    {minToHHMM(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.pickLabel}>Whose booking?</span>
            {picked ? (
              <div className={styles.pickedRow}>
                <span className={styles.pickedName}>
                  <Icon name="badge-check" size={22} /> {picked.name}
                </span>
                <button
                  className={styles.linkBtn}
                  onClick={() => {
                    setPicked(null);
                    setQ('');
                    setMatches([]);
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className={styles.searchBox}>
                  <Icon name="search" size={22} />
                  <input
                    className={styles.input}
                    value={q}
                    placeholder="Type a name (min 2 letters)…"
                    autoFocus
                    onChange={(e) => {
                      setQ(e.target.value);
                      runSearch(e.target.value);
                    }}
                  />
                </div>
                {searching ? <p className={styles.hint}>Searching…</p> : null}
                {!searching && q.trim().length >= 2 && matches.length === 0 ? (
                  <p className={styles.hint}>No matches.</p>
                ) : null}
                {matches.length ? (
                  <ul className={styles.matchList}>
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button className={styles.matchBtn} onClick={() => setPicked(m)}>
                          {m.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <button className={styles.primaryBtn} onClick={reserve} disabled={!picked || busy}>
            {busy ? 'One moment…' : `Reserve ${minToHHMM(start)}–${minToHHMM(end)}`}
          </button>
        </section>

        {todays.length ? (
          <section className={styles.panelBlock}>
            <h4 className={styles.panelH4}>
              <Icon name="door-open" size={22} /> Check in
            </h4>
            <ul className={styles.checkList}>
              {todays.map((b) => (
                <li key={b.id} className={styles.checkRow}>
                  <span>
                    {minToHHMM(b.startMin)}–{minToHHMM(b.endMin)}
                    {b.name ? ` · ${b.name}` : ''}
                  </span>
                  {b.kind === 'Block' || b.kind === 'Privatisation' ? (
                    <span className={styles.checkKind}>Reserved</span>
                  ) : (
                    <button className={styles.checkBtn} disabled={busy} onClick={() => checkIn(b.id)}>
                      Check in
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {msg ? <p className={styles.msg}>{msg}</p> : null}
      </div>
    </div>
  );
}

function RoomCard({
  s,
  big,
  bookings,
  nowMin,
  origin,
  onOpen,
}: {
  s: FloorSpace;
  big: boolean;
  bookings: FloorBooking[];
  nowMin: number;
  origin: string;
  onOpen: (id: string) => void;
}) {
  const st = roomStatus(s, bookings, nowMin);
  return (
    <button
      className={`${styles.roomCard} ${big ? styles.roomCardBig : ''} ${st.busy ? styles.busy : styles.free}`}
      onClick={() => onOpen(s.id)}
    >
      <div className={styles.roomHead}>
        <span className={styles.roomName}>{s.name}</span>
        <span className={styles.roomMeta}>{roomMeta(s)}</span>
      </div>
      <div className={styles.statusWrap}>
        <span className={`${styles.status} ${st.busy ? styles.statusBusy : styles.statusFree}`}>{st.text}</span>
        {st.sub ? <span className={styles.statusSub}>{st.sub}</span> : null}
      </div>
      {s.bookable ? (
        <div className={styles.qrWrap}>
          <Qr value={`${origin}/kiosk?room=${encodeURIComponent(s.id)}`} size={big ? 168 : 128} />
          <span className={styles.qrCaption}>Scan to reserve · tap to book</span>
        </div>
      ) : null}
    </button>
  );
}

export function FloorScreen({ floor }: { floor: number }) {
  const [data, setData] = useState<FloorScreenData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [openRoom, setOpenRoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getFloorScreen(floor);
    if (r.ok) setData(r.data);
    setLoaded(true);
  }, [floor]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dateLabel = now.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });
  const floorLabel = floor === 1 ? 'First floor' : 'Second floor';

  const spaces = data?.spaces || [];
  const bookings = data?.bookings || [];
  const privatisations = data?.privatisations || [];
  const rooms = spaces.filter((s) => s.type !== 'Workspace');
  const workspaces = spaces.filter((s) => s.type === 'Workspace');
  const hero = rooms.find((s) => isChapterHouse(s.name)) || (rooms.length === 1 ? rooms[0] : null);
  const otherRooms = rooms.filter((s) => s !== hero);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const openSpace = openRoom ? rooms.find((s) => s.id === openRoom) || null : null;

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
        <span className={styles.floorTag}>{floorLabel}</span>
        <div className={styles.when}>
          <div className={styles.date}>{dateLabel}</div>
          <div className={styles.time}>{timeLabel}</div>
        </div>
      </header>

      {data && data.weekday === false ? (
        <section className={styles.closed}>
          <span className={styles.closedLabel}>Closed today</span>
          <p className={styles.closedLine}>We’re a weekday space — see you Monday to Friday.</p>
        </section>
      ) : null}

      <section className={styles.block}>
        <h2 className={styles.h2}>Rooms &amp; pods</h2>
        {hero ? (
          <div className={styles.heroRow}>
            <RoomCard s={hero} big bookings={bookings} nowMin={nowMin} origin={origin} onOpen={setOpenRoom} />
          </div>
        ) : null}
        {otherRooms.length ? (
          <div className={styles.roomGrid}>
            {otherRooms.map((s) => (
              <RoomCard key={s.id} s={s} big={false} bookings={bookings} nowMin={nowMin} origin={origin} onOpen={setOpenRoom} />
            ))}
          </div>
        ) : null}
        {!rooms.length && loaded ? <p className={styles.empty}>No rooms on this floor.</p> : null}
      </section>

      {workspaces.length ? (
        <section className={styles.block}>
          <h2 className={styles.h2}>Workspaces</h2>
          <div className={styles.roomGrid}>
            {workspaces.map((s) => {
              const priv = privatisations.find((p) => p.space === s.id);
              return (
                <div key={s.id} className={`${styles.roomCard} ${priv ? styles.busy : styles.free}`}>
                  <div className={styles.roomHead}>
                    <span className={styles.roomName}>{s.name}</span>
                    <span className={styles.roomMeta}>Workspace</span>
                  </div>
                  <div className={styles.statusWrap}>
                    <span className={`${styles.status} ${priv ? styles.statusBusy : styles.statusFree}`}>
                      {priv ? `Privatised${priv.name ? ` for ${priv.name}` : ''}` : 'Available'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loaded ? <p className={styles.loading}>Loading…</p> : null}

      {openSpace && data ? (
        <ReservePanel space={openSpace} data={data} onClose={() => setOpenRoom(null)} onDone={load} />
      ) : null}
    </div>
  );
}
