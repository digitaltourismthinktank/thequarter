'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { isAdminEmail } from '@/lib/admin';
import { useMember, memberPlanSlug } from './useMember';
import { getMemberstack, memberName, memberInitials, memberDaysRemaining } from '@/lib/memberstack';
import { MobileTabBar } from './MobileTabBar';
import { QuarterCharacter } from './QuarterCharacter';
import { CheckInSheet } from './CheckInSheet';
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
  const [checkInOpen, setCheckInOpen] = useState(false);
  const onAdmin = pathname.startsWith('/admin');

  // Crisp's launcher used to be hidden from here, but this shell remounts on every member
  // route change and Crisp can reassert the bubble after its session loads — so ownership
  // now sits in ThirdPartyScripts, which never remounts and creates the $crisp queue itself.
  //
  // Flag the member app on the root element so global CSS can move third-party floating
  // widgets (CookieScript's "Cookie settings" badge) clear of the fixed tab bar.
  useEffect(() => {
    document.documentElement.dataset.memberApp = '1';
    return () => {
      delete document.documentElement.dataset.memberApp;
    };
  }, []);
  const admin = isAdminEmail(member?.auth?.email);

  const name = memberName(member) || 'Member';
  const initials = memberInitials(member);
  const character = typeof member?.metaData?.character === 'string' ? member.metaData.character : null;
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

            <Link href="/account" className={styles.identity} title="Your account">
              <span className={styles.idText}>
                <strong className={styles.idName}>{name}</strong>
                {sub ? <span className={styles.idSub}>{sub}</span> : null}
              </span>
              {/* A chosen Quarter Character stands in for the initials; initials are the
                  fallback for anyone who hasn't picked one. */}
              {character ? (
                <QuarterCharacter id={character} size={38} className={styles.avatarArt} />
              ) : (
                <span className={styles.avatar} aria-hidden="true">{initials}</span>
              )}
            </Link>

            <button type="button" className={styles.logout} onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="log-out" size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className={cn(styles.inner, wide && styles.wide)}>{children}</div>

      {/* Phone navigation. Admin keeps its own dense tab set, so the bar is member-only. */}
      {!onAdmin ? <MobileTabBar onCheckIn={() => setCheckInOpen(true)} /> : null}
      <CheckInSheet open={checkInOpen} onClose={() => setCheckInOpen(false)} />

    </div>
  );
}
