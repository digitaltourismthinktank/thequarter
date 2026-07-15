/**
 * The Quarter — commerce wiring. Everything is native, in-site Stripe now:
 *   · Plans (Visitor / Resident / Citizen / Hybrid) → /join/[plan] (Stripe Elements subscription)
 *   · Day Pass + carnet → in-site Stripe PaymentIntent (Payment Element)
 *   · Meeting rooms / pods / privatisation → their own native flows
 * No Stripe Payment Links, no Typeform. Only the public publishable key + the
 * billing-portal fallback URL live here.
 */

/** Stripe publishable key (public by design) — used client-side by Stripe Elements
 *  so payments happen in-site (rooms, plans, Day Pass, carnet, card updates). */
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? 'pk_live_eBhLPhjrDvYGMPBqUKlDNUN9';

/** Stripe billing portal (members manage / switch plan) — the fallback for the
 *  dashboard's "Manage plan" button until the one-click billing-portal Function
 *  (/.netlify/functions/billing-portal) is live with a Stripe key. */
export const STRIPE_BILLING_PORTAL_URL =
  process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL ?? 'https://billing.stripe.com/p/login/fZe0346QK2iQ3Wo4gg';
