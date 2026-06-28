'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { getUpcomingEvents, type QuarterEvent } from '@/lib/booking';
import styles from './EventsCard.module.css';

function fmtWhen(start: string, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Europe/London' };
  const d = new Date(start);
  const date = d.toLocaleDateString('en-GB', { ...opts, weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false });
  if (end) {
    const t2 = new Date(end).toLocaleTimeString('en-GB', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} · ${time}–${t2}`;
  }
  return `${date} · ${time}`;
}

/** Dashboard card: upcoming published events (mostly in The Kentish Pantry). */
export function EventsCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<QuarterEvent[]>([]);

  useEffect(() => {
    (async () => {
      const r = await getUpcomingEvents();
      if (r.ok) setEvents(r.data.events);
      setLoading(false);
    })();
  }, []);

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>What&rsquo;s on</span>
      {loading ? (
        <p className={styles.meta}>Loading…</p>
      ) : events.length === 0 ? (
        <p className={styles.meta}>No upcoming events just now — watch this space.</p>
      ) : (
        <ul className={styles.list}>
          {events.slice(0, 4).map((e) => (
            <li key={e.id} className={styles.row}>
              <span className={styles.eTitle}>{e.title}</span>
              <span className={styles.eMeta}>
                {e.start ? fmtWhen(e.start, e.end) : ''}
                {e.location ? ` · ${e.location}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <a className={styles.link} href="/events">
        See all events <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
