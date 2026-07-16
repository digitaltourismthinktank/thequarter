'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { getPublishedEvents, type QuarterEvent } from '@/lib/booking';
import styles from './events.module.css';

const LDN = 'Europe/London';

function badge(start: string) {
  const d = new Date(start);
  return {
    day: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: LDN }),
    num: d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: LDN }),
    mon: d.toLocaleDateString('en-GB', { month: 'short', timeZone: LDN }),
  };
}

function timeRange(start: string, end: string | null): string {
  const t = (v: string) => new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: LDN });
  return end ? `${t(start)} – ${t(end)}` : t(start);
}

/**
 * Public /events list — the live what's-on pulled from the admin-managed feed
 * (getPublishedEvents), not a hardcoded seed. Only upcoming, published events show.
 * The surrounding marketing shell (hero, aside) stays server-rendered for SEO; only
 * this list hydrates client-side, which is the right trade for a static export.
 */
export function PublicEventsList() {
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPublishedEvents().then((r) => {
      if (r.ok) setEvents(r.data.events);
      setLoaded(true);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.start && e.start.slice(0, 10) >= today);

  // Reserve column height with skeleton cards while the client fetch runs, so the list column
  // doesn't collapse to one line next to the tall sticky image (which read as "broken until loaded").
  if (!loaded) {
    return (
      <div className={styles.list} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <article key={i} className={`${styles.event} ${styles.eventSkeleton}`}>
            <div className={styles.date}>
              <div className={styles.skelLine} style={{ width: 24 }} />
              <div className={styles.skelLine} style={{ width: 32, height: 24 }} />
            </div>
            <div className={styles.eventBody}>
              <div className={styles.skelLine} style={{ width: 90 }} />
              <div className={styles.skelLine} style={{ width: '70%', height: 20 }} />
              <div className={styles.skelLine} style={{ width: '100%' }} />
              <div className={styles.skelLine} style={{ width: '40%' }} />
            </div>
          </article>
        ))}
      </div>
    );
  }
  if (upcoming.length === 0) {
    return <p className={styles.state}>Nothing on the calendar just yet — check back soon, or come in for a Day Pass.</p>;
  }

  return (
    <div className={styles.list}>
      {upcoming.map((e) => {
        const b = e.start ? badge(e.start) : null;
        return (
          <article key={e.id} className={styles.event}>
            {b ? (
              <div className={styles.date}>
                <div className={styles.dateDay}>{b.day}</div>
                <div className={styles.dateNum}>{b.num}</div>
                <div className={styles.dateMon}>{b.mon}</div>
              </div>
            ) : null}
            <div className={styles.eventBody}>
              {e.category ? (
                <Badge tone="neutral" size="sm">
                  {e.category}
                </Badge>
              ) : null}
              <h2 className={styles.eventTitle}>{e.title}</h2>
              {e.description ? <p className={styles.eventBlurb}>{e.description}</p> : null}
              <div className={styles.eventTime}>
                <Icon name="clock" size={14} color="var(--gold-600)" />
                {e.start ? timeRange(e.start, e.end) : ''}
                {e.location ? ` · ${e.location}` : ''}
              </div>
            </div>
            <div className={styles.eventAction}>
              <Button size="sm" variant="secondary" href="/login?redirect=/whats-on">
                RSVP
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
