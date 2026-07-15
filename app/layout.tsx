import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { DM_Sans } from 'next/font/google';
import { SITE } from '@/lib/site';
import { MEMBERSTACK_APP_ID } from '@/lib/memberstack';
import { SiteHeader, SiteFooter } from '@/components/site/SiteChrome';
import { JsonLd } from '@/components/site/JsonLd';
import { TopProgress } from '@/components/site/TopProgress';
import { PWARegister } from '@/components/site/PWARegister';
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
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'The Quarter' },
  icons: { icon: '/icon.png', apple: '/icon.png' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${SITE.name} — ${SITE.tagline}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#1e1a15',
};

const LOCAL_BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': SITE.url,
  name: SITE.name,
  legalName: SITE.legalName,
  vatID: SITE.vat,
  description: SITE.description,
  url: SITE.url,
  image: `${SITE.url.replace(/\/$/, '')}${SITE.ogImage}`,
  email: SITE.email,
  telephone: SITE.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1st & 2nd Floor, 27–28 Burgate',
    addressLocality: 'Canterbury',
    addressRegion: 'Kent',
    postalCode: 'CT1 2HA',
    addressCountry: 'GB',
  },
  areaServed: 'Canterbury',
  priceRange: '££',
  slogan: SITE.tagline,
  geo: { '@type': 'GeoCoordinates', latitude: 51.2798, longitude: 1.0817 },
  hasMap: 'https://www.google.com/maps?q=27-28+Burgate,+Canterbury,+CT1+2HA',
  knowsAbout: ['Co-working', 'Meeting rooms', 'Registered office', 'Hot desking', 'Canterbury Cathedral Quarter'],
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'High-speed fibre WiFi', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Meeting rooms', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Phone pods', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Free coffee & breakfast', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Dog friendly', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Registered office address', value: true },
  ],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:30',
    },
  ],
};

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  publisher: { '@id': SITE.url },
  inLanguage: 'en-GB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={dmSans.variable}>
      <body>
        {/* Memberstack runs in production only. In local dev it would gate the
            member pages (test mode → bounce to /login); the dev preview mock
            (lib/devMock) stands in for it instead. */}
        {process.env.NODE_ENV === 'production' ? (
          <Script
            src="https://static.memberstack.com/scripts/v1/memberstack.js"
            data-memberstack-app={MEMBERSTACK_APP_ID}
            strategy="beforeInteractive"
          />
        ) : null}
        {/* Cookiescript — GDPR consent banner (gates non-essential cookies). The
            cookie-policy report script lives on the privacy page. */}
        <Script src="https://cdn.cookie-script.com/s/064e38604f7ba35680d8f547f21c404a.js" strategy="afterInteractive" />
        {/* Crisp chat. The launcher bubble is visible so people can always reach us;
            our own "Talk to us" / "Chat to our team" buttons also open it directly.
            NOTE: Crisp only renders on its whitelisted domain(s) in the Crisp dashboard —
            add www.thequarter.work AND any *.netlify.app deploy-preview domain there, or
            the bubble won't appear on the preview URL. */}
        <Script id="crisp" strategy="afterInteractive">{`
          window.$crisp=[];window.CRISP_WEBSITE_ID="9a243419-809f-4f2a-9a77-56bdff85cd0d";
          window.$crisp.push(["safe", true]);
          (function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
        `}</Script>
        <JsonLd data={LOCAL_BUSINESS} />
        <JsonLd data={WEBSITE} />
        <PWARegister />
        <TopProgress />
        <a href="#main" className="q-skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
