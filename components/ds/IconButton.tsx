import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/cn';
import styles from './IconButton.module.css';

/* The Quarter — IconButton. Square, soft-cornered icon-only control.
   `label` is required for accessibility (aria-label + title). */

export type IconButtonVariant = 'soft' | 'outline' | 'ghost' | 'solid';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<IconButtonSize, number> = { sm: 18, md: 20, lg: 22 };

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  icon: IconName;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  className?: string;
  style?: CSSProperties;
}

export function IconButton({
  icon,
  label,
  variant = 'soft',
  size = 'md',
  type = 'button',
  className,
  style,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(styles.btn, styles[variant], styles[size], className)}
      style={style}
      {...rest}
    >
      <Icon name={icon} size={ICON_SIZE[size]} />
    </button>
  );
}
