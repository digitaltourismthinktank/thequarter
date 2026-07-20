'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { getCheckinToday, type CheckinStatus } from '@/lib/booking';
import { TalkToUs } from './TalkToUs';
import styles from './DayPassCard.module.css';

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/**
 * Home, for someone on a day pass rather than a plan.
 *
 * The panel this replaces told them "we'll assign your plan shortly", which is wrong: a day
 * pass isn't a pending membership, it's a complete thing they've already bought. So this
 * says what they have, on which day, and what it includes — and is candid that meeting rooms
 * are not part of it, because the booking screen will otherwise refuse them with no warning.
 *
 * The pod is the lead action, not an afterthought. Someone buying a single day is often here
 * for a few calls, and "somewhere private to take a call, included" is the most useful thing
 * we can tell them.
 */
export function DayPassCard() {
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCheckinToday().then((r) => {
      if (r.ok) setStatus(r.data);
      setLoading(false);
    });
  }, []);

  const today = status?.date ?? new Date().toISOString().slice(0, 10);
  const passes = (status?.planned ?? []).filter((p) => p.kind === 'pass').sort((a, b) => a.date.localeCompare(b.date));
  const validToday = !!status?.checkedIn || passes.some((p) => p.date === today);
  const next = passes.find((p) => p.date > today) ?? null;

  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Your day pass</span>

      {loading ? (
        <p className={styles.meta}>Loading…</p>
      ) : validToday ? (
        <>
          <h2 className={styles.title}>You&rsquo;re in today</h2>
          <p className={styles.meta}>Your pass covers today — a desk, the coffee, and the run of the place.</p>
        </>
      ) : next ? (
        <>
          <h2 className={styles.title}>Valid {fmt(next.date)}</h2>
          <p className={styles.meta}>See you then. Your pass covers the whole day.</p>
        </>
      ) : (
        <>
          <h2 className={styles.title}>No day pass booked yet</h2>
          <p className={styles.meta}>Pick a day and it&rsquo;s yours — a desk, the coffee, and the run of the place.</p>
        </>
      )}

      {passes.length > 1 ? (
        <div className={styles.chips}>
          {passes.map((p) => (
            <span key={p.id} className={styles.chip}>
              {fmt(p.date).replace(/,/g, '')}
            </span>
          ))}
        </div>
      ) : null}

      {/* What's included — said plainly, so nobody discovers the limits at the booking screen. */}
      <ul className={styles.includes}>
        <li>
          <Icon name="check" size={15} color="var(--gold-700)" /> A desk for the day, wherever you like
        </li>
        <li>
          <Icon name="check" size={15} color="var(--gold-700)" /> A phone pod when you need privacy — up to two hours
        </li>
        <li className={styles.not}>
          <Icon name="x" size={15} color="var(--stone-400)" /> Meeting rooms come with a membership plan
        </li>
      </ul>

      <div className={styles.actions}>
        <Button variant="primary" size="sm" href="/book" iconAfter="arrow-right">
          Book a phone pod
        </Button>
        <Button variant="secondary" size="sm" href="/day-pass">
          {passes.length ? 'Another day' : 'Buy a day pass'}
        </Button>
      </div>

      <div className={styles.foot}>
        <a className={styles.footLink} href="/plans">
          Coming in often? A plan works out cheaper <Icon name="arrow-right" size={14} />
        </a>
        {/* Deliberately quiet, and deliberately here: this is where someone lands when a
            meeting room has just been refused, and a human can make an exception. */}
        <TalkToUs variant="ghost" label="Need a meeting room? Talk to us" prefill="I'm on a day pass and wanted to ask about a meeting room " />
      </div>
    </div>
  );
}
