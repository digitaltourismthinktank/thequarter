'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { StatTile } from '@/components/ds/StatTile';
import { DayPassCard } from './DayPassCard';
import { MemberCardSheet } from './MemberCardSheet';
import { QuarterCard } from '@/components/ds/QuarterCard';
import { cn } from '@/lib/cn';
import { busyness } from '@/lib/busyness';
import { useMember, memberPlanSlug } from './useMember';
import { TalkToUs } from './TalkToUs';
import { CheckInCard } from './CheckInCard';
import { MyBookingsCard } from './MyBookingsCard';
import { EventsCard } from './EventsCard';
import { CarnetMini } from './CarnetMini';
import { PostCard, RegisteredAddressCard } from './PostCard';
import { BirthdayCard } from './BirthdayCard';
import { InstallPrompt } from './InstallPrompt';
import { GeoCheckIn } from './GeoCheckIn';
import { NotificationToggle } from './NotificationToggle';
import { getMemberstack, memberName, memberDaysRemaining, memberRenewalDate, memberDoorCode, memberHasPaymentIssue } from '@/lib/memberstack';
import { PLANS, PLAN_DAY_ALLOWANCE } from '@/lib/plans';
import { STRIPE_BILLING_PORTAL_URL } from '@/lib/commerce';
import { getRewards, getCheckinToday, BALANCES_EVENT } from '@/lib/booking';
import { levelForPoints, type LevelSlug } from '@/lib/rewards';
import styles from './DashboardClient.module.css';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* PHASE-2 member dashboard, rebuilt on the design system: StatTile metrics +
   the QuarterCard membership hero, inside <MemberShell>'s constant nav. */
