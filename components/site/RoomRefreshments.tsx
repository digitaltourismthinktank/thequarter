import { Photo } from '@/components/site/primitives';
import { Icon } from '@/components/ds/Icon';
import { PHOTOS } from '@/lib/media';
import styles from './RoomRefreshments.module.css';

/**
 * The Quarter — food & drink that comes with a meeting-room booking. Shown on both
 * the meeting-rooms landing and each room's detail page.
 *  - Refreshments (tea, coffee, pastries, yoghurts) are INCLUDED with every booking.
 *  - Lunch is an optional add-on: baguettes for a range of diets + a dessert, £12/head.
 *
 * Photos: PHOTOS.breakfast (complimentary pastries) for refreshments, PHOTOS.catering
 * (baguettes laid out for a meeting) for lunch — both from lib/media.ts.
 */
export function RoomRefreshments() {
  return (
    <div className={styles.grid}>
      <article className={styles.card}>
        <Photo src={PHOTOS.breakfast.src} alt={PHOTOS.breakfast.alt} ratio="4 / 3" sizes="(max-width: 760px) 100vw, 400px" />
        <div className={styles.body}>
          <span className={styles.tag}>
            <Icon name="coffee" size={14} color="var(--gold-700)" />
            Included with every booking
          </span>
          <h3 className={styles.title}>Refreshments, on us</h3>
          <p className={styles.text}>
            Tea, coffee, pastries and yoghurts are laid on for every room booking — help yourself and keep the meeting
            flowing, at no extra cost.
          </p>
        </div>
      </article>

      <article className={styles.card}>
        <Photo src={PHOTOS.catering.src} alt={PHOTOS.catering.alt} ratio="4 / 3" sizes="(max-width: 760px) 100vw, 400px" />
        <div className={styles.body}>
          <span className={styles.tag}>
            <Icon name="utensils" size={14} color="var(--gold-700)" />
            Add lunch · £12 a head
          </span>
          <h3 className={styles.title}>Lunch from The Sandwich Bar</h3>
          <p className={styles.text}>
            A wide range of baguettes catering for many dietary types, with a dessert included — just £12 a head. Add it
            when you book and we’ll have it ready and waiting.
          </p>
        </div>
      </article>
    </div>
  );
}
