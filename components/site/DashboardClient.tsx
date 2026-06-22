'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { useMember, memberPlanSlug } from './useMember';
import { getMemberstack } from '@/lib/memberstack';
import { getPlan, type PlanId } from '@/lib/plans';
import { STRIPE_BILLING_PORTAL_URL } from '@/lib/commerce';
import styles from './DashboardClient.module.css';

/* PHASE-2 member dashboard. Client-gated: redirects to /login if not signed in.
   Shows the member's plan + account actions. "Manage plan" uses the Stripe
   billing portal (one-click Netlify Function swaps in once STRIPE_SECRET_KEY is
   set). Booking & day-balance land in a later pass. */
export function DashboardClient() {
  const { loading, member } = useMember();

  useEffect(() => {
    if (!loading && !member) {
      const t = setTimeout(() => window.location.assign('/login'), 1000);
      return () => clearTimeout(t);
    }
  }, [loading, member]);

  if (loading) return <p className={styles.state}>Loading your dashboard…</p>;
  if (!member) return <p className={styles.state}>Please sign in — taking you to the login page…</p>;

  const slug = memberPlanSlug(member);
  const plan = slug ? getPlan(slug as PlanId) : undefined;
  const email = member.auth?.email ?? 'your account';

  async function handleLogout() {
    const ms = await getMemberstack();
    await ms?.logout();
    window.location.assign('/');
  }

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.email}>{email}</p>
        </div>
        <Button variant="secondary" size="sm" icon="log-out" onClick={handleLogout}>
          Log out
        </Button>
      </div>

      <div className={styles.grid}>
        {/* Plan */}
        <div className={styles.card}>
          <span className={styles.cardEyebrow}>Your plan</span>
          <h2 className={styles.planName}>{plan ? plan.name : 'No active plan'}</h2>
          <p className={styles.planMeta}>
            {plan ? `${plan.price} · ${plan.period}` : 'Choose a plan to unlock the space.'}
          </p>
          <p className={styles.cardText}>
            {plan
              ? 'Manage your subscription, switch plans or update your card in the billing portal.'
              : 'Pick the plan that fits your week and you’ll be all set.'}
          </p>
          <div className={styles.actions}>
            {plan ? (
              <Button variant="primary" href={STRIPE_BILLING_PORTAL_URL} iconAfter="arrow-right">
                Manage plan &amp; billing
              </Button>
            ) : (
              <Button variant="primary" href="/plans" iconAfter="arrow-right">
                See plans
              </Button>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className={styles.card}>
          <span className={styles.cardEyebrow}>Quick links</span>
          <div className={styles.quick} style={{ marginTop: 12 }}>
            <a className={styles.quickLink} href="/meeting-rooms">
              Book a meeting room <Icon name="arrow-right" size={16} color="var(--gold-600)" />
            </a>
            <a className={styles.quickLink} href="/perks">
              Member perks <Icon name="arrow-right" size={16} color="var(--gold-600)" />
            </a>
            <a className={styles.quickLink} href="/events">
              What&rsquo;s on <Icon name="arrow-right" size={16} color="var(--gold-600)" />
            </a>
          </div>
        </div>

        {/* Coming soon */}
        <div className={styles.card}>
          <span className={styles.cardEyebrow}>Your days</span>
          <h2 className={styles.planName}>Coming soon</h2>
          <p className={styles.cardText}>
            Day-balance tracking, live room booking and one-tap perk redemption are on the way for members.
          </p>
        </div>
      </div>
    </div>
  );
}
