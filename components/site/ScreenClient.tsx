'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getTodayScreen,
  getUpcomingEvents,
  getAnnouncements,
  getTransport,
  type ScreenSpace,
  type ScreenBooking,
  type QuarterEvent,
  type ScreenAnnouncement,
  type TrainDeparture,
  type BusDeparture,
} from '@/lib/booking';
import { busyness, expectedPeople, type Band } from '@/lib/busyness';
import { Icon } from '@/components/ds/Icon';
import { eventThemeIcon } from '@/lib/eventThemes';
import { FloorScreen } from './FloorScreen';
import { ReceptionClient } from './ReceptionClient';
import styles from './ScreenClient.module.css';

/** The lobby screen rotates through the next few events only. */
const MAX_EVENTS = 3;

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

interface ScreenData {
  date: string;
  nowMin: number;
  spaces: ScreenSpace[];
  bookings: ScreenBooking[];
}

/** Mirrors the floor screens: a room is "hot" while in use, or with a booking due within
 *  30 minutes, so the entrance display and the door screens agree at a glance. */
const SOON_MIN = 30;

interface RoomView {
  hot: boolean;
  text: string;
  schedule: ScreenBooking[];
}

function roomView(space: ScreenSpace, bookings: ScreenBooking[], nowMin: number): RoomView {
  const mine = bookings.filter((b) => b.space === space.id);
  const schedule = mine.filter((b) => b.endMin > nowMin).sort((a, b) => a.startMin - b.startMin);
  const current = mine.find((b) => b.startMin <= nowMin && nowMin < b.endMin) || null;
  const next = mine.filter((b) => b.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0] || null;
  const soon = !current && !!next && next.startMin - nowMin <= SOON_MIN;
  const free = space.bookable ? 'Available' : 'Open';
  const text = current
    ? `${current.kind === 'Block' || current.kind === 'Privatisation' ? 'Reserved' : 'In use'} until ${minToHHMM(current.endMin)}`
    : soon && next
      ? `Booked from ${minToHHMM(next.startMin)}`
      : next
        ? `${free} · next ${minToHHMM(next.startMin)}`
        : free;
  return { hot: !!current || soon, text, schedule };
}

/** Minutes since midnight in London — NOT the browser's timezone. The wall display's OS
 *  clock can't be assumed to be on London time, and it shifts every "now" calculation. */
function londonNowMin(): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  const h = p.hour === '24' ? 0 : Number(p.hour);
  return h * 60 + Number(p.minute);
}

/** The business day the timeline spans (08:00–18:00), matching the booking window. */
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const DAY_SPAN = DAY_END - DAY_START;
const pct = (min: number) => ((Math.max(DAY_START, Math.min(DAY_END, min)) - DAY_START) / DAY_SPAN) * 100;

/**
 * A room's day at a glance: booked stretches laid across 08:00–18:00, with a marker for
 * now. Lets anyone walking past read how the room is filling up without parsing times.
 */
function DayLine({ space, bookings, nowMin }: { space: ScreenSpace; bookings: ScreenBooking[]; nowMin: number }) {
  const mine = bookings.filter((b) => b.space === space.id && b.endMin > DAY_START && b.startMin < DAY_END);
  const nowIn = nowMin >= DAY_START && nowMin <= DAY_END;
  return (
    <div className={styles.dayLine} aria-hidden="true">
      <div className={styles.dayTrack}>
        {mine.map((b, i) => (
          <span
            key={`${b.startMin}-${i}`}
            className={`${styles.daySeg} ${b.kind === 'Block' || b.kind === 'Privatisation' ? styles.daySegBlock : ''}`}
            style={{ left: `${pct(b.startMin)}%`, width: `${Math.max(2, pct(b.endMin) - pct(b.startMin))}%` }}
          />
        ))}
        {nowIn ? <span className={styles.dayNow} style={{ left: `${pct(nowMin)}%` }} /> : null}
      </div>
      <div className={styles.dayScale}>
        <span>08</span>
        <span>13</span>
        <span>18</span>
      </div>
    </div>
  );
}

/** WMO weather code → a simple emoji for the lobby clock. Open-Meteo's `weather_code`. */
function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '☁️';
}

