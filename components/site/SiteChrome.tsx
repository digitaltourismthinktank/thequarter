'use client';

import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useMember } from './useMember';

/* The member app (dashboard, book, rewards, plan, admin) has its own constant top
   nav via <MemberShell>. On those routes we suppress the public marketing chrome
   (announcement bar + navbar + footer) so members get a calm, single-nav product
   rather than the marketing site with a panel bolted on.

   /perks is dual-mode: a crawlable marketing page when logged out, the member
   browse when signed in — so there we hide the marketing chrome only for members.

   The wall displays (/screen, /kiosk, /guest, /arrive) are full-bleed kiosk designs —
   the marketing announcement bar, navbar and footer must never render on them, or the
   layout collapses on a big TV (the footer ends up floating beside the display). */
const ALWAYS_APP = ['/dashboard', '/book', '/plan', '/admin', '/arrive', '/whats-on', '/screen', '/kiosk', '/guest', '/reception', '/signage', '/invite', '/unsubscribe'];
const MEMBER_WHEN_AUTHED = ['/perks', '/rewards'];

function matches(prefixes: string[], pathname: string | null): boolean {
  if (!pathname) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function useHideChrome(): boolean {
  const pathname = usePathname();
  const { member } = useMember();
  if (matches(ALWAYS_APP, pathname)) return true;
  if (matches(MEMBER_WHEN_AUTHED, pathname)) return !!member;
  return false;
}

export function SiteHeader() {
  const hide = useHideChrome();
  if (hide) return null;
  return (
    <>
      <AnnouncementBar
        message="New here? Why not book a Day Pass"
        href="/day-pass"
        linkLabel="Book a Day Pass"
      />
      <Navbar />
    </>
  );
}

export function SiteFooter() {
  const hide = useHideChrome();
  if (hide) return null;
  return <Footer />;
}
