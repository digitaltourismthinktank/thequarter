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

export function ScreenClient() {
  const [data, setData] = useState<ScreenData | null>(null);
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());
  const [bankHoliday, setBankHoliday] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
  const closed = b.closed || bankHoliday;
  const band: Band | undefined = b.band;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const spaces = data?.spaces || [];
  const bookings = data?.bookings || [];
  const rooms = spaces.filter((s) => s.type !== 'Workspace');
  const workspaces = spaces.filter((s) => s.type === 'Workspace');
  const dateLabel = now.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
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
        <>
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
        </>
      ) : null}

      {events.length ? (
        <section className={styles.block}>
          <h2 className={styles.h2}>What&rsquo;s on</h2>
          <div className={styles.events}>
            {events.slice(0, 4).map((ev) => (
              <div key={ev.id} className={styles.event}>
                <span className={styles.evTitle}>{ev.title}</span>
                <span className={styles.evMeta}>
                  {ev.start ? eventWhen(ev.start) : ''}
                  {ev.location ? ` · ${ev.location}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!loaded ? <p className={styles.loading}>Loading…</p> : null}
    </div>
  );
}
