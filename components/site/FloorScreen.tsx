'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { DatePickerModal } from './DatePickerModal';
import { Icon } from '@/components/ds/Icon';
import styles from './FloorScreen.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * Public-screen privacy: render a stored full name as "First L" (first name + last-name
 * initial, e.g. "Nicholas H"). Stored data is untouched — only the on-wall display is
 * shortened so a member's surname is never shown on a public floor screen.
 */
function shortName(full: string | null | undefined): string {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`;
}

/** Minutes since midnight in Europe/London — timezone-safe for the "now / soon" tint. */
function londonNowMin(): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const h = p.hour === '24' ? 0 : Number(p.hour);
  return h * 60 + Number(p.minute);
}

/** A room counts as "hot" (pastel-red) when occupied now OR a booking starts within 30 min. */
const SOON_MIN = 30;

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

interface RoomView {
  hot: boolean;
  current: FloorBooking | null;
  next: FloorBooking | null;
  schedule: FloorBooking[];
}

function roomView(space: FloorSpace, bookings: FloorBooking[], nowMin: number): RoomView {
  const active = bookings.filter((b) => b.space === space.id && !b.released);
  const schedule = active.filter((b) => b.endMin > nowMin).sort((a, b) => a.startMin - b.startMin);
  const current = active.find((b) => b.startMin <= nowMin && nowMin < b.endMin) || null;
  const next = active.filter((b) => b.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0] || null;
  const soon = !current && !!next && next.startMin - nowMin <= SOON_MIN;
  return { hot: !!current || soon, current, next, schedule };
}

function Schedule({ items, nowMin }: { items: FloorBooking[]; nowMin: number }) {
  if (!items.length) return <p className={styles.schedNone}>No bookings today</p>;
  return (
    <ul className={styles.schedList}>
      {items.map((b) => {
        const live = b.startMin <= nowMin && nowMin < b.endMin;
        return (
          <li key={b.id} className={`${styles.schedRow} ${live ? styles.schedRowNow : ''}`}>
            <span className={styles.schedTime}>
              {minToHHMM(b.startMin)}–{minToHHMM(b.endMin)}
            </span>
            <span className={styles.schedName}>{shortName(b.name) || 'Reserved'}</span>
            {live ? <span className={styles.schedNow}>Now</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * On-screen reserve / check-in panel (rooms & pods only). Offers BOTH an hour picker to
 * book the room now AND a check-in for an existing booking today — each attributed via a
 * privacy-safe member name lookup (kioskMemberSearch → { id, name }, no browsable list).
 * Rendered as a fitted, self-scrolling fixed overlay so opening it never scrolls the page.
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
  // Default to the slot the current time falls IN (e.g. 16:00 at 16:01) so a walk-up books
  // "now"; before opening → the first slot; after the last start → the last slot.
  const firstStart = [...startOptions].reverse().find((m) => m <= nowMin) ?? startOptions[0] ?? openMin;
  const [start, setStart] = useState<number>(firstStart);
  const [end, setEnd] = useState<number>(Math.min(firstStart + 60, closeMin));
  // Defaults to today; a discreet "another day" picker lets a walk-up book ahead without the app.
  const [bookDate, setBookDate] = useState<string>(date);
  const [dateOpen, setDateOpen] = useState(false);
  const isToday = bookDate === date;
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
      date: bookDate,
      start: minToHHMM(start),
      end: minToHHMM(end),
      memberId: picked.id,
    });
    setBusy(false);
    if (r.ok && r.data.ok) {
      const dayTxt = isToday ? '' : ` on ${new Date(`${bookDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
      setMsg(`Booked ${minToHHMM(start)}–${minToHHMM(end)}${dayTxt} for ${shortName(r.data.member || picked.name)}.`);
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

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <Icon name="x" size={28} />
        </button>
        <h3 className={styles.panelTitle}>{space.name}</h3>
        <p className={styles.panelMeta}>{roomMeta(space)}</p>

        <section className={styles.panelBlock}>
          <h4 className={styles.panelH4}>
            <Icon name="clock" size={22} /> Reserve {isToday ? 'now' : 'ahead'}
          </h4>
          <div className={styles.dayRow}>
            <span className={styles.pickLabel}>Day</span>
            <button type="button" className={styles.dayBtn} onClick={() => setDateOpen(true)}>
              <Icon name="calendar" size={18} />
              {isToday ? 'Today' : new Date(`${bookDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              <span className={styles.dayBtnHint}>Change</span>
            </button>
            {!isToday ? (
              <button type="button" className={styles.linkBtn} onClick={() => setBookDate(date)}>
                Back to today
              </button>
            ) : null}
          </div>
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
                    {b.name ? ` · ${shortName(b.name)}` : ''}
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

        <DatePickerModal
          open={dateOpen}
          onClose={() => setDateOpen(false)}
          onPick={(d) => {
            setBookDate(d);
            setDateOpen(false);
          }}
          single
          planned={isToday ? [] : [bookDate]}
        />
      </div>
    </div>,
    document.body,
  );
}

function RoomCard({
  s,
  hero,
  solo = false,
  bookings,
  nowMin,
  origin,
  onOpen,
}: {
  s: FloorSpace;
  hero: boolean;
  solo?: boolean;
  bookings: FloorBooking[];
  nowMin: number;
  origin: string;
  onOpen: (id: string) => void;
}) {
  const v = roomView(s, bookings, nowMin);
  const sub = v.current
    ? `${v.current.name ? `for ${shortName(v.current.name)} · ` : ''}until ${minToHHMM(v.current.endMin)}`
    : v.next
      ? `Next ${minToHHMM(v.next.startMin)}${v.next.name ? ` · ${shortName(v.next.name)}` : ''}`
      : 'Free all day';
  const qrSize = solo ? 150 : hero ? 88 : 62;

  // The QR now sits IN FLOW beside the name (a flex row), not as an absolute corner chip, so the
  // full-width status pane below can never slide under it.
  const head = (
    <div className={styles.cardTop}>
      <div className={styles.cardHead}>
        <span className={styles.roomName}>{s.name}</span>
        <span className={styles.roomMeta}>{roomMeta(s)}</span>
      </div>
      {s.bookable ? (
        <div className={styles.qrChip}>
          <Qr value={`${origin}/kiosk?room=${encodeURIComponent(s.id)}`} size={qrSize} />
          <span className={styles.qrChipCaption}>Scan to reserve</span>
        </div>
      ) : null}
    </div>
  );
  const statusPane = (
    <div className={`${styles.statusPane} ${v.current ? styles.paneBusy : styles.paneFree}`}>
      <span className={styles.statusWord}>{v.current ? 'Reserved' : 'Available'}</span>
      <span className={styles.statusSub}>{sub}</span>
    </div>
  );
  const schedule = (
    <div className={styles.schedWrap}>
      <span className={styles.schedLabel}>
        <Icon name="calendar" size={hero ? 20 : 17} /> Today
      </span>
      <div className={styles.schedScroll}>
        <Schedule items={v.schedule} nowMin={nowMin} />
      </div>
    </div>
  );
  const tapBtn = s.bookable ? (
    <button className={styles.tapBtn} onClick={() => onOpen(s.id)}>
      <Icon name="door-open" size={hero ? 26 : 22} /> Tap to book / check in
    </button>
  ) : null;

  // Solo floor (a single room, no workspaces): spread the content across a 2-column layout so
  // the big screen isn't mostly empty — identity + booking on one side, the day's schedule on the
  // other (stacks on portrait).
  if (solo) {
    return (
      <article className={`${styles.card} ${styles.cardHero} ${styles.soloCard} ${v.hot ? styles.hot : styles.calm}`}>
        <div className={styles.soloGrid}>
          <div className={styles.soloMain}>
            {head}
            {statusPane}
            {tapBtn}
          </div>
          <div className={styles.soloSide}>{schedule}</div>
        </div>
      </article>
    );
  }

  return (
    <article className={`${styles.card} ${hero ? styles.cardHero : ''} ${v.hot ? styles.hot : styles.calm}`}>
      {head}
      {statusPane}
      {schedule}
      {tapBtn}
    </article>
  );
}

function WorkspaceCard({ s, name, privatised }: { s: FloorSpace; name: string | null; privatised: boolean }) {
  const disp = shortName(name);
  return (
    <article className={`${styles.card} ${styles.wsCard} ${privatised ? styles.hot : styles.calm}`}>
      <div className={styles.cardHead}>
        <span className={styles.roomName}>{s.name}</span>
        <span className={styles.roomMeta}>Workspace</span>
      </div>
      <div className={`${styles.statusPane} ${privatised ? styles.paneBusy : styles.paneFree}`}>
        <span className={styles.statusWord}>{privatised ? 'Privatised' : 'Available'}</span>
        <span className={styles.statusSub}>{privatised ? (disp ? `for ${disp}` : 'Reserved today') : 'Open to all members'}</span>
      </div>
    </article>
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

  // Poll every 30s, and re-fetch immediately whenever the kiosk regains focus /
  // becomes visible (wake from Guided Access, tab switch) so it's never stale.
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onWake = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // `now` ticks every 30s (below): it re-renders the clock AND re-evaluates londonNowMin()
  // so the pastel-red "now / soon" tint stays current.
  const nowMin = londonNowMin();
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
  // A floor with a single room and no workspaces (e.g. first floor = Knight's Tale) gets a
  // spread-out solo layout so the large display isn't left mostly empty.
  const solo = rooms.length === 1 && workspaces.length === 0;
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
      ) : (
        <div className={styles.body}>
          <section className={styles.roomsBlock}>
            <h2 className={styles.h2}>Rooms &amp; pods</h2>
            <div className={`${styles.roomGrid} ${hero ? styles.hasHero : ''} ${solo ? styles.soloWrap : ''}`}>
              {hero ? (
                <RoomCard s={hero} hero solo={solo} bookings={bookings} nowMin={nowMin} origin={origin} onOpen={setOpenRoom} />
              ) : null}
              {otherRooms.map((s) => (
                <RoomCard key={s.id} s={s} hero={false} bookings={bookings} nowMin={nowMin} origin={origin} onOpen={setOpenRoom} />
              ))}
              {!rooms.length && loaded ? <p className={styles.empty}>No rooms on this floor.</p> : null}
            </div>
          </section>

          {workspaces.length ? (
            <section className={styles.wsBlock}>
              <h2 className={styles.h2}>Workspaces</h2>
              <div className={styles.wsGrid}>
                {workspaces.map((s) => {
                  const priv = privatisations.find((p) => p.space === s.id);
                  return <WorkspaceCard key={s.id} s={s} name={priv?.name ?? null} privatised={!!priv} />;
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {!loaded ? <p className={styles.loading}>Loading…</p> : null}

      {openSpace && data ? (
        <ReservePanel space={openSpace} data={data} onClose={() => setOpenRoom(null)} onDone={load} />
      ) : null}
    </div>
  );
}
