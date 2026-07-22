'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* The cookie-consent banner (CookieScript) + Crisp chat bubble load site-wide — EXCEPT
   on the wall-display / kiosk routes, where they'd overlay the full-screen design. A
   dedicated kiosk loads one of these routes directly (fresh, standalone), so the scripts
   never inject there. Everywhere else they load exactly as before. */
const DISPLAY_ROUTES = ['/screen', '/kiosk', '/arrive', '/guest', '/reception', '/signage', '/invite', '/unsubscribe'];

/* The member app AND admin get NO Crisp: the widget isn't loaded here at all, and a launcher that
   persisted across a client-side navigation from the public site is hidden. Chat is opened
   deliberately from a "Talk to us" control instead; admin staff don't need it. The public
   marketing site keeps its launcher. */
const APP_ROUTES = ['/dashboard', '/book', '/rewards', '/perks', '/whats-on', '/plan', '/account', '/admin', '/admin-guide'];

const matches = (pathname: string, routes: string[]) =>
  routes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function ThirdPartyScripts() {
  const pathname = usePathname() || '';
  const isDisplay = matches(pathname, DISPLAY_ROUTES);
  const inApp = matches(pathname, APP_ROUTES);

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
