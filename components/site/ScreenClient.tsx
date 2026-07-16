'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getTodayScreen,
  getUpcomingEvents,
  type ScreenSpace,
  type ScreenBooking,
  type QuarterEvent,
} from '@/lib/booking';
import { busyness, meetingRoomLine, type Band } from '@/lib/busyness';
import { Icon } from '@/components/ds/Icon';
import { eventThemeIcon } from '@/lib/eventThemes';
import { FloorScreen } from './FloorScreen';
import styles from './ScreenClient.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

interface ScreenData {
  date: string;
  nowMin: number;
  spaces: ScreenSpace[];
  bookings: ScreenBooking[];
}

function statusFor(space: ScreenSpace, bookings: ScreenBooking[], nowMin: number): { busy: boolean; text: string } {
  const mine = bookings.filter((b) => b.space === space.id);
  const current = mine.find((b) => b.startMin <= nowMin && nowMin < b.endMin);
  if (current) {
    return { busy: true, text: `${current.kind === 'Block' ? 'Reserved' : 'Busy'} until ${minToHHMM(current.endMin)}` };
  }
  const next = mine.filter((b) => b.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0];
  const free = space.bookable ? 'Available' : 'Open';
  return { busy: false, text: next ? `${free} · next ${minToHHMM(next.startMin)}` : free };
}

