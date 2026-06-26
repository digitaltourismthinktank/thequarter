/**
 * The Quarter — busyness model for the entrance "how busy is it likely to be" screen.
 * Derived from 14 months of booking data (the-quarter-busyness-model.md).
 *
 * expected people = dayBase[weekday] × monthFactor[month] × growthFactor → band.
 * Desks effectively never sell out, so this communicates ATMOSPHERE, not capacity.
 * Whole rooms are the only real scarcity (shown separately from live bookings).
 *
 * Brand: black/white/gold, NO green, NO traffic-light scale. Never say desks are
 * "full". Bank holidays / Christmas are layered on at the screen (gov.uk feed).
 */
export interface Band {
  id: 'quiet' | 'steady' | 'busy' | 'buzzing';
  label: string;
  line: string;
}

const BANDS: (Band & { min: number; max: number })[] = [
  { id: 'quiet', min: 0, max: 2.5, label: 'Quiet', line: "A calm one. Perfect if you're here to find your focus." },
  { id: 'steady', min: 2.5, max: 3.7, label: 'Steady', line: "A comfortable hum. Company when you want it, quiet when you don't." },
  { id: 'busy', min: 3.7, max: 5.0, label: 'Busy', line: 'Lively and sociable. A good day for familiar faces.' },
  { id: 'buzzing', min: 5.0, max: 99, label: 'Buzzing', line: 'Our liveliest. Come for the company (and the coffee).' },
];

// Indexed by Date.getDay(): Sun..Sat. Weekends are 0 (closed).
const DAY_BASE = [0, 3.4, 4.8, 3.3, 4.1, 2.7, 0];
// Indexed by Date.getMonth(): Jan..Dec.
const MONTH_FACTOR = [1.25, 1.1, 1.0, 0.75, 0.68, 0.88, 0.75, 0.8, 1.0, 1.15, 1.2, 1.15];
const GROWTH_FACTOR = 1.0; // a floor; raise / recalibrate as live data grows.

// Chance any meeting room is booked, by weekday (Mon..Fri).
const MEETING_BOOKED_CHANCE: Record<number, number> = { 1: 0.18, 2: 0.47, 3: 0.18, 4: 0.53, 5: 0.11 };

export function isWeekend(d: Date): boolean {
  const x = d.getDay();
  return x === 0 || x === 6;
}

export function expectedPeople(d: Date): number {
  return DAY_BASE[d.getDay()] * MONTH_FACTOR[d.getMonth()] * GROWTH_FACTOR;
}

/** The busyness band for a date, or closed (weekends; extend with bank holidays). */
export function busyness(d: Date): { closed: boolean; band?: Band } {
  if (isWeekend(d)) return { closed: true };
  const e = expectedPeople(d);
  const b = BANDS.find((x) => e >= x.min && e < x.max) ?? BANDS[BANDS.length - 1];
  return { closed: false, band: { id: b.id, label: b.label, line: b.line } };
}

/** A warm, on-brand line about meeting-room availability for the day. */
export function meetingRoomLine(d: Date): string {
  const dow = d.getDay();
  const high = (MEETING_BOOKED_CHANCE[dow] ?? 0) >= 0.4;
  return high
    ? 'Meeting rooms usually available — Tuesdays and Thursdays fill first, so book ahead.'
    : 'Meeting rooms usually available.';
}
