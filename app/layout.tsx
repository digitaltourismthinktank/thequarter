import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { SITE } from '@/lib/site';
import { AnnouncementBar } from '@/components/site/AnnouncementBar';
import { Navbar } from '@/components/site/Navbar';
import { Footer } from '@/components/site/Footer';
import { JsonLd } from '@/components/site/JsonLd';
import '@/styles/globals.css';

/* DM Sans — the one family, self-hosted via next/font (no render-blocking
   request, no layout shift). Exposed to the token layer as --font-dm-sans,
   which tokens/typography.css feeds into --font-sans. */
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  icons: { icon: '/icon.png', apple: '/icon.png' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [SITE.ogImage],
  },
};

const LOCAL_BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': SITE.url,
  name: SITE.name,
  description: SITE.description,
  url: SITE.url,
  image: `${SITE.url.replace(/\/$/, '')}${SITE.ogImage}`,
  email: SITE.email,
  telephone: SITE.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'First floor, Cathedral Quarter',
    addressLocality: 'Canterbury',
    addressRegion: 'Kent',
    addressCountry: 'GB',
  },
  areaServed: 'Canterbury',
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '18:00',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={dmSans.variable}>
      <body>
        <JsonLd data={LOCAL_BUSINESS} />
        <a href="#main" className="q-skip-link">
          Skip to content
        </a>
        <AnnouncementBar
          message="New here? The Day Pass is our way in — a full day, breakfast included."
          href="/day-pass"
          linkLabel="Book a Day Pass"
        />
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
