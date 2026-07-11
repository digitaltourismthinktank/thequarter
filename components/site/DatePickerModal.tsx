'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { Button } from '@/components/ds/Button';
import styles from './DatePickerModal.module.css';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month-grid date picker for planning a visit on any future weekday. Weekends, past
 *  days, England & Wales bank holidays and the Christmas/New Year shutdown are closed. */
export function DatePickerModal({
  open,
  onClose,
  onPick,
  planned = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (date: string) => void;
  planned?: string[];
}) {
  const today = new Date();
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() });
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  // Days picked this session — shown selected immediately so you can add several
  // before closing (the parent reserves each in the background).
  const [justPicked, setJustPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setJustPicked(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch('https://www.gov.uk/bank-holidays.json');
        const j = await r.json();
        setHolidays(new Set((j['england-and-wales']?.events || []).map((e: { date: string }) => e.date)));
      } catch {
        /* feed unavailable — weekends/past still close */
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const todayStr = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const plannedSet = new Set(planned.map((p) => p.slice(0, 10)));
  const first = new Date(ym.y, ym.m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const canPrev = ym.y > today.getFullYear() || (ym.y === today.getFullYear() && ym.m > today.getMonth());
  const shutdown = (ds: string) => {
    const [, mm, dd] = ds.split('-').map(Number);
    return (mm === 12 && dd >= 24) || (mm === 1 && dd === 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Pick a date">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <button
            className={styles.nav}
            onClick={() => canPrev && setYm((s) => (s.m === 0 ? { y: s.y - 1, m: 11 } : { y: s.y, m: s.m - 1 }))}
            disabled={!canPrev}
            aria-label="Previous month"
          >
            <Icon name="chevron-right" size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className={styles.month}>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          <button
            className={styles.nav}
            onClick={() => setYm((s) => (s.m === 11 ? { y: s.y + 1, m: 0 } : { y: s.y, m: s.m + 1 }))}
            aria-label="Next month"
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
        <div className={styles.grid}>
          {DOW.map((d) => (
            <span key={d} className={styles.dow}>
              {d}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} />;
            const ds = iso(ym.y, ym.m, d);
            const dow = new Date(ym.y, ym.m, d).getDay();
            const closed = dow === 0 || dow === 6 || ds < todayStr || holidays.has(ds) || shutdown(ds);
            const isToday = ds === todayStr;
            const isPlanned = plannedSet.has(ds) || justPicked.has(ds);
            return (
              <button
                key={ds}
                className={`${styles.day} ${closed ? styles.closed : ''} ${isToday ? styles.today : ''} ${isPlanned ? styles.planned : ''}`}
                disabled={closed || isPlanned}
                onClick={() => {
                  onPick(ds);
                  setJustPicked((s) => new Set(s).add(ds));
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className={styles.footer}>
          <span className={styles.note}>
            {justPicked.size > 0
              ? `${justPicked.size} day${justPicked.size === 1 ? '' : 's'} added — pick more or close.`
              : 'Pick as many days as you like.'}
          </span>
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
