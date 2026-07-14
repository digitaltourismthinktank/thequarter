'use client';

import { useEffect, useState } from 'react';
import { PerkCard } from '@/components/ds/PerkCard';
import { PERKS, type Perk } from '@/lib/perks';
import { getPublicPerks } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import { cn } from '@/lib/cn';
import styles from './PerksGrid.module.css';

/* The Quarter — public perks catalogue with a category filter. Renders the static
   seed (crawlable) first, then swaps in the LIVE perks from the Airtable backend —
   the same source members see, minus redemption. Editing a partner in the back end
   updates the public site. Teaser only; redemption happens in the member area. */

export function PerksGrid() {
  const [cat, setCat] = useState('All');
  const [perks, setPerks] = useState<Perk[]>(PERKS);

  useEffect(() => {
    if (PREVIEW) return; // no Functions in local preview — keep the static seed
    let cancelled = false;
    (async () => {
      const r = await getPublicPerks();
      if (!cancelled && r.ok && r.data.perks?.length) {
        setPerks(
          r.data.perks.map((p) => ({
            partner: p.partner,
            perk: p.offer,
            category: p.category || 'Perks',
            expires: p.days || 'Always on',
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = ['All', ...Array.from(new Set(perks.map((p) => p.category).filter(Boolean)))];
  const list = cat === 'All' ? perks : perks.filter((p) => p.category === cat);

  return (
    <div>
      <div className={styles.filters} role="group" aria-label="Filter perks by category">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === cat}
            onClick={() => setCat(c)}
            className={cn(styles.pill, c === cat && styles.pillActive)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {list.map((p, i) => (
          <PerkCard key={`${p.partner}-${i}`} partner={p.partner} perk={p.perk} category={p.category} expires={p.expires} />
        ))}
      </div>
    </div>
  );
}
