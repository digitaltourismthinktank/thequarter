'use client';

import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { getPublicRewards, type PublicReward } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import { CATALOGUE_SEED, type RewardSeed } from '@/lib/rewards';
import styles from '@/app/rewards/rewards.module.css';

/* The Quarter — public "Treats" teaser on /rewards. Shows the LIVE reward catalogue
   from the admin back end (the same source members redeem from, minus points/cost), so
   the marketing page always reflects what's actually on the board. No live rewards yet →
   a tasteful "coming soon" rather than placeholder examples. Local preview has no
   Functions, so it falls back to the seed to preview the design. */

const SEED_IDS = ['coffee', 'treat', 'refillery', 'cathedral', 'corkk-evening'];
const seedToPublic = (r: RewardSeed): PublicReward => ({
  id: r.id,
  partner: r.partner,
  title: r.title,
  cost: r.cost,
  category: r.category,
  icon: r.icon,
  hero: !!r.hero,
});
const PREVIEW_TREATS: PublicReward[] = PREVIEW
  ? SEED_IDS.map((id) => CATALOGUE_SEED.find((r) => r.id === id))
      .filter((r): r is RewardSeed => Boolean(r))
      .map(seedToPublic)
  : [];

export function TreatsGrid() {
  const [treats, setTreats] = useState<PublicReward[]>(PREVIEW_TREATS);
  const [loaded, setLoaded] = useState(PREVIEW);

  useEffect(() => {
    if (PREVIEW) return; // no Netlify Functions in local preview — keep the seed
    let cancelled = false;
    (async () => {
      const r = await getPublicRewards();
      if (cancelled) return;
      if (r.ok && Array.isArray(r.data.rewards)) setTreats(r.data.rewards);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!treats.length) {
    // Before the fetch resolves, render nothing (avoids a flash of the empty message);
    // once loaded with nothing on the board, show the on-brand placeholder.
    if (!loaded) return null;
    return (
      <p className={styles.rewardsEmpty}>
        We’re lining up treats with our local independents — watch this space.
      </p>
    );
  }

  return (
    <div className={styles.rewards}>
      {treats.map((r) => (
        <article key={r.id} className={`${styles.reward} ${r.hero ? styles.rewardHero : ''}`}>
          <span className={styles.rewardChip}>
            <Icon name={r.icon as IconName} size={22} color="var(--gold-700)" />
          </span>
          <span className={styles.rewardPartner}>{r.partner}</span>
          <h3 className={styles.rewardTitle}>{r.title}</h3>
        </article>
      ))}
    </div>
  );
}
