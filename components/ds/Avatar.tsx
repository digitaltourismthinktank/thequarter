import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import styles from './Avatar.module.css';

/* The Quarter — Avatar. Member photo or initials, soft gold circle. */

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 44, lg: 56, xl: 72 };

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
  style?: CSSProperties;
}

export function Avatar({ name = '', src, size = 'md', className, style }: AvatarProps) {
  const px = SIZES[size];
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(styles.avatar, className)}
      style={{ width: px, height: px, fontSize: Math.round(px * 0.36), ...style }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className={styles.img} />
      ) : (
        initials || '·'
      )}
    </span>
  );
}
