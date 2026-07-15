import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { Badge } from './Badge';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import styles from './RoomCard.module.css';

/* The Quarter — RoomCard. Meeting / flexi room with status + capacity. */

export type RoomStatus = 'available' | 'busy' | 'soon';

export interface RoomFeature {
  icon?: IconName;
  label: string;
}

export interface RoomCardProps {
  name: string;
  blurb?: string;
  capacity?: string;
  features?: RoomFeature[];
  status?: RoomStatus;
  statusLabel?: string;
  priceNote?: string;
  imageSrc: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref: string;
  layout?: 'vertical' | 'horizontal';
  className?: string;
  style?: CSSProperties;
}

const STATUS_TEXT: Record<RoomStatus, string> = {
  available: 'Available now',
  busy: 'In use',
  soon: 'Free soon',
};

export function RoomCard({
  name,
  blurb,
  capacity,
  features = [],
  status = 'available',
  statusLabel,
  priceNote = 'Quoted on enquiry',
  imageSrc,
  imageAlt,
  ctaLabel = 'Check availability',
  ctaHref,
  layout = 'vertical',
  className,
  style,
}: RoomCardProps) {
  return (
    <div className={cn(styles.card, className)} data-layout={layout} style={style}>
      <div className={styles.photo}>
        <Image
          src={imageSrc}
          alt={imageAlt ?? name}
          fill
          sizes={layout === 'horizontal' ? '280px' : '(max-width: 700px) 100vw, 380px'}
          className={styles.img}
        />
      </div>
      <div className={styles.body}>
        <div className={styles.head}>
          <h3 className={styles.title}>{name}</h3>
          {capacity ? (
            <Badge tone="neutral" icon="users" size="sm">
              {capacity}
            </Badge>
          ) : null}
        </div>
        {blurb ? <p className={styles.blurb}>{blurb}</p> : null}
        {features.length ? (
          <div className={styles.features}>
            {features.map((f, i) => (
              <span key={i} className={styles.feature}>
                {f.icon ? <Icon name={f.icon} size={15} color="var(--gold-600)" /> : null}
                {f.label}
              </span>
            ))}
          </div>
        ) : null}
        <div className={styles.footer}>
          <span className={styles.price}>{priceNote}</span>
          <Button size="sm" variant="primary" href={ctaHref} iconAfter="arrow-right">
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
