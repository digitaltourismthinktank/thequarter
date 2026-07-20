'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/ds/Icon';
import { getUpcomingEvents, getMyRsvps, type QuarterEvent } from '@/lib/booking';
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

/**
 * Dashboard card: the events you've said you're coming to. Home used to list the next four
 * published events, which simply repeated the Events tab — so this now answers the question
 * only Home can answer ("what have I committed to?") and renders nothing when the answer is
 * "nothing", leaving discovery to the Events tab.
 */
export function EventsCard({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<QuarterEvent[]>([]);

  useEffect(() => {
    (async () => {
      const [ev, rs] = await Promise.all([getUpcomingEvents(), getMyRsvps()]);
      if (ev.ok && rs.ok) {
        const going = new Set(rs.data.rsvps.filter((r) => r.status === 'Going').map((r) => r.eventId));
        setEvents(ev.data.events.filter((e) => going.has(e.id)));
      }
      setLoading(false);
    })();
  }, []);

  // Nothing booked in? Say nothing at all — the Events tab is one tap away.
  if (!loading && events.length === 0) return null;

  return (
    <div className={cn(styles.card, className)}>
      <span className={styles.eyebrow}>You&rsquo;re going to</span>
      {loading ? (
        <p className={styles.meta}>Loading…</p>
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
      <a className={styles.link} href="/whats-on">
        See all events <Icon name="arrow-right" size={16} />
      </a>
    </div>
  );
}
