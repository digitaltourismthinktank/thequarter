/**
 * The Quarter — site-wide constants (single source of truth for metadata,
 * address and the canonical URL). The URL is overridden in production by the
 * NEXT_PUBLIC_SITE_URL env var (set this to the Netlify/production domain).
 */
export const SITE = {
  name: 'The Quarter',
  tagline: 'So much more than a workspace',
  description:
    "A boutique coworking home above Canterbury's Cathedral Quarter. Come for the warmth, the natural light and the breakfast — find your focus, and an escape from home.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thequarter.netlify.app',
  locale: 'en_GB',
  address: '1st Floor, 27–28 Burgate, Canterbury, Kent, CT1 2HA',
  // Operating entity (use everywhere — footer, schema, legal pages).
  legalName: 'SE1 Media Ltd',
  company: '05732153',
  vat: 'GB 888686925',
  // A representative, warm photograph used as the default Open Graph image.
  ogImage: '/photos/photo-3939.jpg',
  // Contact — PLACEHOLDERS, replace with the real details.
  email: 'hello@thequarter.co.uk',
  phone: '+44 (0)1227 000000',
} as const;
