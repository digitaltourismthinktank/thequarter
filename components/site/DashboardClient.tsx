'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { StatTile } from '@/components/ds/StatTile';
import { QuarterCard } from '@/components/ds/QuarterCard';
import { cn } from '@/lib/cn';
import { busyness } from '@/lib/busyness';
import { useMember, memberPlanSlug } from './useMember';
import { TalkToUs } from './TalkToUs';
import { CheckInCard } from './CheckInCard';
import { MyBookingsCard } from './MyBookingsCard';
import { EventsCard } from './EventsCard';
import { CarnetMini } from './CarnetMini';
import { InstallPrompt } from './InstallPrompt';
import { GeoCheckIn } from './GeoCheckIn';
import { NotificationToggle } from './NotificationToggle';
import { getMemberstack, memberName, memberDaysRemaining, memberRenewalDate, memberDoorCode, memberHasPaymentIssue } from '@/lib/memberstack';
import { PLANS, PLAN_DAY_ALLOWANCE } from '@/lib/plans';
import { STRIPE_BILLING_PORTAL_URL } from '@/lib/commerce';
import { getRewards } from '@/lib/booking';
import { levelForPoints, type LevelSlug } from '@/lib/rewards';
import styles from './DashboardClient.module.css';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* PHASE-2 member dashboard, rebuilt on the design system: StatTile metrics +
   the QuarterCard membership hero, inside <MemberShell>'s constant nav. */
