import Image from 'next/image';
import { Input } from '@/components/ds/Input';
import { Button } from '@/components/ds/Button';
import { Badge } from '@/components/ds/Badge';
import { Icon } from '@/components/ds/Icon';
import { PHOTOS } from '@/lib/media';
import styles from './AuthScreen.module.css';

/* The Quarter — auth entry points (login / sign up). PHASE-1 STUB: the fields
   are a preview only; the primary action routes to the placeholder /dashboard.
   Phase 2 swaps this for real authentication. */

export function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const isLogin = mode === 'login';
  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <Badge tone="gold">{isLogin ? 'Welcome back' : 'Join The Quarter'}</Badge>
          <h1 className={styles.title}>{isLogin ? 'Member login' : 'Create your account'}</h1>
          <p className={styles.subtitle}>
            {isLogin
              ? 'Sign in to see your plan, book a room and redeem your perks.'
              : 'Set up your member account to manage your plan, bookings and perks.'}
          </p>

          <div className={styles.fields}>
            {!isLogin ? <Input label="Full name" placeholder="Maya Holloway" autoComplete="name" /> : null}
            <Input label="Email" type="email" icon="user" placeholder="you@company.com" autoComplete="email" />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {isLogin ? (
              <div className={styles.forgot}>
                <a href="/location#contact">Forgotten password?</a>
              </div>
            ) : null}

            <Button variant="primary" fullWidth href="/dashboard" iconAfter="arrow-right">
              {isLogin ? 'Sign in' : 'Create account'}
            </Button>

            <p className={styles.note}>
              <Icon name="sparkles" size={15} color="var(--gold-600)" />
              Member accounts arrive with the app in phase 2 — this is a preview entry point.
            </p>

            <div className={styles.divider}>
              <span /> or <span />
            </div>

            <p className={styles.alt}>
              {isLogin ? (
                <>
                  New here? <a href="/day-pass">Book a Day Pass</a> to get started.
                </>
              ) : (
                <>
                  Already a member? <a href="/login">Sign in</a>.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.media}>
        <Image src={PHOTOS.mainSpaceWide.src} alt={PHOTOS.mainSpaceWide.alt} fill sizes="(max-width: 860px) 0px, 50vw" className={styles.mediaImg} />
      </div>
    </div>
  );
}
