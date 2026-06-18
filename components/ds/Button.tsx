import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/cn';
import styles from './Button.module.css';

/* The Quarter — Button. Confident, warm, soft-cornered. Primary = ink fill;
   gold is the accent variant for premium / highlight CTAs. Renders a real
   <a> (via next/link) when `href` is given, otherwise a <button>. Hover/active
   states are CSS (no JS), so this stays a server component. */

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconAfter?: IconName;
  fullWidth?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type ButtonAsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'style' | 'href'> & { href: string };
export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    icon,
    iconAfter,
    fullWidth = false,
    children,
    className,
    ...rest
  } = props;

  const classes = cn(
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth && styles.full,
    className,
  );
  const iconSize = ICON_SIZE[size];
  const inner = (
    <>
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={iconSize} /> : null}
    </>
  );

  if ('href' in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {inner}
      </Link>
    );
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={classes} {...buttonRest}>
      {inner}
    </button>
  );
}
