'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

/* The cookie-consent banner (CookieScript) + Crisp chat bubble load site-wide — EXCEPT
   on the wall-display / kiosk routes, where they'd overlay the full-screen design. A
   dedicated kiosk loads one of these routes directly (fresh, standalone), so the scripts
   never inject there. Everywhere else they load exactly as before. */
const DISPLAY_ROUTES = ['/screen', '/kiosk', '/arrive', '/guest'];

export function ThirdPartyScripts() {
  const pathname = usePathname();
  const isDisplay =
    !!pathname && DISPLAY_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isDisplay) return null;

  return (
    <>
      {/* Cookiescript — GDPR consent banner (gates non-essential cookies). */}
      <Script src="https://cdn.cookie-script.com/s/064e38604f7ba35680d8f547f21c404a.js" strategy="afterInteractive" />
      {/* Crisp chat. Renders only on its whitelisted domain(s) in the Crisp dashboard. */}
      <Script id="crisp" strategy="afterInteractive">{`
          window.$crisp=[];window.CRISP_WEBSITE_ID="9a243419-809f-4f2a-9a77-56bdff85cd0d";
          window.$crisp.push(["safe", true]);
          (function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
        `}</Script>
    </>
  );
}
