'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { MemberShell } from './MemberShell';
import { useMember } from './useMember';
import { getPublishedEvents, getMyRsvps, rsvpEvent, type QuarterEvent, type RsvpStatus } from '@/lib/booking';
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

function EventRow({
  e,
  past,
  status,
  busy,
  onToggle,
}: {
  e: QuarterEvent;
  past?: boolean;
  status?: RsvpStatus;
  busy?: boolean;
  onToggle?: () => void;
}) {
  const going = status === 'Going';
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
        {!past && onToggle ? (
          <div className={styles.rsvpRow}>
            {going ? (
              <>
                <span className={styles.goingTag}>✓ You&rsquo;re going</span>
                <button type="button" className={styles.rsvpCancel} onClick={onToggle} disabled={busy}>
                  {busy ? '…' : 'Cancel RSVP'}
                </button>
              </>
            ) : (
              <button type="button" className={styles.rsvpBtn} onClick={onToggle} disabled={busy}>
                {busy ? '…' : 'RSVP'}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The member Events tab (/whats-on) — the live what's-on, upcoming and past, from
 * the same feed the entrance screen uses. A dedicated member route (not the public
 * /events marketing page) so there's no marketing-hero flash on the way in.
 */
/** Subscribe to the live events calendar (auto-updates) — Google, Apple/Outlook (webcal), or copy. */
function CalendarSubscribe() {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thequarter.work';
  const icsHttps = `${origin}/events.ics`;
  const icsWebcal = icsHttps.replace(/^https?:\/\//, 'webcal://');
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsWebcal)}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(icsHttps);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className={styles.subscribe}>
      <span className={styles.subscribeText}>
        <Icon name="calendar" size={18} color="var(--gold-700)" /> Subscribe to our events — they&rsquo;ll appear in your calendar and update automatically.
      </span>
      <div className={styles.subscribeBtns}>
        <a className={styles.subBtn} href={googleUrl} target="_blank" rel="noopener noreferrer">
          Google Calendar
        </a>
        <a className={styles.subBtn} href={icsWebcal}>
          Apple / Outlook
        </a>
        <button type="button" className={styles.subBtnGhost} onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

export function EventsClient() {
  const { loading, member } = useMember();
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});
  const [busyRsvp, setBusyRsvp] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    getPublishedEvents().then((r) => {
      if (r.ok) setEvents(r.data.events);
      setLoaded(true);
    });
    getMyRsvps().then((r) => {
      if (r.ok) setRsvps(Object.fromEntries(r.data.rsvps.map((x) => [x.eventId, x.status])));
    });
  }, [member]);

  async function toggleRsvp(id: string) {
    const next: RsvpStatus = rsvps[id] === 'Going' ? 'Cancelled' : 'Going';
    setBusyRsvp(id);
    setRsvps((s) => ({ ...s, [id]: next })); // optimistic
    const r = await rsvpEvent(id, next);
    if (!r.ok) setRsvps((s) => ({ ...s, [id]: next === 'Going' ? 'Cancelled' : 'Going' })); // revert
    setBusyRsvp(null);
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => events.filter((e) => e.start && e.start.slice(0, 10) >= today), [events, today]);
  const past = useMemo(() => events.filter((e) => e.start && e.start.slice(0, 10) < today).reverse(), [events, today]);

  return (
    <MemberShell>
      <div className={styles.wrap}>
        {loading ? (
          <p className={styles.state}>Loading…</p>
        ) : !member ? (
          <p className={styles.state}>
            Please <a href="/login?redirect=/whats-on">log in</a> to see events.
          </p>
        ) : (
          <>
            <header className={styles.header}>
              <span className={styles.eyebrow}>What&rsquo;s on</span>
              <h1 className={styles.h1}>Events at The Quarter</h1>
              <p className={styles.sub}>Socials, briefings and workshops — part of being here.</p>
            </header>

            <CalendarSubscribe />

            <section className={styles.section}>
              <h2 className={styles.h2}>Coming up</h2>
              {!loaded ? (
                <p className={styles.state}>Loading…</p>
              ) : upcoming.length ? (
                <div className={styles.list}>
                  {upcoming.map((e) => (
                    <EventRow key={e.id} e={e} status={rsvps[e.id]} busy={busyRsvp === e.id} onToggle={() => toggleRsvp(e.id)} />
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
          </>
        )}
      </div>
    </MemberShell>
  );
}
