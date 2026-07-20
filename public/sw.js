/* The Quarter — service worker (PWA installability + a light asset cache).
 * Deliberately conservative for a member portal: navigations and API calls always
 * go to the network (so auth state + live data are never stale); only same-origin
 * static assets are cached (cache-first, revalidated in the background). */
/* Bump this on any release that changes cached assets. The activate handler deletes every
 * cache whose key isn't the current one, so changing the version purges stale HTML and CSS
 * for everyone on their next open. Without a bump the name never changes, nothing is ever
 * evicted, and a device that cached an old page keeps serving it — that page references the
 * old hashed CSS, which is also still cached, so the staleness is self-consistent and can
 * persist indefinitely. */
const CACHE = 'quarter-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
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

  // Pages: network-first, but cache each visited page so it (and the Quarter Card)
  // still open offline; fall back to the cached page, else the cached dashboard.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        } catch {
          return (await caches.match(request)) || (await caches.match('/dashboard/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