export function DashboardClient() {
  const { loading, member } = useMember();
  const [planName, setPlanName] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState<unknown>(null);
  const [today, setToday] = useState<ReturnType<typeof busyness> | null>(null);
  // Seed the loyalty card from the last-known values (instant render, works offline).
  const [points, setPoints] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const c = JSON.parse(localStorage.getItem('q-card') || 'null');
      return c && typeof c.points === 'number' ? c.points : null;
    } catch {
      return null;
    }
  });
  const [level, setLevel] = useState<LevelSlug>(() => {
    if (typeof window === 'undefined') return 'newbie';
    try {
      const c = JSON.parse(localStorage.getItem('q-card') || 'null');
      return c && c.level ? c.level : 'newbie';
    } catch {
      return 'newbie';
    }
  });

  useEffect(() => {
    setToday(busyness(new Date()));
  }, []);

  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

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

  // Points + earned level for the loyalty card.
  useEffect(() => {
    if (!member) return;
    let active = true;
    (async () => {
      const r = await getRewards();
      if (active && r.ok) {
        const pts = r.data.points;
        const lvl = levelForPoints(r.data.lifetimePoints ?? r.data.points).slug;
        setPoints(pts);
        setLevel(lvl);
        try {
          localStorage.setItem('q-card', JSON.stringify({ points: pts, level: lvl }));
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [member]);

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
  const slug = memberPlanSlug(member);
  const matched = planName
    ? PLANS.find((p) => planName.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(planName.toLowerCase()))
    : slug
      ? PLANS.find((p) => p.id === slug)
      : undefined;
  const isPaused = planName ? planName.toLowerCase().includes('paus') : false;
  const planLabel = isPaused ? 'Paused' : (matched?.name ?? planName ?? (hasPlan ? 'Active plan' : 'No plan'));
  const planMeta = isPaused
    ? 'Days held while paused'
    : matched
      ? `${matched.price} · ${matched.period}`
      : hasPlan
        ? 'Active membership'
        : 'Choose a plan to start';
  const email = member.auth?.email ?? 'your account';
  const display = memberName(member);
  const first = display ? display.split(' ')[0] : null;
  const isUnlimited = matched?.id === 'citizen' || (planName?.toLowerCase().includes('citizen') ?? false);
  const days = memberDaysRemaining(member);
  const renewal = memberRenewalDate(member);
  const doorCode = memberDoorCode(member);
  const planAllowance = matched ? PLAN_DAY_ALLOWANCE[matched.id] : undefined;
  const daysNum = days !== null ? parseInt(days, 10) : NaN;
  const daysProgress =
    planAllowance != null && planAllowance > 0 && Number.isFinite(daysNum)
      ? Math.max(0, Math.min(100, Math.round((daysNum / planAllowance) * 100)))
      : undefined;
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const band = today && !today.closed ? today.band ?? null : null;

  // "Your days" StatTile content (paused / unlimited / metered / unset).
  let daysValue: string = '—';
  let daysUnit: string | undefined;
  let daysHint: string | undefined;
  let daysProg: number | undefined;
  if (isPaused) {
    daysValue = days ?? '0';
    daysHint = 'Held while paused';
  } else if (isUnlimited) {
    daysValue = 'Unlimited';
    daysHint = 'Citizen access';
  } else if (days !== null) {
    daysValue = days;
    daysUnit = 'days left';
    daysHint = renewal ? `Resets ${renewal}` : undefined;
    daysProg = daysProgress;
  } else {
    daysHint = 'Set up soon';
  }

  const cardId = (member.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0001';

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

  const payIssue = memberHasPaymentIssue(member);

  return (
    <div className={styles.page}>
      {payIssue ? (
        <div className={styles.payAlert} role="alert">
          <span>
            <Icon name="credit-card" size={16} color="var(--ink-900)" /> There&rsquo;s a problem with your last payment — please update your card. Your
            membership may be suspended until it&rsquo;s sorted.
          </span>
          <Button variant="primary" size="sm" onClick={handleManageBilling} disabled={billingBusy}>
            {billingBusy ? 'Opening…' : 'Update card'}
          </Button>
        </div>
      ) : null}

      <header className={styles.hero}>
        <span className={styles.heroEyebrow}>Quarter Dashboard</span>
        <h1 className={styles.title}>Welcome back{first ? `, ${first}` : ''}</h1>
        <p className={styles.email}>{email}</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {hasPlan ? (
            <div className={styles.statRow}>
              <StatTile label="Your days" tone="ink" icon="calendar" value={daysValue} unit={daysUnit} hint={daysHint} progress={daysProg} valueSize="var(--text-2xl)" />
              <StatTile label="Your plan" tone="gold" icon="user" value={planLabel} hint={planMeta} valueSize="var(--text-2xl)" />
              <StatTile
                label="Door code"
                icon="door-open"
                value={doorCode ?? '—'}
                hint={doorCode ? 'Keep it to yourself' : 'Ask the team'}
                valueSize="var(--text-2xl)"
              />
            </div>
          ) : (
            <div className={styles.payg}>
              <span className={styles.paygEyebrow}>Pay-as-you-go</span>
              <h2 className={styles.paygTitle}>You&rsquo;re on pay-as-you-go</h2>
              <p className={styles.paygBody}>
                You don&rsquo;t have a membership yet, so there are no monthly days and no door code to show. Any Day Pass you
                book appears in your bookings just below.
              </p>
              <div className={styles.paygActions}>
                <Button variant="primary" size="sm" href="/plans" iconAfter="arrow-right">
                  See plans
                </Button>
                <Button variant="secondary" size="sm" href="/day-pass">
                  Book a Day Pass
                </Button>
              </div>
            </div>
          )}

          {band ? (
            <div className={styles.busy}>
              <div>
                <span className={styles.busyEyebrow}>How busy we expect it to be</span>
                <div className={styles.busyLine}>
                  <strong className={styles.busyBand}>{band.label}</strong>
                  <span className={styles.busyDesc}>{band.line} Our best guess from past weeks.</span>
                </div>
              </div>
              <div className={styles.busyMeter} aria-hidden="true">
                {(['quiet', 'steady', 'busy', 'buzzing'] as const).map((b) => (
                  <span key={b} className={cn(styles.busyDot, band.id === b && styles.busyDotOn)} />
                ))}
              </div>
            </div>
          ) : null}

          <GeoCheckIn />
          <CheckInCard />
          <MyBookingsCard />
        </div>

        <aside className={styles.rail}>
          <QuarterCard
            memberName={display ?? email}
            plan={isPaused ? 'Paused' : slug ? cap(slug) : hasPlan ? 'Member' : 'Guest'}
            cardId={cardId}
            level={level}
            points={points ?? undefined}
            logoSrc="/brand/logo-wordmark-black.png"
            style={{ maxWidth: '100%' }}
          />
          <Button variant="primary" fullWidth href="/plan" iconAfter="arrow-right">
            {hasPlan ? 'Manage plan & billing' : 'Choose a plan'}
          </Button>
          <InstallPrompt />
          <NotificationToggle />
          {billingError ? (
            <p className={styles.billingError}>
              Couldn&rsquo;t open one-click billing ({billingError}).{' '}
              <a href={STRIPE_BILLING_PORTAL_URL}>Open the standard portal</a>.
            </p>
          ) : null}

          <CarnetMini />

          <EventsCard />

          <div className={styles.linksCard}>
            <span className={styles.cardEyebrow}>Quick links</span>
            <div className={styles.quick}>
              <a className={styles.quickLink} href="/book">
                Book a room or pod <Icon name="arrow-right" size={16} color="var(--gold-600)" />
              </a>
              <a className={styles.quickLink} href="/meeting-rooms">
                Book a meeting room <Icon name="arrow-right" size={16} color="var(--gold-600)" />
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
        </aside>
      </div>

      {debug ? (
        <pre className={styles.debug}>
          {JSON.stringify({ id: member.id, email: member.auth?.email, planConnections: member.planConnections, customFields: member.customFields, allPlans }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
