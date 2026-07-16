/**
 * The Quarter — shared privatisation schedule helpers.
 *
 * ONE source of truth for (a) recovering the cadence + weekdays a confirmed
 * privatisation occupies from its marker row, and (b) deciding whether a given
 * calendar date falls inside that privatisation. Imported by both:
 *   - privatisation.mjs (real-time weekday-exclusivity / availability), and
 *   - admin.mjs (synthesising an all-day "Privatised" row per occupied date so
 *     staff can see privatised rooms on ANY date — not only the start date).
 *
 * All date maths is UTC (new Date(`${dateStr}T00:00:00Z`), getUTCDay Mon=1..Fri=5)
 * so it agrees byte-for-byte with privatisationDates()/lib/privatisation.ts.
 */
import { F } from './_airtable.mjs';
import { isoToLondonMin, isoToLondonDate } from './_time.mjs';

/** Normalise a loose list to sorted-unique weekday numbers 1..5. */
export const normWeekdays = (arr) =>
  [...new Set((Array.isArray(arr) ? arr : []).map(Number).filter((n) => n >= 1 && n <= 5))];

/**
 * Recover { cadence:'week'|'month', weekdays:number[] } from a privatisation's
 * Notes (pass the Notes string OR the whole Airtable record). Supports BOTH:
 *   - the new token stripe-webhook.mjs appends: `slots=week:1-3` / `slots=month:1-3`
 *     → cadence from the token, weekdays are the digits after the colon, split on '-'
 *   - the LEGACY (pre-B19) Notes with NO slots token: a parenthesised day list like
 *     `one (1,3)` / `month-one (1,3)` → weekdays [1,3]; a full-week form
 *     (`full week` / `all` / `(1,2,3,4,5)`) → [1,2,3,4,5]. Legacy cadence is inferred
 *     from the frequency word: `month…` → 'month', otherwise 'week'.
 * Returns null (callers SKIP the record) only when genuinely unparseable.
 */
export function parsePrivatisationSlots(notesOrRecord) {
  const notes =
    typeof notesOrRecord === 'string'
      ? notesOrRecord
      : String(notesOrRecord?.fields?.[F.bookings.notes] || '');
  const legacyCadence = /month/i.test(notes) ? 'month' : 'week';
  // New token first: slots=<week|month>:<weekday>-<weekday>...
  const tok = notes.match(/slots=(week|month):([\d-]+)/);
  if (tok) {
    const weekdays = normWeekdays(tok[2].split('-'));
    if (weekdays.length) return { cadence: tok[1], weekdays };
  }
  // Legacy parenthesised digit list, e.g. `one (1,3)` / `(1,2,3,4,5)`.
  const paren = notes.match(/\(([\d,\s]+)\)/);
  if (paren) {
    const weekdays = normWeekdays(paren[1].split(','));
    if (weekdays.length) return { cadence: legacyCadence, weekdays };
  }
  // Legacy full-week form (webhook renders empty days as literal `(full week)`, freq `all`).
  if (/\bfull week\b/i.test(notes) || /\ball\b/i.test(notes)) return { cadence: legacyCadence, weekdays: [1, 2, 3, 4, 5] };
  return null;
}

/**
 * Exception dates an admin has cancelled for a SINGLE week of a recurring rule, stored as a
 * `skip=<YYYY-MM-DD>,<YYYY-MM-DD>` token in the rule's Notes. Cancelling "this week only" adds
 * the occurrence's date here rather than deleting the whole rule, so the series keeps running.
 */
export function parseSkipDates(notesOrRecord) {
  const notes =
    typeof notesOrRecord === 'string' ? notesOrRecord : String(notesOrRecord?.fields?.[F.bookings.notes] || '');
  const m = notes.match(/skip=([\d,-]+)/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

/**
 * Does `dateStr` (YYYY-MM-DD) fall inside a privatisation of the given cadence/weekdays,
 * starting on/after `startDate` (YYYY-MM-DD)? Mirrors privatisationDates():
 *   - WEEKLY: date's UTC weekday ∈ weekdays AND dateStr >= startDate.
 *   - MONTHLY: as weekly PLUS the date is the FIRST occurrence of that weekday in its
 *     month that is >= startDate (exactly matching privatisationDates() — this is NOT
 *     simply "day-of-month <= 7", which would disagree for a mid-month start date).
 */
export function isPrivatisedOn(dateStr, cadence, weekdays, startDate) {
  if (!Array.isArray(weekdays) || !weekdays.length) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  if (!weekdays.includes(d.getUTCDay())) return false;
  if (startDate && dateStr < startDate) return false;
  if (cadence === 'month') {
    // Occupied only on the FIRST same-weekday date in its month that is >= startDate.
    // Look one week back: if the previous same-weekday date is still in this month and not
    // before the start, then THIS date isn't the first qualifying one → not occupied.
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 7);
    const prevIso = prev.toISOString().slice(0, 10);
    if (prev.getUTCMonth() === d.getUTCMonth() && (!startDate || prevIso >= startDate)) return false;
  }
  return true;
}

/**
 * Is `record` an INDEFINITE recurring RULE (not a concrete dated row)? A rule is one Block OR
 * External row (company bookings write Kind='External') whose Notes carry a `slots=` cadence token
 * (the same token privatisations use) — so an indefinite company/external standing booking occupies
 * the room on every future weekday exactly like an indefinite plain block. The presence of the token
 * IS the signal: it is written only when a booking is created as indefinite-recurring, so we don't
 * depend on a separate boolean "Recurring" column (which not every base defines as a checkbox).
 * Concrete weekly rows created up to an end date carry NO token, so they are NOT rules — they
 * surface on their own date like any booking. Privatisation markers (Kind='Privatisation') carry a
 * slots token too but are handled by their own expansion path.
 */
export function isRecurringBlockRule(record) {
  const f = record?.fields || {};
  const kind = f[F.bookings.kind];
  if (kind !== 'Block' && kind !== 'External') return false;
  return !!parsePrivatisationSlots(f[F.bookings.notes] || '');
}

/**
 * Expand a set of Airtable booking records into the recurring-Block occurrences that fall on
 * `dateStr`. Mirrors privatisationsForDate() but for timed Block RULES: each matching rule emits
 * ONE occurrence carrying the rule's stored start/end minutes (time-of-day is date-independent,
 * so the rule row's ISO Start/End give the right window on every occupied date). Returns
 * `{ record, startMin, endMin }` so each caller can shape it (admin list row vs. busy range).
 * Cancelling the single rule row (Status≠Confirmed) makes it vanish from every future date.
 */
export function recurringBlockOccurrences(records, dateStr) {
  const out = [];
  for (const r of records) {
    if (!isRecurringBlockRule(r)) continue;
    const f = r.fields;
    const parsed = parsePrivatisationSlots(f[F.bookings.notes] || '');
    if (!parsed) continue;
    const startDate = isoToLondonDate(f[F.bookings.date]) || '';
    if (!isPrivatisedOn(dateStr, parsed.cadence, parsed.weekdays, startDate)) continue;
    if (parseSkipDates(f[F.bookings.notes] || '').includes(dateStr)) continue; // "cancel this week only" exception
    out.push({ record: r, startMin: isoToLondonMin(f[F.bookings.start]), endMin: isoToLondonMin(f[F.bookings.end]) });
  }
  return out;
}
