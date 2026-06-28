'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ds/Button';
import { IconButton } from '@/components/ds/IconButton';
import { NAV_LINKS } from '@/lib/nav';
import { cn } from '@/lib/cn';
import { isAdminEmail } from '@/lib/admin';
import { useMember } from './useMember';
import { TalkToUs } from './TalkToUs';
import styles from './Navbar.module.css';

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { member } = useMember();
  const admin = isAdminEmail(member?.auth?.email);
  const accountHref = member ? (admin ? '/admin' : '/dashboard') : '/login';
  const accountLabel = member ? (admin ? 'Admin' : 'Dashboard') : 'Member login';

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.logo} aria-label="The Quarter — home">
          <Image
            src="/brand/logo-wordmark-black.png"
            alt="The Quarter"
            width={132}
            height={53}
            priority
            className={styles.logoImg}
          />
        </Link>

        <nav className={styles.links} aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className={cn(styles.link, isActive(l.href) && styles.linkActive)}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href={accountHref} className={styles.signIn}>
            {accountLabel}
          </Link>
          <span className={styles.cta}>
            <TalkToUs variant="ghost" />
          </span>
          <span className={styles.cta}>
            <Button size="sm" variant="primary" href="/day-pass" iconAfter="arrow-right">
              Book a Day Pass
            </Button>
          </span>
          <span className={styles.menuBtn}>
            <IconButton
              icon={open ? 'x' : 'menu'}
              label={open ? 'Close menu' : 'Open menu'}
              variant="soft"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
            />
          </span>
        </div>
      </div>

      {open ? (
        <div id="mobile-menu" className={styles.mobile}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className={cn(styles.mobileLink, isActive(l.href) && styles.mobileLinkActive)}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className={styles.mobileActions}>
            <TalkToUs variant="ghost" />
            <Button variant="secondary" href={accountHref} fullWidth onClick={() => setOpen(false)}>
              {accountLabel}
            </Button>
            <Button variant="primary" href="/day-pass" iconAfter="arrow-right" fullWidth onClick={() => setOpen(false)}>
              Book a Day Pass
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
