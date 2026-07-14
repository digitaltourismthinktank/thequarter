import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/**
 * PWA manifest — makes the member portal installable to the home screen (iOS +
 * Android), opening full-screen like an app. start_url is the member dashboard
 * (which bounces to /login when signed out). Icons live in /public.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Quarter — Member Portal',
    short_name: 'The Quarter',
    description: 'Check in, book rooms and carry your Quarter Card — the member app for The Quarter, Canterbury.',
    start_url: '/dashboard/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f1e7',
    theme_color: '#1e1a15',
    lang: 'en-GB',
    categories: ['business', 'productivity', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Check in', short_name: 'Check in', url: '/dashboard/' },
      { name: 'My Quarter Card', short_name: 'Card', url: '/rewards/' },
      { name: 'Book a room', short_name: 'Book', url: '/book/' },
    ],
  };
}
