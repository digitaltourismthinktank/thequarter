/**
 * The Quarter — commerce wiring (phase 1).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  FILL THESE IN.                                                            │
 * │                                                                            │
 * │  Subscriptions (Visitor, Resident, Citizen) and the annual Hybrid Office   │
 * │  go through Stripe Checkout. Paste each plan's Stripe Checkout / Payment   │
 * │  Link URL below, or set the matching NEXT_PUBLIC_STRIPE_*_URL env var      │
 * │  (env wins). Until a URL is set, that plan's CTA falls back to the         │
 * │  contact page so nothing 404s.                                             │
 * │                                                                            │
 * │  The Day Pass (£21.60 one-off) is a Typeform embed for now — set           │
 * │  TYPEFORM_DAYPASS_URL. It's isolated in components/site/DayPassEmbed so it  │
 * │  can be swapped to Stripe Checkout later without touching the page.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export const STRIPE_VISITOR_URL =
  process.env.NEXT_PUBLIC_STRIPE_VISITOR_URL ?? 'https://buy.stripe.com/aEU4jF9MM62j9Gg4hj';
export const STRIPE_RESIDENT_URL =
  process.env.NEXT_PUBLIC_STRIPE_RESIDENT_URL ?? 'https://buy.stripe.com/4gw6rN1ggbmDbOo3dg';
export const STRIPE_CITIZEN_URL =
  process.env.NEXT_PUBLIC_STRIPE_CITIZEN_URL ?? 'https://buy.stripe.com/4gw4jFf760HZ4lWeVZ';
export const STRIPE_HYBRID_OFFICE_URL =
  process.env.NEXT_PUBLIC_STRIPE_HYBRID_OFFICE_URL ?? 'https://buy.stripe.com/fZe8zVf763UbcSs299';

export const TYPEFORM_DAYPASS_URL =
  process.env.NEXT_PUBLIC_TYPEFORM_DAYPASS_URL ?? 'https://dttt.typeform.com/to/VScIAjrW';

/** Where a CTA points when its checkout URL isn't configured yet. */
export const CHECKOUT_FALLBACK = '/location';

/** Returns the checkout URL if set, otherwise a safe internal fallback. */
export function checkoutHref(url: string): string {
  return url && url.trim().length > 0 ? url : CHECKOUT_FALLBACK;
}

/** True when a checkout URL is still a placeholder (unconfigured). */
export function isCheckoutConfigured(url: string): boolean {
  return Boolean(url && url.trim().length > 0);
}
