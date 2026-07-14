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

export type FrequencyId = 'one' | 'two' | 'all';

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
    monthly: { one: 588, two: 966, all: 1806 },
    perDay: 151,
    photo: PHOTOS.hopYard,
  },
  {
    slug: 'the-vineyard',
    name: 'The Vineyard',
    capacity: 6,
    blurb: 'A snug six-seat team room with its own door and natural light.',
    monthly: { one: 504, two: 828, all: 1548 },
    perDay: 130,
    photo: PHOTOS.vineyard,
  },
];

export interface Frequency {
  id: FrequencyId;
  label: string;
  short: string;
  daysPerWeek: number;
}

export const FREQUENCIES: Frequency[] = [
  { id: 'one', label: 'One day a week', short: '1 day/wk', daysPerWeek: 1 },
  { id: 'two', label: 'Two days a week', short: '2 days/wk', daysPerWeek: 2 },
  { id: 'all', label: 'Every working day', short: 'Full week', daysPerWeek: 5 },
];

export const PRIVATISATION_MIN_MEMBERS = 5;

/** Monthly figures are billed quarterly (three months at a time). */
export const QUARTERLY_MULTIPLIER = 3;
export const quarterlyAmount = (monthly: number) => monthly * QUARTERLY_MULTIPLIER;

export const getPrivatisationRoom = (slug: string) => PRIVATISATION_ROOMS.find((r) => r.slug === slug);
export const getFrequency = (id: string) => FREQUENCIES.find((f) => f.id === id);

/** The days of the week a company can pick from (Mon–Fri). */
export const WEEKDAYS = [
  { id: 1, label: 'Monday', short: 'Mon' },
  { id: 2, label: 'Tuesday', short: 'Tue' },
  { id: 3, label: 'Wednesday', short: 'Wed' },
  { id: 4, label: 'Thursday', short: 'Thu' },
  { id: 5, label: 'Friday', short: 'Fri' },
];
