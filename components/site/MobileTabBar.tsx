'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import styles from './MobileTabBar.module.css';

/**
 * The member app's phone navigation: five fixed destinations along the bottom with
 * check-in raised into the middle.
 *
 * Replaces the horizontally-scrolling strip of six pills at the top, which could not fit
 * on a phone — Rewards, Perks and Plan were scrolled off the right edge behind a hidden
 * scrollbar, so a third of the app was undiscoverable. Perks is reached from the segmented
 * control at the top of Rewards (RewardsTabs) and Plan from the header avatar, which frees
 * the slots — so this bar lights the Rewards tab for /perks as well as /rewards.
 *
 * Phones only; the desktop keeps its top nav (see MemberShell).
 */
const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/book', label: 'Book', icon: 'calendar' },
  { href: '/rewards', label: 'Rewards', icon: 'star' },
  { href: '/whats-on', label: 'Events', icon: 'party-popper' },
];

export function MobileTabBar({ onCheckIn }: { onCheckIn?: () => void }) {
  const pathname = usePathname() || '';
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // Perks is a segment of Rewards now, so a member sitting on /perks should still see
  // Rewards lit rather than nothing at all.
  const rewardsOn = isOn('/rewards') || isOn('/perks');

  const tab = (t: (typeof TABS)[number]) => {
    const on = t.href === '/rewards' ? rewardsOn : isOn(t.href);
    return (
      <Link key={t.href} href={t.href} className={cn(styles.tab, on && styles.tabOn)} aria-current={on ? 'page' : undefined}>
        <span className={styles.ic}>
          <Icon name={t.icon} size={21} />
        </span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className={styles.bar} aria-label="Sections">
      {tab(TABS[0])}
      {tab(TABS[1])}

      {/* The daily action, reachable from every screen. Opens the check-in sheet rather
          than navigating, so nobody loses their place. */}
      {/* The whole slot is the button: the raised circle is absolutely positioned, so when
          only it was clickable the "Check in" label underneath was a dead tap zone. */}
      <button type="button" className={styles.checkSlot} onClick={onCheckIn}>
        <span className={styles.check} aria-hidden="true">
          <Icon name="check" size={26} color="var(--ink-900)" strokeWidth={2.6} />
        </span>
        <span className={styles.slot} aria-hidden="true" />
        Check in
      </button>

      {tab(TABS[2])}
      {tab(TABS[3])}
    </nav>
  );
}
