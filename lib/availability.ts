import type { CalendarDay, SlotStatus } from '@/components/ds/AvailabilityCalendar';

/**
 * The Quarter — weekly room availability.
 *
 * PHASE-2 SEAM. This module is the single, clean data source the
 * AvailabilityCalendar reads from. Today it returns deterministic mock data so
 * the UI is fully exercised; in phase 2, replace the body of
 * getWeeklyAvailability() with a real API/booking-system call that returns the
 * same WeeklyAvailability shape. No component or page needs to change.
 */

export interface WeeklyAvailability {
  weekLabel: string;
  days: CalendarDay[];
  slots: string[];
  /** data[slotIndex][dayIndex] = status */
  data: SlotStatus[][];
}

const DAYS: CalendarDay[] = [
  { label: 'Mon', date: '22' },
  { label: 'Tue', date: '23' },
  { label: 'Wed', date: '24' },
  { label: 'Thu', date: '25' },
  { label: 'Fri', date: '26' },
];

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

// Mock weekly patterns per room slug. data[slotIndex][dayIndex].
const A: SlotStatus = 'available';
const B: SlotStatus = 'busy';
const S: SlotStatus = 'soon';

const PATTERNS: Record<string, SlotStatus[][]> = {
  'the-board-room': [
    [A, B, A, S, A],
    [B, A, A, B, A],
    [A, A, B, A, S],
    [B, B, A, A, A],
    [A, S, A, B, A],
    [A, A, B, A, B],
    [A, B, A, A, A],
  ],
  'the-hop-yard': [
    [B, A, A, A, S],
    [A, A, B, A, A],
    [A, B, A, S, A],
    [A, A, A, B, B],
    [S, A, B, A, A],
    [A, B, A, A, A],
    [B, A, A, S, A],
  ],
  'the-chapter-house': [
    [A, A, B, A, A],
    [B, S, A, A, B],
    [A, A, A, B, A],
    [A, B, S, A, A],
    [A, A, A, A, B],
    [B, A, B, A, S],
    [A, A, A, B, A],
  ],
};

const DEFAULT_PATTERN: SlotStatus[][] = PATTERNS['the-board-room'];

export function getWeeklyAvailability(roomSlug: string): WeeklyAvailability {
  return {
    weekLabel: 'This week',
    days: DAYS,
    slots: SLOTS,
    data: PATTERNS[roomSlug] ?? DEFAULT_PATTERN,
  };
}
