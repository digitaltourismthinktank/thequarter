import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import styles from './primitives.module.css';

/* The Quarter — shared website layout primitives (ported from the design
   system's section helpers). Presentational only. */

export function Eyebrow({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <span className={cn(styles.eyebrow, dark && styles.eyebrowDark, className)}>{children}</span>;
}

export type SectionTone = 'page' | 'card' | 'ink' | 'gold' | 'sunken';

export function Section({
  tone = 'page',
  children,
  id,
  className,
  style,
}: {
  tone?: SectionTone;
  children: ReactNode;
  id?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section id={id} className={cn(styles.section, styles[tone], className)} style={style}>
      <div className={styles.inner}>{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  intro,
  align = 'left',
  dark = false,
  max = 640,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  align?: 'left' | 'center';
  dark?: boolean;
  max?: number;
  className?: string;
}) {
  return (
    <div className={cn(styles.sectionHead, align === 'center' && styles.center, className)} style={{ maxWidth: max }}>
      {eyebrow ? <Eyebrow dark={dark}>{eyebrow}</Eyebrow> : null}
      <h2 className={cn(styles.headTitle, dark && styles.headTitleDark)}>{title}</h2>
      {intro ? <p className={cn(styles.headIntro, dark && styles.headIntroDark)}>{intro}</p> : null}
    </div>
  );
}

export interface IncludedItem {
  icon: IconName;
  label: string;
}

export function IncludedStrip({ items, dark = false }: { items: IncludedItem[]; dark?: boolean }) {
  return (
    <div className={styles.included}>
      {items.map((it, i) => (
        <div key={i} className={styles.includedItem}>
          <span className={cn(styles.includedIcon, dark && styles.includedIconDark)}>
            <Icon name={it.icon} size={20} color={dark ? 'var(--gold-400)' : 'var(--gold-700)'} />
          </span>
          <span className={cn(styles.includedLabel, dark && styles.includedLabelDark)}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export interface PhotoProps {
  src: string;
  alt: string;
  ratio?: string;
  radius?: string;
  sizes?: string;
  priority?: boolean;
  position?: string;
  className?: string;
  style?: CSSProperties;
}

export function Photo({
  src,
  alt,
  ratio = '4 / 3',
  radius = 'var(--radius-xl)',
  sizes = '100vw',
  priority = false,
  position = 'center',
  className,
  style,
}: PhotoProps) {
  return (
    <div className={cn(styles.photo, className)} style={{ aspectRatio: ratio, borderRadius: radius, ...style }}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={styles.photoImg} style={{ objectPosition: position }} />
    </div>
  );
}
