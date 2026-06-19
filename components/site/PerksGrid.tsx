'use client';

import { useState } from 'react';
import { PerkCard } from '@/components/ds/PerkCard';
import { PERKS, PERK_CATEGORIES } from '@/lib/perks';
import { cn } from '@/lib/cn';
import styles from './PerksGrid.module.css';

/* The Quarter — public perks catalogue with a category filter. Teaser only;
   redemption happens in the member app (phase 2). */

export function PerksGrid() {
  const [cat, setCat] = useState('All');
  const list = cat === 'All' ? PERKS : PERKS.filter((p) => p.category === cat);

  return (
    <div>
      <div className={styles.filters} role="group" aria-label="Filter perks by category">
        {PERK_CATEGORIES.map((c) => (
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
        {list.map((p) => (
          <PerkCard key={p.partner} partner={p.partner} perk={p.perk} category={p.category} expires={p.expires} />
        ))}
      </div>
    </div>
  );
}
