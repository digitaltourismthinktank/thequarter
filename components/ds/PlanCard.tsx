import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import styles from './PlanCard.module.css';

/* The Quarter — PlanCard. Membership plan / pricing tile. The CTA is a real
   link (href) — wire it to Stripe Checkout (subscriptions) or the Day Pass route. */

export interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  summary?: string;
  features?: string[];
  featured?: boolean;
  badge?: string;
  ctaLabel?: string;
  ctaHref: string;
  className?: string;
  style?: CSSProperties;
}

export function PlanCard({
  name,
  price,
  period,
  summary,
  features = [],
  featured = false,
  badge,
  ctaLabel = 'Choose plan',
  ctaHref,
  className,
  style,
}: PlanCardProps) {
  return (
    <div className={cn(styles.card, featured && styles.featured, className)} style={style}>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <div className={styles.priceRow}>
          <span className={styles.price}>{price}</span>
          {period ? <span className={styles.period}>{period}</span> : null}
        </div>
        {summary ? <p className={styles.summary}>{summary}</p> : null}
      </div>
      <div className={styles.divider} />
      <ul className={styles.features}>
        {features.map((f, i) => (
          <li key={i} className={styles.feature}>
            <Icon
              name="check"
              size={17}
              color={featured ? 'var(--gold-400)' : 'var(--gold-600)'}
              strokeWidth={2.25}
              className={styles.featureIcon}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button variant={featured ? 'accent' : 'primary'} fullWidth href={ctaHref} iconAfter="arrow-right">
        {ctaLabel}
      </Button>
    </div>
  );
}