export function DashboardClient() {
  const { loading, member, refresh } = useMember();
  const bdaySet = !!(member?.metaData as { bday?: string } | undefined)?.bday;
  const [cardOpen, setCardOpen] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState<unknown>(null);
  const [today, setToday] = useState<ReturnType<typeof busyness> | null>(null);
  // Plan days + rollover come from the SERVER (fresh after any spend, and readable even when the
  // rollover fields are admin-restricted from the client). Re-fetched on the balances-changed event
  // so checking in / booking updates the day tile instantly, not on reload.
  const [srv, setSrv] = useState<{ balance: string | null; rollover: number; rolloverExpiry: string | null } | null>(null);
  useEffect(() => {
    const load = () =>
      getCheckinToday().then((r) => {
        if (r.ok) setSrv({ balance: r.data.balance ?? null, rollover: r.data.rollover ?? 0, rolloverExpiry: r.data.rolloverExpiry ?? null });
      });
    load();
    const onChange = () => load();
    window.addEventListener(BALANCES_EVENT, onChange);
    return () => window.removeEventListener(BALANCES_EVENT, onChange);
  }, []);
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
  // How many rewards the member can redeem right now — a daily check-in nudge.
  const [rewardsReady, setRewardsReady] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const c = JSON.parse(localStorage.getItem('q-card') || 'null');
      return c && typeof c.rewards === 'number' ? c.rewards : null;
    } catch {
      return null;
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
        const rr = (r.data.catalogue || []).filter((x) => x.avail === 'ok' && (pts ?? 0) >= x.cost).length;
        setPoints(pts);
        setLevel(lvl);
        setRewardsReady(rr);
        try {
          localStorage.setItem('q-card', JSON.stringify({ points: pts, level: lvl, rewards: rr }));
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
  // Hybrid Office is really a registered address + mail service, so their post leads the dashboard;
  // every other plan gets a compact "you've got post" strip in the rail (invisible with no mail).
  const isHybrid = matched?.id === 'hybrid-office' || (planName?.toLowerCase().includes('hybrid') ?? false);
  const days = memberDaysRemaining(member);
  const renewal = memberRenewalDate(member);
  const doorCode = memberDoorCode(member);
  const planAllowance = matched ? PLAN_DAY_ALLOWANCE[matched.id] : undefined;
  // Override-aware denominator: a member on a bespoke allowance carries a numeric
  // customFields['allowance-override'] (mirrors the server's allowanceForMember). When it
  // parses to a valid positive number it wins over the plan default, so the bar reads right.
  const overrideRaw = member.customFields?.['allowance-override'];
  const overrideNum = overrideRaw != null && String(overrideRaw).trim() !== '' ? Number(overrideRaw) : NaN;
  const allowanceDenominator = Number.isFinite(overrideNum) && overrideNum > 0 ? overrideNum : planAllowance;
  const daysNum = days !== null ? parseInt(days, 10) : NaN;
  const daysProgress =
    allowanceDenominator != null && allowanceDenominator > 0 && Number.isFinite(daysNum)
      ? Math.max(0, Math.min(100, Math.round((daysNum / allowanceDenominator) * 100)))
      : undefined;
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const band = today && !today.closed ? today.band ?? null : null;

  // Two-bucket day balance: this cycle's plan days (days-remaining) PLUS the rollover bucket
  // (days-rollover, live only until rollover-expiry). Read straight from the member's custom fields.
  const nowISO = new Date().toISOString().slice(0, 10);
  // Prefer the server's live rollover (already expiry-adjusted, and readable even when the fields
  // are admin-restricted); fall back to the client custom field.
  const clientRollExp = String(member.customFields?.['rollover-expiry'] || '').trim();
  const clientRoll = clientRollExp && clientRollExp < nowISO ? 0 : Math.max(0, Number(member.customFields?.['days-rollover']) || 0);
  const rollNum = srv ? Math.max(0, srv.rollover) : clientRoll;
  const rollExp = (srv?.rolloverExpiry || clientRollExp || '').trim();
  // Prefer the server's plan-day balance (fresh after a spend) over the possibly-stale client field.
  const serverDays = srv && srv.balance != null && String(srv.balance).toLowerCase() !== 'unlimited' ? parseInt(String(srv.balance), 10) : NaN;
  const planNum = Number.isFinite(serverDays) ? serverDays : Number.isFinite(daysNum) ? daysNum : 0;
  const totalDays = planNum + rollNum;
  const rollExpLabel = rollExp ? new Date(`${rollExp}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  // "Your days" StatTile content (paused / unlimited / metered / unset). Shows the TOTAL spendable,
  // with the plan-vs-rolled-over split in the hint.
  let daysValue: string = '—';
  let daysUnit: string | undefined;
  let daysHint: string | undefined;
  let daysProg: number | undefined;
  if (isPaused) {
    daysValue = String(rollNum || planNum || 0);
    daysHint = rollNum > 0 ? `Rolled over — yours to use${rollExpLabel ? ` · expire ${rollExpLabel}` : ''}` : 'Held while paused';
  } else if (isUnlimited) {
    daysValue = 'Unlimited';
    daysHint = 'Citizen access';
  } else if (days !== null) {
    daysValue = String(totalDays);
    daysUnit = 'days left';
    daysHint = rollNum > 0 ? `${planNum} in plan + ${rollNum} rolled over${rollExpLabel ? ` (expire ${rollExpLabel})` : ''}` : renewal ? `Resets ${renewal}` : undefined;
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
          {/* Hybrid Office leads on their post, then the registered address they pay for. */}
          {isHybrid ? <PostCard variant="hero" /> : null}
          {isHybrid ? (
            <RegisteredAddressCard
              company={(member.metaData?.company as string) || null}
              daysLeft={isUnlimited ? null : planNum}
              renewal={renewal}
            />
          ) : null}
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
            <DayPassCard />
          )}

          {/* Non-Hybrid members see their post here, right under the tiles — a proper card (not the
              easy-to-miss rail strip), but only when something's actually waiting. */}
          {!isHybrid ? <PostCard variant="card" /> : null}

          {band ? (
            <div className={styles.busy}>
              <div>
                {/* Name the day explicitly — someone browsing next week's dates read this as
                    a forecast for the whole week rather than for today. */}
                <span className={styles.busyEyebrow}>How busy we expect today to be</span>
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

          <div className={styles.ordCheckin}>
            <CheckInCard />
          </div>
          <div className={styles.ordBookings}>
            <MyBookingsCard />
          </div>
        </div>

        <aside className={styles.rail}>
          {/* Phones only: a tight one-card summary that stands in for the big membership card AND
              the days/plan/door tiles, so the top of the screen isn't three stacked blocks. */}
          <button type="button" className={styles.mSum} onClick={() => setCardOpen(true)} aria-label="Show your membership card">
            <div className={styles.mSumTop}>
              <div className={styles.mSumId}>
                <strong className={styles.mSumName}>{display ?? email}</strong>
                <span className={styles.mSumLevel}>
                  {cap(level)}
                  {typeof points === 'number' ? ` · ${points.toLocaleString('en-GB')} pts` : ''}
                  {rewardsReady ? ` · ${rewardsReady} to redeem` : ''}
                </span>
              </div>
              <span className={styles.mSumPlan}>{isPaused ? 'Paused' : slug ? cap(slug) : hasPlan ? 'Member' : 'Guest'}</span>
            </div>
            {hasPlan ? (
              <div className={styles.mSumStats}>
                <span>{isUnlimited ? <b>Unlimited</b> : <><b>{daysValue}</b> {isPaused ? 'held' : 'days left'}</>}</span>
                <span>Door <b>{doorCode ?? '—'}</b></span>
              </div>
            ) : null}
            <span className={styles.mSumHint} aria-hidden="true">Tap for your card</span>
          </button>
          <div className={styles.ordCard}>
            <QuarterCard
              memberName={display ?? email}
              plan={isPaused ? 'Paused' : slug ? cap(slug) : hasPlan ? 'Member' : 'Guest'}
              cardId={cardId}
              level={level}
              points={points ?? undefined}
              rewards={rewardsReady ?? undefined}
              logoSrc="/brand/logo-wordmark-black.png"
              style={{ maxWidth: '100%' }}
            />
          </div>
          {/* On-site mode — blossoms into a warm hero only when the member is AT The Quarter;
              renders nothing otherwise (no forced prompt, no nag). */}
          <div className={cn(styles.slot, styles.ordGeo)}>
            <GeoCheckIn doorCode={doorCode} busyBand={band ? { label: band.label, line: band.line } : null} />
          </div>
          <div className={styles.ordManage}>
            <Button variant="primary" fullWidth href="/plan" iconAfter="arrow-right">
              {hasPlan ? 'Manage plan & billing' : 'Choose a plan'}
            </Button>
          </div>
          <div className={cn(styles.slot, styles.ordInstall)}>
            <InstallPrompt />
          </div>
          <div className={cn(styles.slot, styles.ordNotif)}>
            <NotificationToggle />
          </div>
          {billingError ? (
            <p className={styles.billingError}>
              Couldn&rsquo;t open one-click billing ({billingError}).{' '}
              <a href={STRIPE_BILLING_PORTAL_URL}>Open the standard portal</a>.
            </p>
          ) : null}

          <div className={cn(styles.slot, styles.ordCarnet)}>
            <CarnetMini />
          </div>

          {/* Gentle nudge: only until we have their birthday, then it disappears (the full
              birthday-treat card lives on /rewards). Collects day + month right here. */}
          {!loading && member && !bdaySet ? (
            <div className={styles.ordBirthday}>
              <BirthdayCard birthday={{ bday: null, claimed: null }} onSaved={refresh} />
            </div>
          ) : null}

          <div className={styles.ordEvents}>
            <EventsCard />
          </div>

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

      {/* The full membership card, wallet-style. Same QuarterCard the desktop rail shows —
          it's hidden below 600px, so this is the only way a member on a phone ever sees it. */}
      <MemberCardSheet open={cardOpen} onClose={() => setCardOpen(false)}>
        <QuarterCard
          memberName={display ?? email}
          plan={isPaused ? 'Paused' : slug ? cap(slug) : hasPlan ? 'Member' : 'Guest'}
          cardId={cardId}
          level={level}
          points={points ?? undefined}
          rewards={rewardsReady ?? undefined}
          logoSrc="/brand/logo-wordmark-black.png"
          style={{ maxWidth: '100%' }}
        />
      </MemberCardSheet>

      {debug ? (
        <pre className={styles.debug}>
          {JSON.stringify({ id: member.id, email: member.auth?.email, planConnections: member.planConnections, customFields: member.customFields, allPlans }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
