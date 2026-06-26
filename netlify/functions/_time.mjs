/**
 * The Quarter — time / business-hours helpers (Europe/London).
 *
 * Bookings are London wall-clock by domain convention. We store the day as a
 * plain date and times as UTC ISO (Airtable dateTime, displayed in Europe/London).
 * These helpers convert between London wall-clock and UTC, DST-aware via Intl.
 */
const TZ = 'Europe/London';

/** Business rules: Mon–Fri 08:00–18:00, 30-minute granularity; half-day splits at 13:00. */
export const BUSINESS = { openMin: 8 * 60, closeMin: 18 * 60, slotMin: 30, halfAmEnd: 13 * 60 };

export function hhmmToMin(s) {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
}
export function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Monday–Friday for a YYYY-MM-DD string (weekday is date-only, TZ-independent). */
export function isWeekday(dateStr) {
  const [Y, M, D] = String(dateStr).split('-').map(Number);
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** Europe/London offset (London − UTC, in ms) at a given UTC instant. */
function londonOffsetMs(utcMs) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asLondon = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second);
  return asLondon - utcMs;
}

/** London wall-clock (date + HH:mm) → UTC ISO string for storage. */
export function londonWallClockToISO(dateStr, hhmm) {
  const [Y, M, D] = String(dateStr).split('-').map(Number);
  const [h, m] = String(hhmm).split(':').map(Number);
  const guess = Date.UTC(Y, M - 1, D, h, m);
  return new Date(guess - londonOffsetMs(guess)).toISOString();
}

/** A stored UTC ISO → minutes-from-midnight in Europe/London (for overlap checks). */
export function isoToLondonMin(iso) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const h = +p.hour === 24 ? 0 : +p.hour;
  return h * 60 + +p.minute;
}

/** A stored UTC ISO → the Europe/London calendar date (YYYY-MM-DD). */
export function isoToLondonDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** Current Europe/London date + minutes-from-midnight. */
export function londonNow() {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const h = +p.hour === 24 ? 0 : +p.hour;
  return { dateStr: `${p.year}-${p.month}-${p.day}`, min: h * 60 + +p.minute };
}

/** Add n days to a YYYY-MM-DD string (date-only). */
export function addDays(dateStr, n) {
  const [Y, M, D] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(Y, M - 1, D + n)).toISOString().slice(0, 10);
}
