'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ds/Icon';
import { MemberShell } from './MemberShell';
import { useMember } from './useMember';
import { getPublishedEvents, type QuarterEvent } from '@/lib/booking';
import styles from './EventsClient.module.css';

function fmtWhen(start: string, end: string | null): string {
  try {
    const s = new Date(start);
    const day = s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const from = s.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const to = end ? new Date(end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
    return `${day} · ${from}${to ? `–${to}` : ''}`;
  } catch {
    return '';
  }
}

function EventRow({ e, past }: { e: QuarterEvent; past?: boolean }) {
  return (
    <article className={`${styles.event} ${past ? styles.eventPast : ''}`}>
      <div className={styles.eventBody}>
        {e.category ? <span className={styles.eventKind}>{e.category}</span> : null}
        <h3 className={styles.eventTitle}>{e.title}</h3>
        <div className={styles.eventMeta}>
          <span>
            <Icon name="clock" size={14} color="var(--gold-600)" /> {e.start ? fmtWhen(e.start, e.end) : ''}
          </span>
          {e.location ? (
            <span>
              <Icon name="map-pin" size={14} color="var(--gold-600)" /> {e.location}
            </span>
          ) : null}
        </div>
        {e.description ? <p className={styles.eventBlurb}>{e.description}</p> : null}
      </div>
    </article>
  );
}

/**
 * /events is dual-mode (like /perks): logged-out visitors get the crawlable
 * marketing page; signed-in members get their in-app Events tab — the live
 * what's-on, upcoming and past, from the same feed the entrance screen uses.
 */
export function EventsClient({ marketing }: { marketing: ReactNode }) {
  const { loading, member } = useMember();
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!member) return;
    getPublishedEvents().then((r) => {
      if (r.ok) setEvents(r.data.events);
      setLoaded(true);
    });
  }, [member]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => events.filter((e) => e.start && e.start.slice(0, 10) >= today), [events, today]);
  const past = useMemo(() => events.filter((e) => e.start && e.start.slice(0, 10) < today).reverse(), [events, today]);

  if (loading || !member) return <>{marketing}</>;

  return (
    <MemberShell>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>What&rsquo;s on</span>
          <h1 className={styles.h1}>Events at The Quarter</h1>
          <p className={styles.sub}>Socials, briefings and workshops — part of being here.</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.h2}>Coming up</h2>
          {!loaded ? (
            <p className={styles.state}>Loading…</p>
          ) : upcoming.length ? (
            <div className={styles.list}>
              {upcoming.map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <p className={styles.muted}>Nothing on the calendar just yet — check back soon.</p>
          )}
        </section>

        {past.length ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Recently</h2>
            <div className={styles.list}>
              {past.slice(0, 12).map((e) => (
                <EventRow key={e.id} e={e} past />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </MemberShell>
  );
}
