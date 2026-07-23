'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_ROUTES, matchesRoute } from '@/lib/appRoutes';

/**
 * Registers the service worker (production only) and keeps updates seamless:
 *  - If a code-split chunk fails to load after a deploy (the old build asking for a file the new
 *    deploy removed), reload ONCE to pull the fresh build — instead of an obscure error with no
 *    way forward. Guarded against reload loops. Runs everywhere (self-healing a left-open wall
 *    screen or a public page is silent and desirable).
 *  - When a new version has installed, show a small "updated — reload" banner — but ONLY inside
 *    the member app + admin (APP_ROUTES). It used to appear on public marketing pages and the
 *    always-on wall/kiosk screens too, where a "reload" prompt is noise, not help.
 */
/**
 * Take the update NOW, in one press.
 *
 * The banner's button used to be a plain window.location.reload(), which often needed pressing
 * four or five times: a reload is served by whichever worker is still in control, so if the new
 * one hadn't finished activating you got the very page you were trying to replace, the banner came
 * straight back, and the only thing that eventually fixed it was luck. So do the three things that
 * actually make the next load fresh — hand over to the waiting worker, drop the cached HTML, and
 * only then reload — and don't let a failure in any of them stop the reload.
 */
async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* nothing here is required for the reload to be worth doing */
  }
  window.location.reload();
}

export function PWARegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const pathname = usePathname() || '';
  const inApp = matchesRoute(pathname, APP_ROUTES);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return; // dev has HMR; none of this applies

    // --- Auto-recover from a stale-chunk failure after a deploy ---------------------------------
    const isChunkError = (m: string) =>
      /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|error loading dynamically|Importing a module script failed|Failed to fetch dynamically/i.test(
        m || '',
      );
    const recover = (m: string) => {
      if (!isChunkError(m)) return;
      let last = 0;
      try {
        last = Number(sessionStorage.getItem('q-chunk-reload') || '0');
      } catch {
        /* private mode */
      }
      // Reloaded very recently already → a fresh reload would just loop on a broken deploy. Show the
      // manual "reload" banner instead so the person isn't trapped.
      if (Date.now() - last < 20000) {
        setUpdateReady(true);
        return;
      }
      try {
        sessionStorage.setItem('q-chunk-reload', String(Date.now()));
      } catch {
        /* still reload once */
      }
      window.location.reload();
    };
    const onErr = (e: ErrorEvent) => recover(e?.message || String((e as unknown as { error?: unknown })?.error || ''));
    const onRej = (e: PromiseRejectionEvent) => recover(String((e?.reason as { message?: string })?.message || e?.reason || ''));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);

    // --- Service worker registration + update detection ----------------------------------------
    let cleanupVis = () => {};
    if ('serviceWorker' in navigator) {
      const register = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          const flag = (w: ServiceWorker | null) => {
            if (w && w.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
          };
          if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (nw) nw.addEventListener('statechange', () => flag(nw));
          });
          // Check for a new deploy when the tab/app is brought back to the front (handy for a PWA or
          // a lobby screen left open for days).
          const onVis = () => {
            if (document.visibilityState === 'visible') reg.update().catch(() => {});
          };
          document.addEventListener('visibilitychange', onVis);
          cleanupVis = () => document.removeEventListener('visibilitychange', onVis);
        } catch {
          /* registration failed — nothing to do */
        }
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
      cleanupVis();
    };
  }, []);

  // Only surface the banner inside the app/admin — never on public pages or wall screens.
  if (!updateReady || !inApp) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px',
        background: '#211c15',
        color: '#faf7f0',
        fontSize: '14px',
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(30, 26, 21, 0.28)',
      }}
    >
      <span>The Quarter has been updated.</span>
      <button
        type="button"
        disabled={applying}
        onClick={() => {
          setApplying(true);
          applyUpdate();
        }}
        style={{
          border: 'none',
          borderRadius: '999px',
          padding: '7px 18px',
          background: '#b8933f',
          color: '#fff',
          fontWeight: 700,
          fontSize: '14px',
          cursor: applying ? 'default' : 'pointer',
          opacity: applying ? 0.7 : 1,
        }}
      >
        {applying ? 'Updating…' : 'Reload'}
      </button>
    </div>
  );
}
