import type { CSSProperties } from 'react';
import { QuarterCard, type CardLevel } from '@/components/ds/QuarterCard';
import { LEVELS, levelProgress } from '@/lib/rewards';
import styles from './RewardShowcase.module.css';

/* The Quarter — RewardShowcase. A reusable, member-data-FREE showcase for the public
   Rewards page: the progress RING (mirrors RewardsClient's pointsCard ring) plus the
   loyalty-card-by-level — the Quarter Card shown at all four earned tiers, so visitors
   see how the card gilds as they climb. Illustrative sample data only; never imports
   member/session state. Designed to sit on an ink (dark) Section band. */

// Illustrative lifetime used to drive the ring + its caption (Regular → Family).
const SAMPLE_LIFETIME = 1600;

// A believable-but-fake card per level, so the row reads like four real members.
const CARD_SAMPLES: Record<CardLevel, { plan: string; cardId: string; points: number }> = {
  newbie: { plan: 'Visitor', cardId: '0142', points: 120 },
  regular: { plan: 'Resident', cardId: '0098', points: 900 },
  family: { plan: 'Citizen', cardId: '0031', points: 3200 },
  ambassador: { plan: 'Citizen', cardId: '0007', points: 7500 },
};

export function RewardShowcase({ pct }: { pct?: number }) {
  const prog = levelProgress(SAMPLE_LIFETIME);
  const shown = typeof pct === 'number' ? Math.max(0, Math.min(100, pct)) : prog.pct;

  return (
    <div className={styles.showcase}>
      {/* Progress medallion — the ring, self-contained on a dark panel. */}
      <div className={styles.medallion}>
        <span className={styles.medArc} aria-hidden="true" />
        <div className={styles.ring} style={{ '--pct': String(shown) } as CSSProperties}>
          <div className={styles.ringHole}>
            <strong>{shown}%</strong>
            <span>{prog.next ? `to ${prog.next.name}` : 'top tier'}</span>
          </div>
        </div>
        <div className={styles.medText}>
          <span className={styles.medOver}>Your progress</span>
          <span className={styles.medTitle}>{prog.next ? `Climbing to ${prog.next.name}` : 'Top tier reached'}</span>
          <span className={styles.medSub}>
            {prog.next
              ? `${prog.toGo.toLocaleString('en-GB')} points to go — every check-in and every £1 nudges the ring.`
              : 'The fastest earning, and every treat on the board.'}
          </span>
        </div>
      </div>

      {/* The Quarter Card at all four levels — the finish deepens as you climb. */}
      <div className={styles.cardRow}>
        {LEVELS.map((lv) => {
          const s = CARD_SAMPLES[lv.slug as CardLevel];
          return (
            <div key={lv.slug} className={styles.cardCell}>
              <QuarterCard
                memberName="Your name"
                plan={s.plan}
                cardId={s.cardId}
                level={lv.slug as CardLevel}
                points={s.points}
                qr
              />
              <div className={styles.cardCap}>
                <span className={styles.capName}>{lv.name}</span>
                <span className={styles.capPts}>{lv.min > 0 ? `${lv.min.toLocaleString('en-GB')} pts` : 'Start here'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
