'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { isAdminEmail } from '@/lib/admin';
import { useMember, memberPlanSlug } from './useMember';
import { getMemberstack, memberName, memberInitials, memberDaysRemaining } from '@/lib/memberstack';
import styles from './MemberShell.module.css';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'monitor' },
  { href: '/book', label: 'Book', icon: 'calendar' },
  { href: '/whats-on', label: 'Events', icon: 'party-popper' },
  { href: '/rewards', label: 'Rewards', icon: 'star' },
  { href: '/perks', label: 'Perks', icon: 'gift' },
  { href: '/plan', label: 'Plan', icon: 'credit-card' },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function logout() {
  const ms = await getMemberstack();
  await ms?.logout();
  window.location.assign('/');
}

/**
 * The constant member-app shell: a single sticky top nav (wordmark + role,
 * centred section pills, member identity + avatar, admin↔member switch, log out)
 * over a centred content column. Used by every member route so navigation is
 * always present and the page never feels like a panel bolted onto the website.
 */
export function MemberShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const pathname = usePathname() || '';
  const { member } = useMember();
  const onAdmin = pathname.startsWith('/admin');
  const admin = isAdminEmail(member?.auth?.email);

  const name = memberName(member) || 'Member';
  const initials = memberInitials(member);
  const slug = memberPlanSlug(member);
  const days = memberDaysRemaining(member);
  const planLabel = slug ? cap(slug) : member?.planConnections?.length ? 'Member' : null;
  const sub = [planLabel, days ? `${days} days` : null].filter(Boolean).join(' · ');

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href={onAdmin ? '/admin' : '/dashboard'} className={styles.brand} aria-label="The Quarter">
            <Image src="/brand/logo-wordmark-black.png" alt="" width={120} height={48} priority className={styles.brandImg} />
            <span className={styles.role}>{onAdmin ? 'Admin' : 'Member'}</span>
          </Link>

          {!onAdmin ? (
            <nav className={styles.tabs} aria-label="Your account">
              {TABS.map((t) => {
                const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={cn(styles.tab, active && styles.tabOn)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={t.icon} size={16} />
                    <span>{t.label}</span>
                  </Link>
                );
              })}
            </nav>
          ) : (
            <span className={styles.tabsSpacer} />
          )}

          <div className={styles.right}>
            {onAdmin ? (
              <Link href="/dashboard" className={styles.switch}>
                <Icon name="user" size={15} />
                <span>Member view</span>
              </Link>
            ) : admin ? (
              <Link href="/admin" className={styles.switch}>
                <Icon name="key" size={16} />
                <span>Admin</span>
              </Link>
            ) : null}

            <span className={styles.identity}>
              <span className={styles.idText}>
                <strong className={styles.idName}>{name}</strong>
                {sub ? <span className={styles.idSub}>{sub}</span> : null}
              </span>
              <span className={styles.avatar} aria-hidden="true">{initials}</span>
            </span>

            <button type="button" className={styles.logout} onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="log-out" size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className={cn(styles.inner, wide && styles.wide)}>{children}</div>
    </div>
  );
}
