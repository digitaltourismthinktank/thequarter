'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import { busyness } from '@/lib/busyness';
import { useMember } from './useMember';
import { TalkToUs } from './TalkToUs';
import { CheckInCard } from './CheckInCard';
import { MyBookingsCard } from './MyBookingsCard';
import { EventsCard } from './EventsCard';
import {
  getMemberstack,
  memberName,
  memberDaysRemaining,
  memberRenewalDate,
  memberDoorCode,
} from '@/lib/memberstack';
import { PLANS, PLAN_DAY_ALLOWANCE } from '@/lib/plans';
import { STRIPE_BILLING_PORTAL_URL } from '@/lib/commerce';
import styles from './DashboardClient.module.css';

/* PHASE-2 member dashboard. Client-gated, rendered inside <MemberShell> (which
   provides the constant member nav). Reads the plan name straight from
   Memberstack so it shows correctly without a local pln_ map. */
export function DashboardClient() {
  const { loading, member } = useMember();
  const [planName, setPlanName] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState<unknown>(null);
  // Computed on the client only (avoids an SSR/client time mismatch).
  const [today, setToday] = useState<ReturnType<typeof busyness> | null>(null);

  useEffect(() => {
    setToday(busyness(new Date()));
  }, []);

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

  // Debug only (?debug=1): list all Memberstack plans to capture their pln_ ids.
  useEffect(() => {
    const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
    if (!isDebug) return;
    let active = true;
    (async () => {
      const ms = await getMemberstack();
      try {
        const res = await ms?.getPlans?.();
        if (active && res) setAllPlans(res.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
  const isPaused = planName ? planName.toLowerCase().includes('paus') : false;
  const planLabel = isPaused ? 'Plan paused' : (planName ?? (hasPlan ? 'Active plan' : 'No active plan'));
  const planMeta = isPaused
    ? 'Your membership is paused — your days are held. Resume any time.'
    : matched
      ? `${matched.price} · ${matched.period}`
      : hasPlan
        ? 'Active membership'
        : 'Choose a plan to unlock the space.';
  const email = member.auth?.email ?? 'your account';
  const display = memberName(member);
  const first = display ? display.split(' ')[0] : null;
  const isUnlimited = matched?.id === 'citizen' || (planName?.toLowerCase().includes('citizen') ?? false);
  const days = memberDaysRemaining(member);
  const renewal = memberRenewalDate(member);
  const doorCode = memberDoorCode(member);
  // How many of the remaining days are rolled over from last month (days above
  // this plan's monthly allowance). Mirrors the webhook's rollover rule.
  const planAllowance = matched ? PLAN_DAY_ALLOWANCE[matched.id] : undefined;
  const daysNum = days !== null ? parseInt(days, 10) : NaN;
  const rolledOver =
    planAllowance != null && Number.isFinite(daysNum) && daysNum > planAllowance ? daysNum - planAllowance : 0;
  const debug =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  // Today's atmosphere band (client-only; null on weekends/until resolved).
  const band = today && !today.closed ? today.band ?? null : null;

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
    <div className={styles.page}>
      {/* Hero */}
      <header className={styles.hero}>
        <div>
          <span className={styles.heroEyebrow}>Your home</span>
          <h1 className={styles.title}>Welcome back{first ? `, ${first}` : ''}</h1>
          <p className={styles.email}>{email}</p>
        </div>
        {doorCode ? (
          <div className={styles.doorPill}>
            <Icon name="door-open" size={16} color="var(--gold-400)" />
            <span className={styles.doorPillLabel}>Door</span>
            <strong className={styles.doorPillValue}>{doorCode}</strong>
          </div>
        ) : null}
      </header>

      {/* Today at The Quarter — atmosphere, never capacity */}
      {band ? (
        <div className={styles.busy}>
          <div>
            <span className={styles.busyEyebrow}>Today at The Quarter</span>
            <div className={styles.busyLine}>
              <strong className={styles.busyBand}>{band.label}</strong>
              <span className={styles.busyDesc}>{band.line}</span>
            </div>
          </div>
          <div className={styles.busyMeter} aria-hidden="true">
            {(['quiet', 'steady', 'busy', 'buzzing'] as const).map((b) => (
              <span key={b} className={cn(styles.busyDot, band.id === b && styles.busyDotOn)} />
            ))}
          </div>
        </div>
      ) : null}

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

        {/* Days remaining (dark feature card) */}
        <div className={cn(styles.card, styles.cardDark)}>
          <span className={styles.cardEyebrow}>Your days</span>
          {isPaused ? (
            <>
              <h2 className={styles.planName}>On hold</h2>
              <p className={styles.planMeta}>
                {days ?? '0'} day{days === '1' ? '' : 's'} held while your plan is paused.
              </p>
            </>
          ) : isUnlimited ? (
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
              {rolledOver > 0 ? (
                <p className={styles.rolled}>
                  Includes {rolledOver} day{rolledOver === 1 ? '' : 's'} rolled over
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h2 className={styles.planName}>—</h2>
              <p className={styles.cardText}>Your day balance will show here once it&rsquo;s set.</p>
            </>
          )}
        </div>

        {/* Check-in — the tall right rail */}
        <CheckInCard className={styles.gVisits} />

        {/* Quick links */}
        <div className={styles.card}>
          <span className={styles.cardEyebrow}>Quick links</span>
          <div className={styles.quick}>
            <a className={styles.quickLink} href="/book">
              Book a room or pod <Icon name="arrow-right" size={16} color="var(--gold-600)" />
            </a>
            <a className={styles.quickLink} href="/perks">
              Member perks <Icon name="arrow-right" size={16} color="var(--gold-600)" />
            </a>
            <a className={styles.quickLink} href="/events">
              What&rsquo;s on this month <Icon name="arrow-right" size={16} color="var(--gold-600)" />
            </a>
          </div>
          <div className={styles.quickTalk}>
            <TalkToUs variant="ghost" />
          </div>
        </div>

        {/* What's on */}
        <EventsCard />

        {/* Upcoming room/pod bookings */}
        <MyBookingsCard />
      </div>

      {debug ? (
        <pre className={styles.debug}>
          {JSON.stringify(
            {
              id: member.id,
              email: member.auth?.email,
              planConnections: member.planConnections,
              customFields: member.customFields,
              allPlans,
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </div>
  );
}
