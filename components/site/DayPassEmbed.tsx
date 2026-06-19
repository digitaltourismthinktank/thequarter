import { Icon } from '@/components/ds/Icon';
import { TYPEFORM_DAYPASS_URL, isCheckoutConfigured } from '@/lib/commerce';
import styles from './DayPassEmbed.module.css';

/* The Quarter — Day Pass booking.
   Phase 1: embed the Typeform (set TYPEFORM_DAYPASS_URL). Isolated here so it
   can be swapped to Stripe Checkout later without touching the page. Until the
   URL is set, a clearly-marked placeholder shows what to fill in. */

export function DayPassEmbed() {
  if (!isCheckoutConfigured(TYPEFORM_DAYPASS_URL)) {
    return (
      <div className={styles.placeholder}>
        <span className={styles.phIcon}>
          <Icon name="calendar" size={26} color="var(--gold-700)" />
        </span>
        <h3 className={styles.phTitle}>Day Pass booking form</h3>
        <p className={styles.phText}>
          The Typeform booking embed will appear here. Set{' '}
          <span className={styles.phCode}>TYPEFORM_DAYPASS_URL</span> in{' '}
          <span className={styles.phCode}>lib/commerce.ts</span> (or the{' '}
          <span className={styles.phCode}>NEXT_PUBLIC_TYPEFORM_DAYPASS_URL</span> env var). Built to swap to Stripe
          Checkout later.
        </p>
      </div>
    );
  }

  return (
    <iframe
      className={styles.embed}
      src={TYPEFORM_DAYPASS_URL}
      title="Book your Day Pass"
      loading="lazy"
      allow="camera; microphone; autoplay; encrypted-media;"
    />
  );
}
