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
        // Member-gated areas, in-office displays + link-only pages.
        disallow: ['/dashboard', '/rewards', '/plan', '/book', '/admin', '/v/', '/i/', '/screen', '/kiosk', '/guest', '/welcome'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