/** Rain in the WMO code set (drizzle/rain/showers/thunder) — used to spot a change in the forecast. */
function isRainCode(c: number): boolean {
  return (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
}
/**
 * A short "what's changing" line from Open-Meteo's hourly forecast: rain arriving in the next few
 * hours ("Rain likely ~14:00"), or — if it's already raining — when it eases. null when settled.
 */
function weatherChange(hourly: { time: string[]; weather_code: number[]; precipitation_probability?: number[] } | undefined, nowCode: number): string | null {
  if (!hourly?.time?.length) return null;
  const nowMs = Date.now();
  const hh = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });
  const rainingNow = isRainCode(nowCode);
  for (let i = 0; i < hourly.time.length; i += 1) {
    const t = new Date(hourly.time[i]).getTime();
    if (t < nowMs || t - nowMs > 6 * 3600_000) continue;
    const c = hourly.weather_code[i];
    const p = hourly.precipitation_probability?.[i] ?? 0;
    if (!rainingNow && (isRainCode(c) || p >= 55)) return `Rain likely ~${hh(hourly.time[i])}`;
    if (rainingNow && !isRainCode(c)) return `Easing ~${hh(hourly.time[i])}`;
  }
  return null;
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

// ---- Transport band (Canterbury West / East trains + Bus Station) --------------------------
// A compact "Quarter panel" departures board for the entrance display. On-time reads quiet;
// anything off-schedule pops (amber late / red cancelled) so it's legible across the lobby. Both
// stations are a ~10-min walk, so each column shows a full hour (~7 departures).

type TransportData = Awaited<ReturnType<typeof getTransport>>['data'];

/** One Darwin departure's status as a compact chip. */
function TrainStatus({ t }: { t: TrainDeparture }) {
  if (t.state === 'cancelled') return <span className={`${styles.trStatus} ${styles.trCancelled}`}>Cancelled</span>;
  if (t.state === 'delayed') return <span className={`${styles.trStatus} ${styles.trLate}`}>Delayed</span>;
  if (t.state === 'late' && t.expected) return <span className={`${styles.trStatus} ${styles.trLate}`}>Exp {t.expected}</span>;
  return <span className={`${styles.trStatus} ${styles.trOnTime}`}>On time</span>;
}

