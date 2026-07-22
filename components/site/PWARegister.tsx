'use client';

import { useEffect, useState } from 'react';

/**
 * Registers the service worker (production only) and keeps updates seamless:
 *  - If a code-split chunk fails to load after a deploy (the old build asking for a file the new
 *    deploy removed), reload ONCE to pull the fresh build — instead of an obscure error with no
 *    way forward. Guarded against reload loops.
 *  - When a new version has installed, show a small "updated — reload" banner so the person
 *    refreshes at a good moment rather than being surprised mid-task.
 */
export function PWARegister() {
  const [updateReady, setUpdateReady] = useState(false);

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

  if (!updateReady) return null;

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
        onClick={() => window.location.reload()}
        style={{
          border: 'none',
          borderRadius: '999px',
          padding: '7px 18px',
          background: '#b8933f',
          color: '#fff',
          fontWeight: 700,
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  );
}
