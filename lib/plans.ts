import {
  STRIPE_VISITOR_URL,
  STRIPE_RESIDENT_URL,
  STRIPE_CITIZEN_URL,
  STRIPE_HYBRID_OFFICE_URL,
  checkoutHref,
} from './commerce';

/** The Quarter — membership plans. Prices include VAT. */

export type PlanId = 'day-pass' | 'visitor' | 'resident' | 'citizen' | 'hybrid-office';

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  summary: string;
  features: string[];
  featured?: boolean;
  badge?: string;
  ctaLabel: string;
  ctaHref: string;
}

export const PLANS: Plan[] = [
  {
    id: 'day-pass',
    name: 'Day Pass',
    price: '£21.60',
    period: 'one day',
    summary: 'Your way in. A single day to feel the place.',
    features: [
      'Fibre & ergonomic desks',
      'Plug-and-play A/V',
      'Daily healthy breakfast',
      'Lavazza coffee & premium drinks',
      'Access to the Flexi Rooms',
    ],
    ctaLabel: 'Book a Day Pass',
    ctaHref: '/day-pass',
  },
  {
    id: 'visitor',
    name: 'Visitor',
    price: '£84',
    period: 'five days',
    summary: 'Five days to use across the month.',
    features: [
      'Everything in Day Pass',
      'Five days’ access, flexible',
      'Meeting & flexi room credits',
      'Hybrid Office included free',
      'Cancel any time',
    ],
    ctaLabel: 'Choose Visitor',
    ctaHref: checkoutHref(STRIPE_VISITOR_URL),
  },
  {
    id: 'resident',
    name: 'Resident',
    price: '£138',
    period: 'ten days',
    summary: 'Ten days a month to call your own.',
    features: [
      'Everything in Visitor',
      'Ten days’ access a month',
      'Your favourite corner, most weeks',
      'Hybrid Office included free',
    ],
    ctaLabel: 'Choose Resident',
    ctaHref: checkoutHref(STRIPE_RESIDENT_URL),
  },
  {
    id: 'citizen',
    name: 'Citizen',
    price: '£258',
    period: 'a month',
    featured: true,
    badge: 'Most loved',
    summary: 'Unrestricted. For those who are mostly here.',
    features: [
      'Everything in Resident',
      'Unrestricted access',
      'Priority room booking',
      'A registered office address',
    ],
    ctaLabel: 'Choose Citizen',
    ctaHref: checkoutHref(STRIPE_CITIZEN_URL),
  },
  {
    id: 'hybrid-office',
    name: 'Hybrid Office',
    price: '£42',
    period: 'a month · billed annually',
    summary: 'A Canterbury address, plus days when you need them.',
    features: [
      'Canterbury mailing address',
      'Mail notification, with digital forwarding or collection',
      'Twelve co-working days a year',
      'Additional services as required',
    ],
    ctaLabel: 'Choose Hybrid Office',
    ctaHref: checkoutHref(STRIPE_HYBRID_OFFICE_URL),
  },
];

export function getPlan(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/**
 * Monthly day allowance per plan (null = unlimited). Mirrors the server-side
 * PLAN_ALLOWANCE in netlify/functions/_quarter-sync.mjs; used on the dashboard to
 * show how many of the member's remaining days are rolled over from last month.
 */
export const PLAN_DAY_ALLOWANCE: Record<PlanId, number | null> = {
  'day-pass': 1,
  visitor: 5,
  resident: 10,
  citizen: null,
  'hybrid-office': 12,
};

/** Our plan slug → Memberstack plan id (for the post-payment /welcome signup). */
export const PLAN_MEMBERSTACK_ID: Record<PlanId, string> = {
  'day-pass': 'pln_daily-plan-45nv0v26',
  visitor: 'pln_visitor-plan-blk50re2',
  resident: 'pln_resident-plan-mqjy0f6w',
  citizen: 'pln_citizen-plan-q9oa04p9',
  'hybrid-office': 'pln_hybrid-plan-r4k60rjp',
};

/**
 * Stripe recurring price ids per plan + term, for the native in-dashboard plan
 * switch (see /plan and netlify/functions/plan-change.mjs). The server keeps the
 * matching allow-list — keep the two in sync. Hybrid Office is annual-only.
 */
export const PLAN_STRIPE_PRICE: Partial<Record<PlanId, { monthly?: string; annual?: string }>> = {
  visitor: { monthly: 'price_0PgRo1w5GSGOu4zJdycNlCpy', annual: 'price_0Tn4ucw5GSGOu4zJ7UqWhlO8' },
  resident: { monthly: 'price_0PgRphw5GSGOu4zJ0dnCFwjp', annual: 'price_0Tn4Nmw5GSGOu4zJwV8L1Imz' },
  citizen: { monthly: 'price_0PgS1pw5GSGOu4zJQpVlN6Gm', annual: 'price_0Tn4MXw5GSGOu4zJLe6oAQEu' },
  'hybrid-office': { annual: 'price_0OtrBRw5GSGOu4zJC3vsROvC' },
};
