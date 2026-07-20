'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './RewardsTabs.module.css';

/**
 * Switches between the two halves of the rewards world: what you've earned (/rewards) and
 * what's on offer nearby (/perks). It exists because on a phone there was no way to reach
 * /perks at all — the desktop nav carries the link and is hidden below 860px, while the tab
 * bar highlights Rewards for both routes. So the highlight pointed at somewhere unreachable.
 *
 * next/link rather than <a>: both clients render the public marketing page until Memberstack
 * resolves, so a hard navigation would flash the shopfront at a signed-in member.
 */
export function RewardsTabs() {
  const pathname = usePathname() || '';
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className={styles.tabs} aria-label="Rewards sections">
      <Link href="/rewards" className={`${styles.tab} ${on('/rewards') ? styles.tabOn : ''}`} aria-current={on('/rewards') ? 'page' : undefined}>
        Rewards
      </Link>
      <Link href="/perks" className={`${styles.tab} ${on('/perks') ? styles.tabOn : ''}`} aria-current={on('/perks') ? 'page' : undefined}>
        Perks
      </Link>
    </nav>
  );
}
