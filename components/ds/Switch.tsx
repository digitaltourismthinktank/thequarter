'use client';

import { useId } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import styles from './Switch.module.css';

/* The Quarter — Switch. Soft toggle; gold knob when on. Native :checked drives
   the visual (no JS toggle). */

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'id' | 'type'> {
  label?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

export function Switch({ label, id, disabled, className, style, ...rest }: SwitchProps) {
  const autoId = useId();
  const swId = id ?? autoId;
  return (
    <label className={cn(styles.root, className)} style={style} data-disabled={disabled || undefined}>
      <input id={swId} type="checkbox" disabled={disabled} className={styles.input} {...rest} />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      {label ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
