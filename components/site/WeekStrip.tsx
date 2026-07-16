'use client';

import { useEffect, useState } from 'react';
import styles from './WeekStrip.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
const monthDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** Parse a YYYY-MM-DD as a LOCAL calendar date (new Date('YYYY-MM-DD') is UTC,
    which lands on the wrong day/week for clocks behind UTC). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * A designed Mon–Fri week picker with prev/next-week navigation. Past days and
 * weekends are excluded; selecting a day calls onSelect(YYYY-MM-DD).
 */
export function WeekStrip({
  value,
  onSelect,
  onWeekChange,
  label,
  booked = [],
}: {
  value?: string | null;
  onSelect: (iso: string) => void;
  /** Fires with the visible week's Monday (YYYY-MM-DD) whenever the week changes — lets a
   *  parent drive a whole-week view off the strip's prev/next navigation. */
  onWeekChange?: (mondayISO: string) => void;
  label?: string;
  /** Days already booked/reserved — shown tinted so they read as "already yours". */
  booked?: string[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISO(today);
  // Start on the week of the selected value, or — at weekends — next week.
  const initial = value ? parseLocalDate(value) : today.getDay() === 0 || today.getDay() === 6 ? addDays(today, 7) : today;
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(initial));

  // Report the visible week to the parent whenever it changes (stable callback expected).
  useEffect(() => {
    onWeekChange?.(toISO(weekStart));
  }, [weekStart, onWeekChange]);

  const week = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)); // Mon–Fri
  const canPrev = mondayOf(today).getTime() < weekStart.getTime();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {label ? <span className={styles.label}>{label}</span> : <span />}
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.arrow}
            disabled={!canPrev}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            ‹
          </button>
          <span className={styles.range}>
            {monthDay(weekStart)} – {monthDay(addDays(weekStart, 4))}
          </span>
          <button type="button" className={styles.arrow} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            ›
          </button>
        </div>
      </div>
      <div className={styles.row}>
        {week.map((d) => {
          const iso = toISO(d);
          const past = iso < todayISO;
          const isToday = iso === todayISO;
          const on = value === iso;
          const isBooked = booked.includes(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={past}
              className={`${styles.day} ${on ? styles.on : ''} ${isBooked && !on ? styles.booked : ''} ${past ? styles.past : ''}`}
              onClick={() => onSelect(iso)}
              title={isBooked ? 'Already booked' : undefined}
            >
              <span className={styles.dow}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span className={styles.num}>{d.getDate()}</span>
              {isBooked ? <span className={styles.bookedTag}>Booked</span> : isToday ? <span className={styles.todayDot} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
