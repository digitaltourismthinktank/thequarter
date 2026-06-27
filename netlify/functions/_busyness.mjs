/**
 * The Quarter — server mirror of lib/busyness.ts (keep the two in sync).
 * Used by the earn engine for the quiet-day check-in bonus and by the displays/
 * closed-day logic. Atmosphere model, not capacity.
 */
const DAY_BASE = [0, 3.4, 4.8, 3.3, 4.1, 2.7, 0]; // Sun..Sat (weekends 0 = closed)
const MONTH_FACTOR = [1.25, 1.1, 1.0, 0.75, 0.68, 0.88, 0.75, 0.8, 1.0, 1.15, 1.2, 1.15];
const GROWTH_FACTOR = 1.0;

export function isWeekend(d) {
  const x = d.getDay();
  return x === 0 || x === 6;
}

export function expectedPeople(d) {
  return DAY_BASE[d.getDay()] * MONTH_FACTOR[d.getMonth()] * GROWTH_FACTOR;
}

/** One of quiet | steady | busy | buzzing (matches lib/busyness.ts bands). */
export function bandId(d) {
  const e = expectedPeople(d);
  if (e < 2.5) return 'quiet';
  if (e < 3.7) return 'steady';
  if (e < 5.0) return 'busy';
  return 'buzzing';
}

/** A YYYY-MM-DD London date is "quiet" if it's a weekday in the quiet band. */
export function isQuietDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return !isWeekend(d) && bandId(d) === 'quiet';
}
