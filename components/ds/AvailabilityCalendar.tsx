'use client';

import { Fragment, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';
import styles from './AvailabilityCalendar.module.css';

/* The Quarter — AvailabilityCalendar. Weekly room-availability grid: columns =
   days, rows = time slots, each cell carries a status. Available/held cells are
   selectable; booked cells are disabled.

   PHASE-2 SEAM: this is a self-contained presentational component with a clean
   data interface (days / slots / data / onSelect). Today it's fed mock data via
   lib/availability; in phase 2 swap that source for a live API — no change here. */

export type SlotStatus = 'available' | 'busy' | 'soon';

export interface CalendarDay {
  label: string;
  date?: string;
}

export interface AvailabilitySelection {
  day: CalendarDay;
  slot: string;
  dayIndex: number;
  slotIndex: number;
  status: SlotStatus;
}

export interface AvailabilityCalendarProps {
  days: CalendarDay[];
  slots: string[];
  /** data[slotIndex][dayIndex] = status */
  data: SlotStatus[][];
  roomName?: string;
  /** Controlled selection key in the form `${dayIndex}-${slotIndex}`. */
  selectedKey?: string;
  onSelect?: (selection: AvailabilitySelection) => void;
  className?: string;
  style?: CSSProperties;
}

const CELL_LABEL: Record<SlotStatus, string> = {
  available: 'Free',
  busy: 'Booked',
  soon: 'Held',
};

export function AvailabilityCalendar({
  days,
  slots,
  data,
  roomName,
  selectedKey,
  onSelect,
  className,
  style,
}: AvailabilityCalendarProps) {
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const sel = selectedKey !== undefined ? selectedKey : internalSel;

  const pick = (dayIndex: number, slotIndex: number, status: SlotStatus) => {
    if (status === 'busy') return;
    const key = `${dayIndex}-${slotIndex}`;
    if (selectedKey === undefined) setInternalSel(key);
    onSelect?.({ day: days[dayIndex], slot: slots[slotIndex], dayIndex, slotIndex, status });
  };

  const gridTemplateColumns = `72px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className={cn(styles.calendar, className)} style={style}>
      <div className={styles.header}>
        <div className={styles.headLeft}>
          {roomName ? <h3 className={styles.roomName}>{roomName}</h3> : null}
          <span className={styles.week}>This week</span>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={cn(styles.swatch, styles.swatch_free)} />
            Free
          </span>
          <span className={styles.legendItem}>
            <span className={cn(styles.swatch, styles.swatch_booked)} />
            Booked
          </span>
        </div>
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className={styles.dayHead}>
            <div className={styles.dayLabel}>{d.label}</div>
            {d.date ? <div className={styles.dayDate}>{d.date}</div> : null}
          </div>
        ))}

        {slots.map((slot, si) => (
          <Fragment key={si}>
            <div className={styles.slotLabel}>{slot}</div>
            {days.map((day, di) => {
              // Free / Booked only — any interim ('soon') reads as Free, no middle state.
              const status: SlotStatus = data[si]?.[di] === 'busy' ? 'busy' : 'available';
              const key = `${di}-${si}`;
              const isSel = sel === key;
              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => pick(di, si, status)}
                  disabled={status === 'busy'}
                  aria-pressed={isSel}
                  aria-label={`${day.label}${day.date ? ' ' + day.date : ''} ${slot} — ${CELL_LABEL[status]}`}
                  className={cn(styles.cell, styles[`cell_${status}`], isSel && styles.selected)}
                >
                  {isSel ? <Icon name="check" size={16} color="var(--gold-400)" strokeWidth={2.5} /> : CELL_LABEL[status]}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
