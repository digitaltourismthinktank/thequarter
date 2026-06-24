'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { useMember } from './useMember';
import { getMemberstack, memberDaysRemaining, memberRenewalDate } from '@/lib/memberstack';
import { PLANS } from '@/lib/plans';
import { STRIPE_BILLING_PORTAL_URL } from '@/lib/commerce';
import styles from './DashboardClient.module.css';

/* PHASE-2 member dashboard. Client-gated. Reads the member's plan name straight
   from Memberstack (getPlan) so it shows correctly without a local pln_ map.
   "Manage plan" uses the Stripe billing portal (one-click Netlify Function
   swaps in once STRIPE_SECRET_KEY + MEMBERSTACK_SECRET_KEY are set). */
export function DashboardClient() {
  const { loading, member } = useMember();
  const [planName, setPlanName] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Patient redirect: only send to /login once we're sure there's no member.
  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

  // Resolve the plan name from Memberstack itself (no local mapping required).
  useEffect(() => {
    let active = true;
    (async () => {
      const conn = member?.planConnections?.find((p) => p.active !== false) ?? member?.planConnections?.[0];
      if (!conn?.planId) return;
      const ms = await getMemberstack();
      if (!ms) return;
      try {
        const { data } = await ms.getPlan({ planId: conn.planId });
        if (active && data?.name) setPlanName(data.name);
      } catch {
        /* ignore — fall back to a generic label */
      }
    })();
    return () => {
      active = false;
    };
  }, [member]);

  if (loading) return <p className={styles.state}>Loading your dashboard…</p>;
  if (!member) return <p className={styles.state}>Please sign in — taking you to the login page…</p>;

  const hasPlan = (member.planConnections?.length ?? 0) > 0;
  const matched = planName
    ? PLANS.find(
        (p) =>
          planName.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(planName.toLowerCase()),
      )
    : undefined;
  const planLabel = planName ?? (hasPlan ? 'Active plan' : 'No active plan');
  const planMeta = matched
    ? `${matched.price} · ${matched.period}`
    : hasPlan
      ? 'Active membership'
      : 'Choose a plan to unlock the space.';
  const email = member.auth?.email ?? 'your account';
  const isUnlimited = matched?.id === 'citizen' || (planName?.toLowerCase().includes('citizen') ?? false);
  const days = memberDaysRemaining(member);
  const renewal = memberRenewalDate(member);

  async function handleLogout() {
    const ms = await getMemberstack();
    await ms?.logout();
    window.location.assign('/');
  }

  // One-click billing portal via the Netlify Function; falls back to the generic
  // Stripe portal link if the function isn't configured yet or has no match.
  async function handleManageBilling() {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const ms = await getMemberstack();
      let token = ms?.getMemberCookie?.();
      if (!token && typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|;\s*)_ms-mid=([^;]+)/);
        if (m) token = decodeURIComponent(m[1]);
      }
      if (!token) {
        setBillingError('no member token');
        return;
      }
      const res = await fetch('/.netlify/functions/billing-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; detail?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setBillingError(`${res.status} ${data.error ?? ''} ${data.detail ?? ''}`.trim());
    } catch (e) {
      setBillingError(String((e as Error)?.message || e));
    } finally {
      setBillingBusy(false);
    }
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
          <h2 className={styles.planName}>{planLabel}</h2>
          <p className={styles.planMeta}>{planMeta}</p>
          <p className={styles.cardText}>
            {hasPlan
              ? 'Manage your subscription, switch plans or update your card in the billing portal.'
              : 'Pick the plan that fits your week and you’ll be all set.'}
          </p>
          <div className={styles.actions}>
            {hasPlan ? (
              <Button variant="primary" onClick={handleManageBilling} disabled={billingBusy} iconAfter="arrow-right">
                {billingBusy ? 'Opening…' : 'Manage plan & billing'}
              </Button>
            ) : (
              <Button variant="primary" href="/plans" iconAfter="arrow-right">
                See plans
              </Button>
            )}
          </div>
          {billingError ? (
            <p className={styles.billingError}>
              Couldn&rsquo;t open one-click billing ({billingError}).{' '}
              <a href={STRIPE_BILLING_PORTAL_URL}>Open the standard portal</a>.
            </p>
          ) : null}
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

        {/* Days remaining */}
        <div className={styles.card}>
          <span className={styles.cardEyebrow}>Your days</span>
          {isUnlimited ? (
            <>
              <h2 className={styles.planName}>Unlimited</h2>
              <p className={styles.planMeta}>Citizen members have unrestricted access.</p>
            </>
          ) : days !== null ? (
            <>
              <div className={styles.daysBig}>
                {days} <span className={styles.daysUnit}>days left</span>
              </div>
              {renewal ? <p className={styles.planMeta}>Resets on {renewal}</p> : null}
            </>
          ) : (
            <>
              <h2 className={styles.planName}>—</h2>
              <p className={styles.cardText}>Your day balance will show here once it&rsquo;s set.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
