'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ds/Icon';
import styles from './MemberTabs.module.css';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'monitor' },
  { href: '/book', label: 'Book', icon: 'calendar' },
  { href: '/rewards', label: 'Rewards', icon: 'star' },
  { href: '/perks', label: 'Perks', icon: 'gift' },
  { href: '/plan', label: 'Plan', icon: 'credit-card' },
];

/** The member shell's tab bar — Dashboard · Book · Rewards · Perks · Plan. */
export function MemberTabs() {
  const pathname = usePathname() || '';
  return (
    <nav className={styles.tabs} aria-label="Your account">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={t.icon} size={17} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
