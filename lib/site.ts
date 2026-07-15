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

/** A single breadcrumb step (a page in the trail). Home is prepended automatically. */
export interface Crumb {
  name: string;
  path: string;
}

/**
 * Absolute URL for a site path, built from SITE.url (the single source of the
 * domain — never hardcode it). Handles the trailing slash and leading slash so
 * absoluteUrl('/') === `${origin}/` and absoluteUrl('/plans') === `${origin}/plans`.
 */
export function absoluteUrl(path: string): string {
  const base = SITE.url.replace(/\/$/, '');
  if (path === '/' || path === '') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * BreadcrumbList JSON-LD. Always leads with Home ("/"); positions start at 1.
 * Pass the trail *after* Home, e.g. breadcrumbLd([{ name: 'Plans', path: '/plans' }]).
 * Item URLs are absolute (SITE.url + path).
 */
export function breadcrumbLd(trail: Crumb[]): Record<string, unknown> {
  const items: Crumb[] = [{ name: 'Home', path: '/' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}
