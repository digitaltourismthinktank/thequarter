import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { PerksGrid } from '@/components/site/PerksGrid';
import { PerksClient } from '@/components/site/PerksClient';
import styles from './perks.module.css';

export const metadata: Metadata = {
  title: 'Member perks',
  description:
    'A local perks network across Canterbury’s Cathedral Quarter — food, coffee, culture and the little favours that make a neighbourhood feel like yours. Members redeem from the Quarter Card.',
  alternates: { canonical: '/perks' },
};

export default function PerksPage() {
  // Server-rendered marketing page (crawlable). PerksClient shows it to logged-out
  // visitors and swaps in the member browse + redemption for signed-in members.
  const marketing = (
    <>
      <Section tone="gold">
        <div className={styles.header}>
          <Eyebrow>Member perks</Eyebrow>
          <h1 className={styles.h1}>Good things, around the corner</h1>
          <p className={styles.lead}>
            Being a member opens doors across the Cathedral Quarter — food, coffee, culture and the little favours that
            make a neighbourhood feel like yours. Here&rsquo;s a taste; members redeem from the Quarter Card.
          </p>
        </div>
      </Section>

      <Section tone="page">
        <PerksGrid />
      </Section>

      <Section tone="ink">
        <div className={styles.cta}>
          <SectionHead
            align="center"
            dark
            title="Perks live on your Quarter Card"
            intro="Members carry the Quarter Card in Apple Wallet. Tap to browse partner perks and redeem them in a moment — arriving with the member app."
            max={560}
          />
          <div className={styles.ctaActions}>
            <Button size="lg" variant="accent" href="/plans" iconAfter="arrow-right">
              Become a member
            </Button>
          </div>
        </div>
      </Section>
    </>
  );

  return <PerksClient marketing={marketing} />;
}
