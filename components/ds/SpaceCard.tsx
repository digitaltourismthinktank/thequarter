import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { Badge } from './Badge';
import { cn } from '@/lib/cn';
import styles from './SpaceCard.module.css';

/* The Quarter — SpaceCard. Showcases a space (Main Space, Flexi Rooms, Café…).
   A whole-card link with a soft hover lift + arrow nudge (CSS). */

export interface SpaceMeta {
  icon?: IconName;
  label: string;
}

export interface SpaceCardProps {
  name: string;
  blurb?: string;
  meta?: SpaceMeta[];
  imageSrc: string;
  imageAlt?: string;
  tag?: string;
  href: string;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}

export function SpaceCard({
  name,
  blurb,
  meta = [],
  imageSrc,
  imageAlt,
  tag,
  href,
  sizes = '(max-width: 700px) 100vw, 380px',
  className,
  style,
}: SpaceCardProps) {
  return (
    <Link href={href} className={cn(styles.card, className)} style={style}>
      <div className={styles.photo}>
        <Image src={imageSrc} alt={imageAlt ?? name} fill sizes={sizes} className={styles.img} />
        {tag ? (
          <span className={styles.tag}>
            <Badge tone="ink">{tag}</Badge>
          </span>
        ) : null}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{name}</h3>
        {blurb ? <p className={styles.blurb}>{blurb}</p> : null}
        {meta.length ? (
          <div className={styles.meta}>
            {meta.map((m, i) => (
              <span key={i} className={styles.metaItem}>
                {m.icon ? <Icon name={m.icon} size={15} color="var(--gold-600)" /> : null}
                {m.label}
              </span>
            ))}
          </div>
        ) : null}
        <span className={styles.explore}>
          Explore <Icon name="arrow-right" size={16} className={styles.arrow} />
        </span>
      </div>
    </Link>
  );
}
