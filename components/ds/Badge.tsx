import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/cn';
import styles from './Badge.module.css';

/* The Quarter — Badge. Small status / availability pill. Warm, quiet. */

export type BadgeTone = 'neutral' | 'gold' | 'ink' | 'available' | 'busy' | 'soon';

export interface BadgeProps {
  children?: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  icon?: IconName;
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

export function Badge({ children, tone = 'neutral', dot = false, icon, size = 'md', className, style }: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], size === 'sm' && styles.sm, className)} style={style}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} size={size === 'sm' ? 12 : 14} /> : null}
      {children}
    </span>
  );
}
