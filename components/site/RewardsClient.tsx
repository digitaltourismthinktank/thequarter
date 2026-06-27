'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { Button } from '@/components/ds/Button';
import { useMember, memberPlanSlug } from './useMember';
import { PLANS } from '@/lib/plans';
import { EARN_RULES } from '@/lib/rewards';
import { getRewards, redeemReward, type RewardItem, type Redemption, type BirthdayState } from '@/lib/booking';
import { MemberTabs } from './MemberTabs';
import { BirthdayCard } from './BirthdayCard';
import { RedemptionSheet, type RedemptionInfo } from './RedemptionSheet';
import styles from './RewardsClient.module.css';

const reasonLabel: Record<string, string> = {
  checkin: 'Check-in',
  'checkin-quiet': 'Quiet-day check-in',
  spend: 'Spend at The Quarter',
  referral: 'Referral',
  welcome: 'Welcome bonus',
  annual: 'Annual prepay',
  redeem: 'Redeemed',
  adjust: 'Adjustment',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function RewardsClient() {
  const { loading: memberLoading, member } = useMember();
  const [points, setPoints] = useState(0);
  const [earnedLately, setEarnedLately] = useState(0);
  const [catalogue, setCatalogue] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [birthday, setBirthday] = useState<BirthdayState>({ bday: null, claimed: null });
  const [loaded, setLoaded] = useState(false);
  const [confirm, setConfirm] = useState<RewardItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<RedemptionInfo | null>(null);

  const memberName = useMemo(() => {
    const cf = (member?.customFields || {}) as Record<string, unknown>;
    return [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || 'Quarter member';
  }, [member]);
  const planName = useMemo(() => {
    const slug = memberPlanSlug(member);
    return slug ? PLANS.find((p) => p.id === slug)?.name ?? null : null;
  }, [member]);

  const load = useCallback(async () => {
    const r = await getRewards();
    if (r.ok) {
      setPoints(r.data.points);
      setEarnedLately(r.data.earnedLately);
      setCatalogue(r.data.catalogue);
      setRedemptions(r.data.redemptions);
      setBirthday(r.data.birthday);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (member) load();
  }, [member, load]);

  // Cooling-down = redeemed but not yet collected.
  const cooling = useMemo(
    () => new Set(redemptions.filter((r) => r.status === 'redeemed').map((r) => r.rewardId)),
    [redemptions],
  );

  // Progress to the next reward the member can't yet afford.
  const nextReward = useMemo(
    () => [...catalogue].filter((r) => r.cost > points).sort((a, b) => a.cost - b.cost)[0],
    [catalogue, points],
  );
  const pct = nextReward ? Math.min(100, Math.round((points / nextReward.cost) * 100)) : 100;

  async function doRedeem() {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    const r = await redeemReward(confirm.id);
    setBusy(false);
    if (!r.ok) {
      setError(
        r.data.error === 'insufficient'
          ? "You don't have enough points yet."
          : r.data.error === 'back-soon'
            ? 'This one is back soon — the partner is topping up.'
            : 'Something went wrong — please try again.',
      );
      return;
    }
    setPoints(r.data.balance);
    const reward = confirm;
    setConfirm(null);
    await load();
    setSheet({ kind: 'reward', title: reward.title, partner: reward.partner, icon: reward.icon as IconName, pos: reward.pos, token: r.data.token });
  }

  if (memberLoading) return <p className={styles.state}>Loading your rewards…</p>;
  if (!member)
    return (
      <p className={styles.state}>
        Please <a href="/login">log in</a> to see Quarter Rewards.
      </p>
    );

  return (
    <div className={styles.wrap}>
      <MemberTabs />

      <header className={styles.header}>
        <span className={styles.eyebrow}>Quarter Rewards</span>
        <h1 className={styles.h1}>A little back, for being a regular</h1>
        <p className={styles.sub}>Earn points by being here and spending locally, then spend them on treats around the Quarter.</p>
      </header>

      {/* Quarter Points Card */}
      <section className={styles.pointsCard}>
        <span className={styles.arc} aria-hidden="true" />
        <div className={styles.pcLeft}>
          <span className={styles.pcOver}>Quarter Points</span>
          <span className={styles.pcName}>
            {memberName}
            {planName ? ` · ${planName}` : ''}
          </span>
          <div className={styles.pcBalance}>
            <strong>{points.toLocaleString('en-GB')}</strong>
            <span>points</span>
          </div>
          {earnedLately > 0 ? <span className={styles.pcPill}>+{earnedLately.toLocaleString('en-GB')} earned lately</span> : null}
        </div>
        <div className={styles.ring} style={{ '--pct': String(pct) } as CSSProperties}>
          <div className={styles.ringHole}>
            <strong>{pct}%</strong>
            <span>{nextReward ? 'to go' : 'all set'}</span>
          </div>
        </div>
      </section>

      <BirthdayCard birthday={birthday} onSaved={load} />

      <div className={styles.cols}>
        {/* How you earn */}
        <section className={styles.earn}>
          <h2 className={styles.h2}>How you earn</h2>
          <div className={styles.earnRows}>
            {EARN_RULES.map((rule) => (
              <div key={rule.title} className={`${styles.earnRow} ${rule.lead ? styles.earnLead : ''}`}>
                <span className={`${styles.earnChip} ${rule.lead ? styles.earnChipLead : ''}`}>
                  <Icon name={rule.icon} size={20} color={rule.lead ? 'var(--ink-900)' : 'var(--gold-700)'} />
                </span>
                <div className={styles.earnText}>
                  <strong>{rule.title}</strong>
                  <span>{rule.note}</span>
                </div>
                <span className={`${styles.earnVal} ${rule.lead ? styles.earnValLead : ''}`}>{rule.value}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className={styles.side}>
          <div className={styles.sideCard}>
            <span className={styles.eyebrow}>How it works</span>
            <p className={styles.sideBody}>
              100 points is worth about £1 of treats. Points appear automatically when you check in, spend at The Quarter, or
              bring a friend who joins.
            </p>
          </div>
        </aside>
      </div>

      {/* Catalogue */}
      <section className={styles.catSection}>
        <h2 className={styles.h2}>Spend your points</h2>
        <div className={styles.catGrid}>
          {catalogue.map((r) => {
            const isCooling = cooling.has(r.id);
            const soon = r.avail === 'soon';
            const afford = points >= r.cost;
            return (
              <article key={r.id} className={`${styles.reward} ${soon ? styles.rewardSoon : ''} ${r.hero ? styles.rewardHero : ''}`}>
                <span className={styles.rewardChip}>
                  <Icon name={r.icon as IconName} size={22} color="var(--gold-700)" />
                </span>
                <span className={styles.rewardPartner}>{r.partner}</span>
                <h3 className={styles.rewardTitle}>{r.title}</h3>
                <span className={styles.rewardCost}>
                  {r.cost.toLocaleString('en-GB')} <span>pts</span>
                </span>
                {isCooling ? (
                  <>
                    <button className={styles.btnSand} disabled>
                      Redeemed · cooling down
                    </button>
                    <span className={styles.rewardNote}>Pop by to collect.</span>
                  </>
                ) : soon ? (
                  <>
                    <button className={styles.btnSand} disabled>
                      Back soon
                    </button>
                    <span className={styles.rewardNote}>Popular this month — back when the partner tops up.</span>
                  </>
                ) : afford ? (
                  <button className={styles.btnGold} onClick={() => setConfirm(r)}>
                    Redeem
                  </button>
                ) : (
                  <>
                    <button className={styles.btnOutline} disabled>
                      {(r.cost - points).toLocaleString('en-GB')} points to go
                    </button>
                    <span className={styles.rewardNote}>{(r.cost - points).toLocaleString('en-GB')} points to go.</span>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* History */}
      {redemptions.length ? (
        <section className={styles.history}>
          <h2 className={styles.h2}>Recently redeemed</h2>
          <div className={styles.historyCard}>
            {redemptions.map((h) => (
              <div key={h.id} className={styles.histRow}>
                <span className={styles.histChip}>
                  <Icon name="gift" size={17} color="var(--gold-700)" />
                </span>
                <div className={styles.histText}>
                  <strong>{h.reward}</strong>
                  <span>
                    {h.partner} · {fmtDate(h.at)}
                  </span>
                </div>
                <span className={styles.histPts}>−{h.cost.toLocaleString('en-GB')}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Redeem confirm */}
      {confirm ? (
        <div className={styles.confirmOverlay} onClick={() => !busy && setConfirm(null)} role="dialog" aria-modal="true">
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <span className={styles.offerChip}>
              <Icon name={confirm.icon as IconName} size={26} color="var(--gold-700)" />
            </span>
            <span className={styles.rewardPartner}>{confirm.partner}</span>
            <h3 className={styles.confirmTitle}>{confirm.title}</h3>
            <p className={styles.confirmLine}>Redeem for {confirm.cost.toLocaleString('en-GB')} points.</p>
            <p className={styles.confirmLeft}>You&rsquo;ll have {Math.max(0, points - confirm.cost).toLocaleString('en-GB')} left.</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.confirmBtns}>
              <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>
                Not yet
              </Button>
              <Button variant="primary" onClick={doRedeem} disabled={busy}>
                {busy ? 'Redeeming…' : 'Redeem'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RedemptionSheet info={sheet} memberName={memberName} memberPlan={planName} onClose={() => setSheet(null)} />
    </div>
  );
}
