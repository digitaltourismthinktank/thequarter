import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Member-gated areas, in-office displays + link-only pages. (/rewards and
        // /perks are public marketing pages — crawlable.)
        disallow: ['/dashboard', '/plan', '/book', '/admin', '/v/', '/i/', '/screen', '/kiosk', '/guest', '/welcome', '/arrive'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