function TrainColumn({ title, sub, rows, live }: { title: string; sub: string; rows: TrainDeparture[]; live: boolean }) {
  return (
    <div className={styles.trCol}>
      <div className={styles.trColHead}>
        <span className={styles.trStation}>{title}</span>
        <span className={styles.trDir}>{sub}</span>
      </div>
      {rows.length ? (
        <ul className={styles.trList}>
          {rows.map((t, i) => (
            <li key={`${t.time}-${i}`} className={t.state === 'cancelled' ? styles.trRowCx : undefined}>
              <span className={styles.trTime}>{t.time}</span>
              <span className={styles.trDest}>{t.to}</span>
              <span className={styles.trPlat}>{t.platform ? `Pl ${t.platform}` : ''}</span>
              <TrainStatus t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.trEmpty}>{live ? 'Nothing in the next hour' : 'Live train times switching on soon'}</p>
      )}
    </div>
  );
}

function BusColumn({ rows }: { rows: BusDeparture[] }) {
  return (
    <div className={styles.trCol}>
      <div className={styles.trColHead}>
        <span className={styles.trStation}>Buses</span>
        <span className={styles.trDir}>Canterbury Bus Station</span>
      </div>
      {rows.length ? (
        <ul className={styles.trList}>
          {rows.map((bd, i) => (
            <li key={`${bd.time}-${bd.line}-${i}`} className={styles.busRow}>
              <span className={styles.trTime}>{bd.time}</span>
              <span className={styles.busLine}>{bd.line}</span>
              <span className={styles.trDest}>{bd.to}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.trEmpty}>Nothing in the next hour</p>
      )}
    </div>
  );
}

function TransportBand() {
  const [t, setT] = useState<TransportData | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getTransport();
    if (r.ok) {
      setT(r.data);
      setUpdated(
        new Date().toLocaleTimeString('en-GB', {
          timeZone: 'Europe/London',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  if (!t || !t.configured) return null;
  const { trains, buses, trainsLive } = t;
  // Nothing to show at all (trains not live yet + no buses now) — hide rather than show a shell.
  if (!trainsLive && !buses.length && !trains.west.length && !trains.east.length) return null;

  // Cap each column so the board stays a bounded height whatever the timetable throws at it — a
  // quiet-hour board and a rush-hour one with a dozen services take the same space, and a long bus
  // list can never push the room cards off the fixed-height canvas (the cut-off people reported).
  const MAX_DEPARTURES = 8;

  return (
    <section className={styles.transport} aria-label="Live departures">
      <div className={styles.trGrid}>
        <TrainColumn title="Canterbury West" sub="London St Pancras · Ramsgate" rows={trains.west.slice(0, MAX_DEPARTURES)} live={!!trainsLive} />
        <TrainColumn title="Canterbury East" sub="London Victoria · Dover" rows={trains.east.slice(0, MAX_DEPARTURES)} live={!!trainsLive} />
        <BusColumn rows={buses.slice(0, MAX_DEPARTURES)} />
      </div>
      <div className={styles.trFoot}>
        <span className={styles.trWalk}>≈ 10-min walk to either station</span>
        {trainsLive && updated ? (
          <span className={styles.trLive}>
            <span className={styles.trDot} aria-hidden="true" /> Live · updated {updated}
          </span>
        ) : (
          <span className={styles.trLive}>Bus times from timetable</span>
        )}
      </div>
    </section>
  );
}

/** One installed /screen app can BE any of these displays — persisted so a reopen returns to it. */
type ScreenChoice = 'entrance' | 'floor1' | 'floor2' | 'reception';
type ScreenView = ScreenChoice | 'chooser';
const SCREEN_KEY = 'q-screen';
const isChoice = (v: unknown): v is ScreenChoice => v === 'entrance' || v === 'floor1' || v === 'floor2' || v === 'reception';

const CHOICES: { id: ScreenChoice; label: string; hint: string }[] = [
  { id: 'entrance', label: 'Entrance', hint: 'Lobby busyness & what’s on' },
  { id: 'floor1', label: 'First floor', hint: 'Rooms, pods & workspaces' },
  { id: 'floor2', label: 'Second floor', hint: 'Rooms, pods & workspaces' },
  { id: 'reception', label: 'Reception', hint: 'Door check-in — members, guests & day passes' },
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
/**
 * Fit-to-canvas scaling for the wall display.
 *
 * The layout was authored against a 1080p screen and, on anything shorter, sections ran into each
 * other and cards were cut off — the breakpoints could only ever cover the resolutions we thought
 * to write down. So the screen no longer lays itself out against the real viewport: it lays out at
 * a FIXED design width (1920 landscape / 1080 portrait) in a box whose height matches the display's
 * true aspect ratio, and the whole box is then scaled to fit. The proportions are identical at every
 * resolution — a 1512×800 laptop shows exactly what the 1080p TV shows, just smaller — so nothing
 * can overlap or be clipped by a size we never anticipated.
 *
 * Below 700px wide (a phone glancing at it) scaling is skipped: shrinking a 1920-wide layout onto a
 * phone would be unreadable, and the plain responsive flow is the better answer there.
 */
function useFitCanvas() {
  const [box, setBox] = useState<{ width: number; height: number; scale: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!vw || !vh || vw < 700) {
        setBox(null);
        return;
      }
      // A FIXED design canvas (16:9 landscape / 9:16 portrait) scaled to CONTAIN — the smaller of the
      // two axis ratios — and centred. The composition is therefore always the exact one that was
      // laid out and checked; it is only ever shrunk to fit, never reflowed into a shorter/taller
      // shape that could clip the departures board or an event card. Odd aspect ratios get a little
      // letterbox in the page colour, which is a far better failure than cut-off content.
      const landscape = vw >= vh;
      const designW = landscape ? 1920 : 1080;
      const designH = landscape ? 1080 : 1920;
      const scale = Math.min(vw / designW, vh / designH);
      setBox({ width: designW, height: designH, scale });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return box;
}

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

  // Lock the page to the viewport for the WALL displays only — no rubber-band, no page scroll
  // behind the fixed display. Reception needs to scroll (its fields + the on-screen keyboard) and
  // the chooser is a normal page, so neither is locked. Re-runs on view change; the cleanup
  // restores styles when switching away, so normal site pages are untouched.
  useEffect(() => {
    if (view !== 'entrance' && view !== 'floor1' && view !== 'floor2') return;
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
  }, [view]);
  if (view === null) return null;
  if (view === 'chooser') return <Chooser current={saved} onPick={choose} />;

  const screen =
    view === 'floor1' ? (
      <FloorScreen floor={1} />
    ) : view === 'floor2' ? (
      <FloorScreen floor={2} />
    ) : view === 'reception' ? (
      <ReceptionClient />
    ) : (
      <EntranceScreen />
    );

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
  const fit = useFitCanvas();
  const [data, setData] = useState<ScreenData | null>(null);
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [announcements, setAnnouncements] = useState<ScreenAnnouncement[]>([]);
  const [weather, setWeather] = useState<{ temp: number; emoji: string; change: string | null } | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [bankHoliday, setBankHoliday] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  // Optional per-floor filter from ?floor=1|2. Read from the URL in an
  // export-safe way (no next/navigation useSearchParams, which would force a
  // Suspense boundary and can break output:'export').
  const [floor, setFloor] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Full screen for the wall display. Old Safari (the Mac mini driving the TV) only has
  // the webkit-prefixed API, so try both. Kept in sync with the browser's own controls
  // (Esc, the menu) via both change events.
  const toggleFullscreen = useCallback(() => {
    type FsDoc = Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => void;
    };
    type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
    const doc = document as FsDoc;
    const el = document.documentElement as FsEl;
    const active = !!(document.fullscreenElement || doc.webkitFullscreenElement);
    try {
      if (active) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch {
      /* full screen can be refused (user gesture / permissions) — never break the display */
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('floor');
    const n = raw ? Number(raw) : NaN;
    setFloor(n === 1 || n === 2 ? n : null);
  }, []);

  const load = useCallback(async () => {
    const [s, e, a] = await Promise.all([getTodayScreen(), getUpcomingEvents(), getAnnouncements()]);
    if (s.ok) setData(s.data);
    if (e.ok) setEvents(e.data.events);
    if (a.ok) setAnnouncements(a.data.announcements);
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
    const n = Math.min(events.length, MAX_EVENTS);
    if (n <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % n), 6000);
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

  // Canterbury weather via Open-Meteo (open data, no key, CORS-friendly). Refreshed half-hourly.
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.28&longitude=1.08&current=temperature_2m,weather_code&hourly=weather_code,precipitation_probability&forecast_hours=8&timezone=Europe%2FLondon');
        const j = await r.json();
        const t = j?.current?.temperature_2m;
        const c = j?.current?.weather_code;
        if (typeof t === 'number' && typeof c === 'number') setWeather({ temp: t, emoji: weatherEmoji(c), change: weatherChange(j?.hourly, c) });
      } catch {
        /* feed unavailable — the clock simply shows no weather */
      }
    };
    load();
    const id = window.setInterval(load, 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const b = busyness(now);
  // Christmas/New Year shutdown (24 Dec – 1 Jan) layered on weekends + bank holidays.
  const cm = now.getMonth() + 1;
  const cd = now.getDate();
  const shutdown = (cm === 12 && cd >= 24) || (cm === 1 && cd === 1);
  const closed = b.closed || bankHoliday || shutdown;
  const band: Band | undefined = b.band;
  const nowMin = londonNowMin();
  // Only the next few events — a lobby screen shouldn't cycle through the whole calendar.
  const shownEvents = events.slice(0, MAX_EVENTS);
  const featured = shownEvents.length ? shownEvents[page % shownEvents.length] : null;

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

  // The week at a glance — the busyness rhythm (Mon–Fri) from the model, today marked. Tuesdays
  // and Thursdays run busiest, Mondays and Fridays quietest.
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // this week's Monday
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return { label, val: expectedPeople(d), isToday: d.toDateString() === now.toDateString() };
  });
  const weekMax = Math.max(...weekDays.map((x) => x.val), 1);

  return (
    <div className={styles.stage}>
      <div
        className={`${styles.screen}${fit ? ` ${styles.scaled}` : ''}`}
        style={fit ? { width: `${fit.width}px`, height: `${fit.height}px`, transform: `translate(-50%, -50%) scale(${fit.scale})` } : undefined}
      >
      {/* Wall displays often run on old machines where the browser's own full-screen is
          fiddly to reach — this puts it one tap away. Fades back once you're in. */}
      <button type="button" className={styles.fsBtn} onClick={toggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </button>

      <header className={styles.top}>
        <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
        {floorLabel ? <span className={styles.floorTag}>{floorLabel}</span> : null}
        {/* Scheduled announcement — sits along the top between the logo and the clock, unboxed,
            so it reads as a headline for the day rather than a card competing with the rooms. */}
        {announcements.length ? (
          <div className={styles.announceTop} role="status">
            <span className={styles.announceLine}>{announcements[0].title}</span>
          </div>
        ) : null}
        <div className={styles.when}>
          <div className={styles.date}>{dateLabel}</div>
          <div className={styles.time}>{timeLabel}</div>
          {weather ? (
            <div className={styles.weather}>
              {weather.emoji} {Math.round(weather.temp)}°
              {weather.change ? <span className={styles.weatherChange}> · {weather.change}</span> : null}
            </div>
          ) : null}
        </div>
      </header>

      {/* Live departures sit high up — the first thing a member sees when heading out. */}
      {!closed ? <TransportBand /> : null}

      {closed ? (
        <section className={`${styles.hero} ${styles.bandClosed}`}>
          <span className={styles.heroLabel}>Closed today</span>
          <p className={styles.heroLine}>We&rsquo;re a weekday space (for now) — see you Monday to Friday.</p>
        </section>
      ) : band ? (
        <section className={`${styles.hero} ${styles[`band_${band.id}`]}`}>
          <span className={styles.heroEyebrow}>The week at a glance</span>
          <div className={styles.weekStrip}>
            {weekDays.map((d) => (
              <div key={d.label} className={`${styles.weekCol} ${d.isToday ? styles.weekToday : ''}`}>
                <div className={styles.weekBarWrap}>
                  <div className={styles.weekBar} style={{ height: `${Math.max(10, Math.round((d.val / weekMax) * 100))}%` }} />
                </div>
                <span className={styles.weekDay}>{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!closed ? (
        <div className={styles.entranceMain}>
          <section className={styles.block}>
            <h2 className={styles.h2}>Meeting rooms &amp; pods</h2>
            <div className={`${styles.spaceGrid} ${styles.roomGrid}`}>
              {rooms.map((s) => {
                const v = roomView(s, bookings, nowMin);
                return (
                  <div key={s.id} className={`${styles.spaceCard} ${v.hot ? styles.hotCard : ''}`}>
                    <span className={styles.spaceName}>{s.name}</span>
                    <span className={styles.spaceType}>
                      {s.type === 'Phone pod' ? 'Phone pod' : `Meeting room${s.capacityLabel ? ` · up to ${s.capacityLabel}` : ''}`}
                    </span>
                    <span className={`${styles.spaceStatus} ${v.hot ? styles.statusHot : styles.statusFree}`}>{v.text}</span>
                    {/* Today's remaining bookings, times only — a public wall display should
                        never carry members' names. */}
                    {v.schedule.length ? (
                      <ul className={styles.sched}>
                        {v.schedule.slice(0, 4).map((b, i) => {
                          const live = b.startMin <= nowMin && nowMin < b.endMin;
                          return (
                            <li key={`${b.startMin}-${i}`} className={live ? styles.schedNow : undefined}>
                              <span className={styles.schedTime}>
                                {minToHHMM(b.startMin)}–{minToHHMM(b.endMin)}
                              </span>
                              {live ? <span className={styles.schedTag}>Now</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className={styles.schedNone}>No bookings today</p>
                    )}
                    <DayLine space={s} bookings={bookings} nowMin={nowMin} />
                  </div>
                );
              })}
            </div>
          </section>

          {workspaces.length ? (
            <section className={styles.block}>
              <h2 className={styles.h2}>Workspaces</h2>
              <div className={styles.spaceGrid}>
                {workspaces.map((s) => {
                  // A privatised or block-booked workspace reads red exactly like a room in
                  // use — the whole space is unavailable, so it needs the same signal.
                  const v = roomView(s, bookings, nowMin);
                  return (
                    <div key={s.id} className={`${styles.spaceCard} ${v.hot ? styles.hotCard : ''}`}>
                      <span className={styles.spaceName}>{s.name}</span>
                      <span className={`${styles.spaceStatus} ${v.hot ? styles.statusHot : styles.statusFree}`}>
                        {v.hot ? v.text : 'Spaces usually available'}
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
          <h2 className={styles.h2}>What&rsquo;s on{shownEvents[0]?.location ? ` in ${shownEvents[0].location}` : ''}</h2>
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
          {shownEvents.length > 1 ? (
            <div className={styles.dots}>
              {shownEvents.map((_, i) => (
                <span key={i} className={`${styles.dot} ${i === page % shownEvents.length ? styles.dotOn : ''}`} aria-hidden="true" />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

        {!loaded ? <p className={styles.loading}>Loading…</p> : null}
      </div>
    </div>
  );
}
