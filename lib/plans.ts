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
