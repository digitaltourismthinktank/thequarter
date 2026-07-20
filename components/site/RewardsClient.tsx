'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { Button } from '@/components/ds/Button';
import { useMember, memberPlanSlug } from './useMember';
import { PLANS } from '@/lib/plans';
import { EARN_RULES, LEVELS, levelProgress } from '@/lib/rewards';
import { getRewards, redeemReward, type RewardItem, type Redemption, type BirthdayState, type LedgerEntry } from '@/lib/booking';
import { BirthdayCard } from './BirthdayCard';
import { ReferFriendCard } from './ReferFriendCard';
import { RedemptionSheet, type RedemptionInfo } from './RedemptionSheet';
import { RewardsTabs } from './RewardsTabs';
import { MemberShell } from './MemberShell';
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

/**
 * /rewards — the member points dashboard when signed in; the public marketing page
 * (passed in, server-rendered, crawlable) for everyone else. Mirrors PerksClient so
 * the same route is both the shopfront and the member view.
 */
export function RewardsClient({ marketing }: { marketing: ReactNode }) {
  const { loading: memberLoading, member } = useMember();
  const [points, setPoints] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [earnedLately, setEarnedLately] = useState(0);
  const [catalogue, setCatalogue] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [activity, setActivity] = useState<LedgerEntry[]>([]);
  // Other members' tiers are reference material, not status — folded away by default.
  const [levelsOpen, setLevelsOpen] = useState(false);
  // The points card behaves like a real membership card: tap to turn it over.
  const [flipped, setFlipped] = useState(false);
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
  // Earned level + progress to the next one (drives the ring + the levels rail).
  const joined = useMemo(() => {
    const iso = member?.createdAt;
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } catch {
      return null;
    }
  }, [member]);
  const prog = useMemo(() => levelProgress(lifetime), [lifetime]);
  const level = prog.level;

  const load = useCallback(async () => {
    const r = await getRewards();
    if (r.ok) {
      setPoints(r.data.points);
      setLifetime(r.data.lifetimePoints ?? r.data.points);
      setEarnedLately(r.data.earnedLately);
      setCatalogue(r.data.catalogue);
      setRedemptions(r.data.redemptions);
      setActivity(r.data.activity ?? []);
      setBirthday(r.data.birthday);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (member) load();
  }, [member, load]);

  // Cooling-down = redeemed in the last COOLDOWN_HOURS (anti double-tap). Time-boxed
  // so a reward never stays locked forever — members can redeem it again afterwards.
  // (Riva to confirm the window / whether collection should clear it instead.)
  const COOLDOWN_HOURS = 12;
  const cooling = useMemo(() => {
    const cutoff = Date.now() - COOLDOWN_HOURS * 3600_000;
    return new Set(
      redemptions
        .filter((r) => r.status === 'redeemed' && r.at && new Date(r.at).getTime() >= cutoff)
        .map((r) => r.rewardId),
    );
  }, [redemptions]);

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

  // Logged-out / still resolving → the public marketing page (server-rendered, crawlable).
  if (memberLoading || !member) return <>{marketing}</>;

  return (
    <MemberShell>
    <div className={styles.wrap}>
      <RewardsTabs />

      <header className={styles.header}>
        <span className={styles.eyebrow}>Quarter Rewards</span>
        <h1 className={styles.h1}>A little thanks for checking in</h1>
        {/* Pitch copy on a page the member has already bought into — desktop only. */}
        <p className={`${styles.sub} ${styles.subDesktop}`}>Earn points by being here and spending locally, then spend them on treats around the Quarter.</p>
      </header>

      {/* Quarter Points Card — a real card, front and back. */}
      <div className={styles.cardFlip}>
        <div className={`${styles.cardInner} ${flipped ? styles.cardTurned : ''}`}>
      <section
        className={`${styles.pointsCard} ${styles.cardFront}`}
        onClick={() => setFlipped(true)}
        role="button"
        tabIndex={0}
        aria-label="Turn card over"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped(true))}
      >
        <span className={styles.arc} aria-hidden="true" />
        <div className={styles.pcLeft}>
          <span className={styles.pcOver}>Quarter Points</span>
          <span className={styles.pcName}>
            {memberName} · {level.name}
          </span>
          <div className={styles.pcBalance}>
            <strong>{points.toLocaleString('en-GB')}</strong>
            <span>points</span>
          </div>
          <span className={styles.pcNext}>
            {prog.next ? `${prog.toGo.toLocaleString('en-GB')} points to ${prog.next.name}` : 'Top tier reached — thank you'}
          </span>
          {earnedLately > 0 ? <span className={styles.pcPill}>+{earnedLately.toLocaleString('en-GB')} earned lately</span> : null}
          {/* The one thing the levels rail said about *you*, lifted up to where you are. */}
          <span className={styles.pcRate}>{level.boost === 1 ? 'Base earn rate' : `Earning ${Math.round((level.boost - 1) * 100)}% faster`}</span>
        </div>
        <div className={styles.ring} style={{ '--pct': String(prog.pct) } as CSSProperties}>
          <div className={styles.ringHole}>
            <strong>{prog.pct}%</strong>
            <span>{prog.next ? `to ${prog.next.name}` : 'top tier'}</span>
          </div>
        </div>
        <span className={styles.flipHint} aria-hidden="true">Tap to turn over</span>
      </section>

      {/* Back — what this level actually gets you, and how long you've been here. */}
      <section
        className={`${styles.pointsCard} ${styles.cardBack}`}
        onClick={() => setFlipped(false)}
        role="button"
        tabIndex={flipped ? 0 : -1}
        aria-label="Turn card back"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped(false))}
      >
        <div className={styles.pcLeft}>
          <span className={styles.pcOver}>{level.name} member</span>
          {joined ? <span className={styles.pcSince}>Here since {joined}</span> : null}
          <ul className={styles.backPerks}>
            {level.perks.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
          <span className={styles.pcRate}>{level.boost === 1 ? 'Base earn rate' : `Earning ${Math.round((level.boost - 1) * 100)}% faster`}</span>
        </div>
        <span className={styles.flipHint} aria-hidden="true">Tap to turn back</span>
      </section>
        </div>
      </div>

      {/* Levels — named tiers everyone climbs by earning points over time. Four full-width
          cards ran to ~720px on a phone: two screens of other people's tiers between your
          status and anything you can act on. The rail is unchanged; it just folds away, and
          the pips give you the shape of the ladder at a glance. */}
      <button type="button" className={styles.levelsBar} onClick={() => setLevelsOpen((v) => !v)} aria-expanded={levelsOpen}>
        <span className={styles.pips} aria-hidden="true">
          {LEVELS.map((lv) => (
            <span
              key={lv.slug}
              className={`${styles.pip} ${lifetime >= lv.min ? styles.pipOn : ''} ${lv.slug === level.slug ? styles.pipYou : ''}`}
            />
          ))}
        </span>
        <span className={styles.levelsBarText}>{levelsOpen ? 'Hide levels' : 'What each level gets you'}</span>
      </button>
      <section className={`${styles.levels} ${levelsOpen ? styles.levelsOpen : ''}`} aria-label="Your level">
        {LEVELS.map((lv) => {
          const on = lv.slug === level.slug;
          const reached = lifetime >= lv.min;
          return (
            <div key={lv.slug} className={`${styles.level} ${on ? styles.levelOn : ''}`}>
              <div className={styles.levelHead}>
                <span className={styles.levelName}>{lv.name}</span>
                {on ? <span className={styles.levelYou}>You’re here</span> : <span className={styles.levelThresh}>{lv.min > 0 ? `${lv.min.toLocaleString('en-GB')} pts` : 'Start'}</span>}
              </div>
              <span className={styles.levelRate}>{lv.boost === 1 ? 'Base earn rate' : `Earn ${Math.round((lv.boost - 1) * 100)}% faster`}</span>
              <ul className={styles.levelPerks}>
                {lv.perks.map((p) => (
                  <li key={p} className={reached ? '' : styles.perkLocked}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

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

      </div>

      {/* Activity — earns and spends in one list. The ledger already carries redemptions as
          negative entries, so using it alone avoids listing a redemption twice. */}
      {activity.length ? (
        <section className={styles.history}>
          <h2 className={styles.h2}>Your activity</h2>
          <div className={styles.historyCard}>
            {activity.map((h) => (
              <div key={h.id} className={styles.histRow}>
                <span className={styles.histChip}>
                  <Icon name={h.delta < 0 ? 'gift' : 'star'} size={17} color="var(--gold-700)" />
                </span>
                <div className={styles.histText}>
                  <strong>{reasonLabel[h.reason] || h.reason || 'Points'}</strong>
                  <span>{fmtDate(h.at)}</span>
                </div>
                <span className={`${styles.histPts} ${h.delta > 0 ? styles.histPlus : ''}`}>
                  {h.delta > 0 ? '+' : '−'}
                  {Math.abs(h.delta).toLocaleString('en-GB')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : redemptions.length ? (
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

      {/* Occasional extras, below the things you came here for. */}
      <BirthdayCard birthday={birthday} onSaved={load} />
      <ReferFriendCard />

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
    </MemberShell>
  );
}
