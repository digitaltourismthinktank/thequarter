/* The Quarter — service worker (PWA installability + a light asset cache).
 * Deliberately conservative for a member portal: navigations and API calls always
 * go to the network (so auth state + live data are never stale); only same-origin
 * static assets are cached.
 *
 * TWO caches, on purpose:
 *   STATIC  — immutable build assets under /_next/static/ (content-hashed filenames). NEVER purged
 *             by a version bump, so a tab still running the OLD build can always find its chunks
 *             even after a new deploy. This is what stops the "ChunkLoadError / obscure update
 *             error" — previously the version bump deleted the old chunks out from under open tabs.
 *   PAGES   — visited HTML (so a page + the Quarter Card open offline). Versioned + purged on bump. */
const VERSION = 'quarter-v53';
const STATIC = 'quarter-static';
const PAGES = VERSION;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep the persistent static cache and the current pages cache; drop only OLD page caches.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'The Quarter';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hit = all.find((c) => c.url.includes(url));
      if (hit) return hit.focus();
      return self.clients.openWindow(url);
    })(),
  );
});

/* The push service occasionally rotates a subscription's endpoint. Re-subscribe with the same VAPID
 * key so pushes keep flowing; the app re-saves the fresh endpoint to the member record on next load
 * (which is what stops admin/member notifications silently dying against a stale endpoint). */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
        if (key) await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      } catch {
        /* best-effort — the app resubscribes on next open */
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave Stripe/Crisp/etc. alone

  // Serverless functions: always the network, never cached (auth + live data).
  if (url.pathname.startsWith('/.netlify/')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Immutable build assets (content-hashed): cache-first in the PERSISTENT cache. They never go
  // stale (the hash changes when the content does), and keeping them means an open tab from the
  // previous deploy can still load its chunks — no ChunkLoadError when a new version ships.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(request, copy));
          }
          return res;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Pages: network-first, but cache each visited page so it (and the Quarter Card) still open
  // offline; fall back to the cached page, else the cached dashboard.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(request, copy));
          }
          return res;
        } catch {
          return (await caches.match(request)) || (await caches.match('/dashboard/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Other same-origin static (icons, images): serve from cache immediately, refresh in background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
