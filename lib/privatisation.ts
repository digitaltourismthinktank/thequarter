/**
 * The Quarter — team-room privatisation (sold on-site as a custom Stripe
 * subscription, invoiced quarterly).
 *
 * A company privatises ONE of the two flexible team rooms (The Hop Yard or The
 * Vineyard) on recurring days. Only ONE of the two may be privatised at any time,
 * so there are always two open workspaces free. Minimum five members.
 *
 * Pricing = the full room capacity paid at the plan pass-rate matching the chosen
 * frequency (a built-in premium vs. individual desks). Figures are £/month inc-VAT;
 * the subscription is billed QUARTERLY (3× monthly) from the chosen start date.
 * This file is the single source of truth — the server (privatisation.mjs) mirrors
 * these numbers so the amount charged is never trusted from the client.
 */

import { PHOTOS } from './media';

export type FrequencyId = 'one' | 'two' | 'all' | 'month-one' | 'month-two';

export interface PrivatisationRoom {
  slug: string;
  name: string;
  capacity: number;
  blurb: string;
  /** £/month inc-VAT by frequency. */
  monthly: Record<FrequencyId, number>;
  /** Occasional single-day rate (inc-VAT) for ad-hoc buy-outs. */
  perDay: number;
  photo: { src: string; alt: string };
}

export const PRIVATISATION_ROOMS: PrivatisationRoom[] = [
  {
    slug: 'the-hop-yard',
    name: 'The Hop Yard',
    capacity: 7,
    blurb: 'Our larger team room — seats seven, with room to spread out.',
    // Weekly passes (one/two/all) plus monthly cadence priced at the room's perDay × days.
    monthly: { one: 588, two: 966, all: 1806, 'month-one': 151, 'month-two': 302 },
    perDay: 151,
    photo: PHOTOS.hopYard,
  },
  {
    slug: 'the-vineyard',
    name: 'The Vineyard',
    capacity: 6,
    blurb: 'A snug six-seat team room with its own door and natural light.',
    monthly: { one: 504, two: 828, all: 1548, 'month-one': 130, 'month-two': 260 },
    perDay: 130,
    photo: PHOTOS.vineyard,
  },
];

export interface Frequency {
  id: FrequencyId;
  label: string;
  short: string;
  /** 'week' = the chosen weekday(s) every week; 'month' = the first such weekday each month. */
  cadence: 'week' | 'month';
  /** How many weekdays the company picks (1 or 2). */
  days: number;
}

// Max 1–2 days per company, weekly or monthly — we privatise, we don't lease offices. (One
// room can still fill across several companies on different weekdays; the per-weekday
// availability check greys out days already taken on that room.)
export const FREQUENCIES: Frequency[] = [
  { id: 'one', label: 'One day a week', short: '1 day/wk', cadence: 'week', days: 1 },
  { id: 'two', label: 'Two days a week', short: '2 days/wk', cadence: 'week', days: 2 },
  { id: 'month-one', label: 'One day a month', short: '1 day/mo', cadence: 'month', days: 1 },
  { id: 'month-two', label: 'Two days a month', short: '2 days/mo', cadence: 'month', days: 2 },
];

export const PRIVATISATION_MIN_MEMBERS = 5;

/** Monthly figures are billed quarterly (three months at a time). */
export const QUARTERLY_MULTIPLIER = 3;
export const quarterlyAmount = (monthly: number) => monthly * QUARTERLY_MULTIPLIER;

export const getPrivatisationRoom = (slug: string) => PRIVATISATION_ROOMS.find((r) => r.slug === slug);
export const getFrequency = (id: string) => FREQUENCIES.find((f) => f.id === id);

/**
 * The specific calendar dates a privatisation would occupy over a `months`-long horizon.
 *
 * Weekdays are 1..5 (Mon..Fri) to match getUTCDay (Sun=0..Sat=6). All maths is done in UTC
 * so it never drifts with the viewer's timezone or DST. Returns sorted, de-duplicated
 * 'YYYY-MM-DD' strings; [] for no weekdays.
 *
 * WEEKLY  — every date from startDate (inclusive) up to startDate+months (exclusive) whose
 *           UTC weekday is one of `weekdays`.
 * MONTHLY — for each of the `months` calendar months starting with startDate's own month,
 *           each chosen weekday contributes the FIRST date in that month with that weekday
 *           that is >= startDate. (So a weekday whose only occurrences in the start month
 *           all fall before startDate simply yields nothing for that first month.)
 *
 * The server (privatisation.mjs) mirrors this logic byte-for-byte so the client preview and
 * the authoritative availability check agree on the exact dates.
 */
export function privatisationDates(
  cadence: 'week' | 'month',
  weekdays: number[],
  startDate: string,
  months = 3,
): string[] {
  if (!weekdays.length) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const out = new Set<string>();

  if (cadence === 'week') {
    const wanted = new Set(weekdays);
    // Upper bound: startDate + months (exclusive).
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + months);
    const cur = new Date(start);
    while (cur < end) {
      if (wanted.has(cur.getUTCDay())) out.add(iso(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else {
    for (let mi = 0; mi < months; mi++) {
      const y = start.getUTCFullYear();
      const mo = start.getUTCMonth() + mi;
      for (const wd of weekdays) {
        // Walk the days of this month; take the first matching weekday that is >= startDate.
        for (let day = 1; day <= 31; day++) {
          const d = new Date(Date.UTC(y, mo, day));
          if (d.getUTCMonth() !== ((mo % 12) + 12) % 12) break; // rolled into the next month
          if (d.getUTCDay() !== wd) continue;
          if (d >= start) {
            out.add(iso(d));
            break;
          }
        }
      }
    }
  }
  return [...out].sort();
}

/** The days of the week a company can pick from (Mon–Fri). */
export const WEEKDAYS = [
  { id: 1, label: 'Monday', short: 'Mon' },
  { id: 2, label: 'Tuesday', short: 'Tue' },
  { id: 3, label: 'Wednesday', short: 'Wed' },
  { id: 4, label: 'Thursday', short: 'Thu' },
  { id: 5, label: 'Friday', short: 'Fri' },
];
