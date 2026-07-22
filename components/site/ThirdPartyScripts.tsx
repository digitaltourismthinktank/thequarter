'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { APP_ROUTES, DISPLAY_ROUTES, matchesRoute } from '@/lib/appRoutes';

/* The cookie-consent banner (CookieScript) + Crisp chat bubble load site-wide — EXCEPT on the
   wall-display / kiosk routes (DISPLAY_ROUTES), where they'd overlay the full-screen design, and
   the member app + admin (APP_ROUTES), which get NO Crisp at all. A dedicated kiosk loads one of
   those routes directly (fresh, standalone), so the scripts never inject there. Route groups live
   in lib/appRoutes so they can't drift from the PWA update banner's copy of the same lists. */
export function ThirdPartyScripts() {
  const pathname = usePathname() || '';
  const isDisplay = matchesRoute(pathname, DISPLAY_ROUTES);
  const inApp = matchesRoute(pathname, APP_ROUTES);

  /* Crisp visibility is owned here rather than in the member shell. This component creates
     the $crisp queue itself, so there's no load-order race, and it lives in the root layout
     where it survives every navigation. Two things make a single hide-on-mount unreliable:
     Crisp treats hide/show as per-page runtime state, and its client can reassert the
     launcher once the session finishes restoring — after our push has already run. So the
     desired state is re-applied on 'session:loaded' and whenever a conversation closes,
     which is what keeps "Talk to us" working without leaving the bubble behind. */
  useEffect(() => {
    if (isDisplay) return;
    const w = window as unknown as { $crisp?: unknown[] };
    // $crisp is a plain array until client.crisp.chat/l.js swaps in the real client; pushes
    // made before then are queued and replayed, so seed it rather than bailing out.
    if (!w.$crisp) w.$crisp = [];
    const apply = () => w.$crisp?.push(['do', inApp ? 'chat:hide' : 'chat:show']);
    apply();
    w.$crisp.push(['on', 'session:loaded', apply]);
    w.$crisp.push(['on', 'chat:closed', apply]);
  }, [inApp, isDisplay]);

  if (isDisplay) return null;

  return (
    <>
      {/* Cookiescript — GDPR consent banner (gates non-essential cookies). */}
      <Script src="https://cdn.cookie-script.com/s/064e38604f7ba35680d8f547f21c404a.js" strategy="afterInteractive" />
      {/* Crisp chat — public marketing site only. The member app + admin never load it (they don't
          need it, and it floats over the mobile tab bar). Renders only on its whitelisted domain(s)
          in the Crisp dashboard. */}
      {!inApp ? (
        <Script id="crisp" strategy="afterInteractive">{`
          window.$crisp=window.$crisp||[];window.CRISP_WEBSITE_ID="9a243419-809f-4f2a-9a77-56bdff85cd0d";
          window.$crisp.push(["safe", true]);
          (function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
        `}</Script>
      ) : null}
    </>
  );
}
