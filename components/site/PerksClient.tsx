'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { useMember, memberPlanSlug } from './useMember';
import { RewardsTabs } from './RewardsTabs';
import { PLANS } from '@/lib/plans';
import { getMemberPerks, usePerk, type PerkItem } from '@/lib/booking';
import { MemberShell } from './MemberShell';
import { RedemptionSheet, type RedemptionInfo } from './RedemptionSheet';
import styles from './PerksClient.module.css';

/**
 * /perks — member perks browse + detail + redemption when logged in; the public
 * marketing page (passed in, server-rendered, crawlable) for everyone else.
 */
export function PerksClient({ marketing }: { marketing: ReactNode }) {
  const { loading, member } = useMember();
  const [perks, setPerks] = useState<PerkItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cat, setCat] = useState('All');
  const [active, setActive] = useState<PerkItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<RedemptionInfo | null>(null);
  const [perkErr, setPerkErr] = useState<string | null>(null);

  const memberName = useMemo(() => {
    const cf = (member?.customFields || {}) as Record<string, unknown>;
    return [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || 'Quarter member';
  }, [member]);
  const planName = useMemo(() => {
    const slug = memberPlanSlug(member);
    return slug ? PLANS.find((p) => p.id === slug)?.name ?? null : null;
  }, [member]);

  const load = useCallback(async () => {
    const r = await getMemberPerks();
    if (r.ok) setPerks(r.data.perks);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (member) load();
  }, [member, load]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(perks.map((p) => p.category).filter(Boolean)))], [perks]);
  const list = cat === 'All' ? perks : perks.filter((p) => p.category === cat);

  async function openPerk(p: PerkItem) {
    setBusy(true);
    setPerkErr(null);
    const r = await usePerk(p.id);
    setBusy(false);
    if (r.ok) {
      setSheet({
        kind: 'perk',
        title: p.offer,
        partner: p.partner,
        icon: p.icon as IconName,
        pos: p.pos,
        auth: p.authorisedBy,
        token: r.data.token,
      });
    } else {
      setPerkErr(
        r.data?.error === 'not-found'
          ? 'This perk isn’t available right now.'
          : 'Couldn’t open this perk just now — please try again.',
      );
    }
  }

  // Logged-out / still resolving → the public marketing page (server-rendered).
  if (loading || !member) return <>{marketing}</>;

  return (
    <MemberShell>
      <div className={styles.wrap}>
        {active ? (
          <div className={styles.detailWrap}>
            <button className={styles.back} onClick={() => setActive(null)}>
              ‹ All perks
            </button>
            <article className={styles.detail}>
              <span className={styles.detailChip}>
                <Icon name={active.icon as IconName} size={30} color="var(--gold-700)" />
              </span>
              <span className={styles.cat}>{active.category}</span>
              <h2 className={styles.detailPartner}>{active.partner}</h2>
              <p className={styles.detailOffer}>{active.offer}</p>
              <div className={styles.detailChips}>
                {active.days ? <span className={styles.metaChip}>{active.days}</span> : null}
                {active.type ? <span className={styles.metaChip}>{active.type}</span> : null}
              </div>
              {active.pos ? (
                <div className={styles.how}>
                  <span className={styles.howLabel}>How it works</span>
                  <p>Show this to staff and they&rsquo;ll sort it. {active.pos}</p>
                </div>
              ) : null}
              <button className={styles.use} onClick={() => openPerk(active)} disabled={busy}>
                {busy ? 'Opening…' : 'Use this perk'}
              </button>
              {perkErr ? <p className={styles.perkErr}>{perkErr}</p> : null}
            </article>
          </div>
        ) : (
          <>
            <RewardsTabs />

            <header className={styles.header}>
              <span className={styles.eyebrow}>Local perks</span>
              <h1 className={styles.h1}>Good things, around the corner</h1>
              <p className={styles.sub}>Little favours from our neighbours. Open one and show it at the counter.</p>
            </header>

            <div className={styles.chips} role="group" aria-label="Filter perks by category">
              {categories.map((c) => (
                <button key={c} className={`${styles.chip} ${c === cat ? styles.chipActive : ''}`} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>

            {loaded && list.length === 0 ? (
              <p className={styles.empty}>No perks in this category just yet — do check back.</p>
            ) : (
              <div className={styles.grid}>
                {list.map((p) => (
                  <button key={p.id} className={styles.card} onClick={() => setActive(p)}>
                    <span className={styles.cardChip}>
                      <Icon name={p.icon as IconName} size={22} color="var(--gold-700)" />
                    </span>
                    <span className={styles.cardPartner}>{p.partner}</span>
                    <span className={styles.cat}>{p.category}</span>
                    <span className={styles.cardOffer}>{p.offer}</span>
                    <span className={styles.cardFoot}>
                      <span>{p.days || 'Always on'}</span>
                      <span className={styles.view}>View ›</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <RedemptionSheet info={sheet} memberName={memberName} memberPlan={planName} onClose={() => setSheet(null)} />
    </MemberShell>
  );
}
