import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { ROOM_SLUGS } from '@/lib/rooms';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, '');
  const routes = [
    '',
    '/about',
    '/spaces',
    '/plans',
    '/meeting-rooms',
    '/privatise',
    '/perks',
    '/rewards',
    '/tour',
    '/events',
    '/location',
    '/day-pass',
    '/privacy',
    '/terms',
    '/code-of-conduct',
  ];
  const pages: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${base}${r}/`,
    changeFrequency: 'monthly',
    priority: r === '' ? 1 : 0.7,
  }));
  const rooms: MetadataRoute.Sitemap = ROOM_SLUGS.map((slug) => ({
    url: `${base}/meeting-rooms/${slug}/`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
  return [...pages, ...rooms];
}
