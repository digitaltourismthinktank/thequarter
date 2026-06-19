import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Icon } from '@/components/ds/Icon';
import { DayPassEmbed } from '@/components/site/DayPassEmbed';
import { getPlan } from '@/lib/plans';
import styles from './day-pass.module.css';

export const metadata: Metadata = {
  title: 'Book a Day Pass',
  description:
    'Your way in. A Day Pass at The Quarter, Canterbury — £21.60 for a full day with plug-and-play A/V, a daily healthy breakfast, Lavazza coffee and the Flexi Rooms. Includes VAT.',
  alternates: { canonical: '/day-pass' },
};

export default function DayPassPage() {
  const dayPass = getPlan('day-pass');
  const features = dayPass?.features ?? [];

  return (
    <Section tone="page">
      <a href="/" className={styles.back}>
        <Icon name="arrow-left" size={16} /> Back to home
      </a>

      <div className={styles.layout}>
        {/* Details */}
        <div>
          <Badge tone="gold" icon="map-pin">
            Cathedral Quarter, Canterbury
          </Badge>
          <h1 className={styles.h1}>Book your Day Pass</h1>
          <p className={styles.lead}>
            A full day with us — breakfast, Lavazza, fibre and the Flexi Rooms included. No commitment, just a really
            good day.
          </p>

          <ul className={styles.included}>
            {features.map((f) => (
              <li key={f} className={styles.includedItem}>
                <Icon name="check" size={17} color="var(--gold-600)" strokeWidth={2.25} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className={styles.priceRow}>
            <span className={styles.price}>£21.60</span>
            <span className={styles.priceNote}>one day · includes VAT</span>
          </div>
        </div>

        {/* Booking embed (Typeform → swappable to Stripe) */}
        <DayPassEmbed />
      </div>
    </Section>
  );
}
