import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import styles from './dashboard.module.css';

export const metadata: Metadata = {
  title: 'Member dashboard',
  description: 'Your Quarter member dashboard.',
  robots: { index: false, follow: false },
};

/* PHASE-2 SEAM. The member dashboard — plan & day balance, room booking and
   perk redemption — is built in phase 2. Login / Sign up route here. */
export default function DashboardPage() {
  return (
    <Section tone="page">
      <div className={styles.wrap}>
        <span className={styles.icon}>
          <Icon name="sparkles" size={28} color="var(--gold-700)" />
        </span>
        <h1 className={styles.title}>Your member dashboard is coming</h1>
        <p className={styles.text}>
          This is where your plan, day balance, room bookings and perk redemption will live — arriving in phase 2.
          Thanks for your patience while we build it.
        </p>
        <div className={styles.actions}>
          <Button variant="primary" href="/" iconAfter="arrow-right">
            Back to home
          </Button>
          <Button variant="secondary" href="/day-pass">
            Book a Day Pass
          </Button>
        </div>
      </div>
    </Section>
  );
}
