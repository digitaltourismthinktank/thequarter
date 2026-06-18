import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';
import styles from './PerkCard.module.css';

/* The Quarter — PerkCard. A partner perk in the local rewards network.
   On the public site this is a TEASER: redemption happens in the member app
   (phase 2), so the footer shows where to redeem rather than a live action. */

export interface PerkCardProps {
  partner: string;
  perk: string;
  category?: string;
  expires?: string;
  logoSrc?: string;
  note?: string;
  className?: string;
  style?: CSSProperties;
}

export function PerkCard({
  partner,
  perk,
  category,
  expires,
  logoSrc,
  note = 'In the member app',
  className,
  style,
}: PerkCardProps) {
  return (
    <div className={cn(styles.card, className)} style={style}>
      <div className={styles.head}>
        <span className={styles.logo}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={partner} className={styles.logoImg} />
          ) : (
            partner?.[0] ?? '·'
          )}
        </span>
        <div className={styles.meta}>
          <span className={styles.partner}>{partner}</span>
          {category ? <span className={styles.category}>{category}</span> : null}
        </div>
      </div>
      <p className={styles.perk}>{perk}</p>
      <div className={styles.footer}>
        <span className={styles.expires}>{expires ?? 'Always on'}</span>
        <span className={styles.note}>
          <Icon name="gift" size={15} color="var(--gold-600)" />
          {note}
        </span>
      </div>
    </div>
  );
}
