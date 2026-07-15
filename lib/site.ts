/**
 * The Quarter — site-wide constants (single source of truth for metadata,
 * address and the canonical URL). The URL is overridden in production by the
 * NEXT_PUBLIC_SITE_URL env var (set this to the Netlify/production domain).
 */
export const SITE = {
  name: 'The Quarter',
  tagline: 'So much more than a workspace',
  description:
    'A boutique co-working space right next to Canterbury Cathedral, with incredible Cathedral views, great workspaces and free coffee and snacks throughout the day.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.thequarter.work',
  locale: 'en_GB',
  address: '1st & 2nd Floor, 27–28 Burgate, Canterbury, Kent, CT1 2HA',
  // Operating entity (use everywhere — footer, schema, legal pages).
  legalName: 'SE1 Media Ltd',
  company: '05732153',
  vat: 'GB 888686925',
  // A representative, warm photograph used as the default Open Graph image.
  ogImage: '/photos/cathedral-view.jpg',
  // Contact.
  email: 'info@thequarter.work',
  phone: '01227 202 227',
  hours: 'Mon–Fri, 09:00–17:30',
} as const;
