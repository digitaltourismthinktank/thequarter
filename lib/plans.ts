/* Plan CTAs go to the native in-site checkout at /join/[plan] — Stripe Elements,
   no Payment Links, no redirect out. Day Pass has its own one-off checkout. */

/** The Quarter — membership plans. Prices include VAT. */

import type { IconName } from '@/components/ds/Icon';

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
  /**
   * One-off Quarter Rewards welcome bonus granted on joining this plan (in points).
   * Surfaced as the gold reward callout on the PlanCard. MUST match JOIN_BONUS in
   * netlify/functions/stripe-webhook.mjs (visitor 250 / resident 500 / citizen 1000).
   * Absent = no welcome bonus (Day Pass, Hybrid Office).
   */
  welcomeReward?: number;
}

export const PLANS: Plan[] = [
  {
    id: 'day-pass',
    name: 'Day Pass',
    price: '£21.60',
    period: 'one day',
    summary: 'Your way in. A single day to feel the place.',
    features: [
      'Fibre broadband & a monitor at every desk',
      'Plug-and-play A/V',
      'Daily breakfast, yoghurts & cereals',
      'Bean-to-cup coffee & premium drinks',
      'Use of the phone pods',
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
    welcomeReward: 250,
    features: [
      'Five days’ access each month',
      'From £16.80 a working day',
      'Everything in the Day Pass, included',
      '24/7 access',
      'A registered office address',
      'Cancel any time',
    ],
    ctaLabel: 'Choose Visitor',
    ctaHref: '/join/visitor',
  },
  {
    id: 'resident',
    name: 'Resident',
    price: '£138',
    period: 'ten days',
    featured: true,
    badge: 'Most popular',
    summary: 'Ten days a month to call your own.',
    welcomeReward: 500,
    features: [
      'Ten days’ access each month',
      'From £13.80 a working day',
      'Everything in Visitor, included',
      '24/7 access',
      'A registered office address',
      'Cancel any time',
    ],
    ctaLabel: 'Choose Resident',
    ctaHref: '/join/resident',
  },
  {
    id: 'citizen',
    name: 'Citizen',
    price: '£258',
    period: 'a month',
    summary: 'Unrestricted. For those who are mostly here.',
    welcomeReward: 1000,
    features: [
      'Unlimited days — work here every day',
      'Everything in Resident, included',
      'Priority room booking',
      '24/7 access',
      'A registered office address',
      'Cancel any time',
    ],
    ctaLabel: 'Choose Citizen',
    ctaHref: '/join/citizen',
  },
  {
    id: 'hybrid-office',
    name: 'Hybrid Office',
    price: '£42',
    period: 'a month · billed annually',
    summary: 'A registered Canterbury address, plus a day a month to work in.',
    features: [
      'Registered office & mailing address',
      'Mail notification, with digital forwarding or collection',
      'Twelve co-working days a year',
      'Additional services as required',
    ],
    ctaLabel: 'Choose Hybrid Office',
    ctaHref: '/join/hybrid-office',
  },
];

export function getPlan(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/**
 * Per-plan benefit bullets for the native join flow (components/site/JoinClient.tsx
 * "details" step). Icon + text, rendered as a tidy list. The welcome-reward figures
 * MUST match JOIN_BONUS in netlify/functions/stripe-webhook.mjs (visitor 250 /
 * resident 500 / citizen 1000 / hybrid-office none — deliberately no welcome bullet).
 * Day Pass has its own one-off checkout, so it has no join bullets here.
 */
export interface PlanBenefit {
  icon: IconName;
  text: string;
}

export const PLAN_BENEFITS: Partial<Record<PlanId, PlanBenefit[]>> = {
  visitor: [
    { icon: 'pound-sterling', text: '£84 per month, everything included' },
    { icon: 'calendar', text: '5 days access per month' },
    { icon: 'map-pin', text: 'Register your business address at The Quarter' },
    { icon: 'monitor', text: 'Pick any available workspace, monitor included' },
    { icon: 'coffee', text: 'Unlimited coffee, refreshments, cereals, yoghurts and pastries' },
    { icon: 'gift', text: '250 welcome rewards' },
    { icon: 'sparkles', text: 'Earn extra rewards by checking in on quiet days' },
    { icon: 'users', text: 'Join member socials every month' },
    { icon: 'badge-check', text: 'No long-term commitment, cancel any time' },
  ],
  resident: [
    { icon: 'pound-sterling', text: '£138 per month, everything included' },
    { icon: 'calendar', text: '10 days access per month' },
    { icon: 'map-pin', text: 'Register your business address at The Quarter' },
    { icon: 'monitor', text: 'Pick any available workspace, monitor included' },
    { icon: 'coffee', text: 'Unlimited coffee, refreshments, cereals, yoghurts and pastries' },
    { icon: 'gift', text: '500 welcome rewards' },
    { icon: 'sparkles', text: 'Earn extra rewards by checking in on quiet days' },
    { icon: 'users', text: 'Join member socials every month' },
    { icon: 'badge-check', text: 'No long-term commitment, cancel any time' },
  ],
  citizen: [
    { icon: 'pound-sterling', text: '£258 per month, everything included' },
    { icon: 'calendar', text: 'Unlimited days access' },
    { icon: 'map-pin', text: 'Register your business address at The Quarter' },
    { icon: 'monitor', text: 'Pick any available workspace, monitor included' },
    { icon: 'coffee', text: 'Unlimited coffee, refreshments, cereals, yoghurts and pastries' },
    { icon: 'gift', text: '1000 welcome rewards' },
    { icon: 'sparkles', text: 'Earn extra rewards by checking in on quiet days' },
    { icon: 'users', text: 'Join member socials every month' },
    { icon: 'badge-check', text: 'No long-term commitment, cancel any time' },
  ],
  'hybrid-office': [
    { icon: 'map-pin', text: 'Register your business address at The Quarter' },
    { icon: 'pound-sterling', text: '£42 per month, billed annually (£504/year)' },
    { icon: 'calendar', text: '12 days access per year' },
    { icon: 'monitor', text: 'Pick any available workspace, monitor included' },
    { icon: 'coffee', text: 'Unlimited coffee, refreshments, cereals, yoghurts and pastries' },
    { icon: 'sparkles', text: 'Earn extra rewards by checking in on quiet days' },
    { icon: 'users', text: 'Join member socials every month' },
    { icon: 'badge-check', text: 'No long-term commitment, cancel any time' },
  ],
};

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