function eventWhen(start: string): string {
  return new Date(start).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** One installed /screen app can BE any of these displays — persisted so a reopen returns to it. */
type ScreenChoice = 'entrance' | 'floor1' | 'floor2';
type ScreenView = ScreenChoice | 'chooser';
const SCREEN_KEY = 'q-screen';
const isChoice = (v: unknown): v is ScreenChoice => v === 'entrance' || v === 'floor1' || v === 'floor2';

const CHOICES: { id: ScreenChoice; label: string; hint: string }[] = [
  { id: 'entrance', label: 'Entrance', hint: 'Lobby busyness & what’s on' },
  { id: 'floor1', label: 'First floor', hint: 'Rooms, pods & workspaces' },
  { id: 'floor2', label: 'Second floor', hint: 'Rooms, pods & workspaces' },
];

/**
 * Full-screen "Choose a display" picker. Shown on first open (no saved choice); also
 * reachable any time via the discreet corner switch control. Picking saves the choice and
 * swaps the rendered screen in client state — no navigation, so the app stays standalone.
 */
function Chooser({ current, onPick }: { current: ScreenChoice | null; onPick: (v: ScreenChoice) => void }) {
  return (
    <div className={styles.chooser}>
      <div className={styles.chooserInner}>
        <img className={styles.chooserLogo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
        <h1 className={styles.chooserTitle}>Choose a display</h1>
        <p className={styles.chooserSub}>Pick which screen this device should show. It’ll be remembered next time.</p>
        <div className={styles.chooserGrid}>
          {CHOICES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.choiceBtn} ${current === c.id ? styles.choiceCurrent : ''}`}
              onClick={() => onPick(c.id)}
            >
              <span className={styles.choiceLabel}>{c.label}</span>
              <span className={styles.choiceHint}>{c.hint}</span>
              {current === c.id ? <span className={styles.choiceTag}>Current</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Top-level screen router for the single installed /screen app.
 * - ?floor=1|2 in the URL always wins (and updates the saved choice).
 * - Otherwise a saved choice ('entrance'|'floor1'|'floor2') reopens straight to that screen.
 * - With no saved choice, the Chooser is shown. Picking swaps screens in client state (no
 *   reload → stays standalone/fullscreen). A discreet corner control reopens the Chooser.
 * Rendering `null` until ready avoids a hydration mismatch / entrance-view flash.
 */
export function ScreenClient() {
  const [view, setView] = useState<ScreenView | null>(null);
  const [saved, setSaved] = useState<ScreenChoice | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('floor');
    const n = raw ? Number(raw) : NaN;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(SCREEN_KEY);
    } catch {
      /* private mode / storage blocked — fall back to the chooser */
    }
    if (n === 1 || n === 2) {
      const v: ScreenChoice = n === 1 ? 'floor1' : 'floor2';
      try {
        window.localStorage.setItem(SCREEN_KEY, v);
      } catch {
        /* ignore */
      }
      setSaved(v);
      setView(v);
      return;
    }
    const s = isChoice(stored) ? stored : null;
    setSaved(s);
    setView(s ?? 'chooser');
  }, []);

  const choose = useCallback((v: ScreenChoice) => {
    try {
      window.localStorage.setItem(SCREEN_KEY, v);
    } catch {
      /* ignore */
    }
    setSaved(v);
    setView(v);
  }, []);
  const openChooser = useCallback(() => setView('chooser'), []);

  // Lock the page to the viewport for the /screen kiosk ONLY — no rubber-band, no page
  // scroll behind the fixed display. Scoped to this route: styles are restored on unmount
  // so normal site pages are untouched.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width,
      bodyHeight: body.style.height,
    };
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.height = '100%';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.position = prev.bodyPosition;
      body.style.width = prev.bodyWidth;
      body.style.height = prev.bodyHeight;
    };
  }, []);
  if (view === null) return null;
  if (view === 'chooser') return <Chooser current={saved} onPick={choose} />;

  const screen =
    view === 'floor1' ? <FloorScreen floor={1} /> : view === 'floor2' ? <FloorScreen floor={2} /> : <EntranceScreen />;

  return (
    <>
      {screen}
      {/* Discreet corner control — reopens the chooser so staff can exit and switch displays,
          all within /screen (no navigation away). Sits below the reserve overlay (z 1100). */}
      <button type="button" className={styles.switchBtn} onClick={openChooser} aria-label="Switch display" title="Switch display">
        <span aria-hidden="true">⋯</span>
      </button>
    </>
  );
}

function EntranceScreen() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());
  const [bankHoliday, setBankHoliday] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  // Optional per-floor filter from ?floor=1|2. Read from the URL in an
  // export-safe way (no next/navigation useSearchParams, which would force a
  // Suspense boundary and can break output:'export').
  const [floor, setFloor] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('floor');
    const n = raw ? Number(raw) : NaN;
    setFloor(n === 1 || n === 2 ? n : null);
  }, []);

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([getTodayScreen(), getUpcomingEvents()]);
    if (s.ok) setData(s.data);
    if (e.ok) setEvents(e.data.events);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // "What's on" auto-rotates one event per page every 6s.
  useEffect(() => {
    if (events.length <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % events.length), 6000);
    return () => clearInterval(t);
  }, [events.length]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('https://www.gov.uk/bank-holidays.json');
        const j = await r.json();
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
        const days = (j['england-and-wales']?.events || []).map((x: { date: string }) => x.date);
        setBankHoliday(days.includes(today));
      } catch {
        /* feed unavailable — fall back to the model's weekend handling */
      }
    })();
  }, []);

  const b = busyness(now);
  // Christmas/New Year shutdown (24 Dec – 1 Jan) layered on weekends + bank holidays.
  const cm = now.getMonth() + 1;
  const cd = now.getDate();
  const shutdown = (cm === 12 && cd >= 24) || (cm === 1 && cd === 1);
  const closed = b.closed || bankHoliday || shutdown;
  const band: Band | undefined = b.band;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const featured = events.length ? events[page % events.length] : null;

  const allSpaces = data?.spaces || [];
  const bookings = data?.bookings || [];
  // Only apply a floor filter when a floor is selected AND the data actually
  // carries that floor value — otherwise degrade to the original behaviour
  // (show everything, no floor heading) until the Airtable Floor field is set.
  const floorActive = floor != null && allSpaces.some((s) => s.floor === floor);
  const spaces = floorActive ? allSpaces.filter((s) => s.floor === floor) : allSpaces;
  const floorLabel = floorActive ? (floor === 1 ? 'First floor' : 'Second floor') : null;
  const rooms = spaces.filter((s) => s.type !== 'Workspace');
  const workspaces = spaces.filter((s) => s.type === 'Workspace');
  const dateLabel = now.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
        {floorLabel ? <span className={styles.floorTag}>{floorLabel}</span> : null}
        <div className={styles.when}>
          <div className={styles.date}>{dateLabel}</div>
          <div className={styles.time}>{timeLabel}</div>
        </div>
      </header>

      {closed ? (
        <section className={`${styles.hero} ${styles.bandClosed}`}>
          <span className={styles.heroLabel}>Closed today</span>
          <p className={styles.heroLine}>We&rsquo;re a weekday space (for now) — see you Monday to Friday.</p>
        </section>
      ) : band ? (
        <section className={`${styles.hero} ${styles[`band_${band.id}`]}`}>
          <span className={styles.heroEyebrow}>Today feels</span>
          <span className={styles.heroLabel}>{band.label}</span>
          <p className={styles.heroLine}>{band.line}</p>
        </section>
      ) : null}

      {!closed ? (
        <div className={styles.entranceMain}>
          <section className={styles.block}>
            <h2 className={styles.h2}>Meeting rooms &amp; pods</h2>
            <div className={styles.spaceGrid}>
              {rooms.map((s) => {
                const st = statusFor(s, bookings, nowMin);
                return (
                  <div key={s.id} className={`${styles.spaceCard} ${st.busy ? styles.busyCard : ''}`}>
                    <span className={styles.spaceName}>{s.name}</span>
                    <span className={styles.spaceType}>
                      {s.type === 'Phone pod' ? 'Phone pod' : `Meeting room${s.capacityLabel ? ` · up to ${s.capacityLabel}` : ''}`}
                    </span>
                    <span className={`${styles.spaceStatus} ${st.busy ? styles.statusBusy : styles.statusFree}`}>{st.text}</span>
                  </div>
                );
              })}
            </div>
            <p className={styles.note}>{meetingRoomLine(now)}</p>
          </section>

          {workspaces.length ? (
            <section className={styles.block}>
              <h2 className={styles.h2}>Workspaces</h2>
              <div className={styles.spaceGrid}>
                {workspaces.map((s) => {
                  const st = statusFor(s, bookings, nowMin);
                  return (
                    <div key={s.id} className={`${styles.spaceCard} ${st.busy ? styles.busyCard : ''}`}>
                      <span className={styles.spaceName}>{s.name}</span>
                      <span className={`${styles.spaceStatus} ${st.busy ? styles.statusBusy : styles.statusFree}`}>
                        {st.busy ? st.text : 'Spaces usually available'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {featured ? (
        <section className={styles.block}>
          <h2 className={styles.h2}>What&rsquo;s on{events[0]?.location ? ` in ${events[0].location}` : ''}</h2>
          <div className={styles.eventFeature}>
            <span className={styles.evIcon}>
              <Icon name={eventThemeIcon(featured.category)} size={56} color="var(--gold-700)" />
            </span>
            <div className={styles.evBody}>
              <span className={styles.evTitle}>{featured.title}</span>
              <span className={styles.evMeta}>
                {featured.start ? eventWhen(featured.start) : ''}
                {featured.location ? ` · ${featured.location}` : ''}
              </span>
              {featured.description ? <span className={styles.evDesc}>{featured.description}</span> : null}
            </div>
          </div>
          {events.length > 1 ? (
            <div className={styles.dots}>
              {events.map((_, i) => (
                <span key={i} className={`${styles.dot} ${i === page % events.length ? styles.dotOn : ''}`} aria-hidden="true" />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {!loaded ? <p className={styles.loading}>Loading…</p> : null}
    </div>
  );
}
