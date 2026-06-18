'use client';

import { useId } from 'react';
import type { CSSProperties, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';
import styles from './Select.module.css';

/* The Quarter — Select. Native select styled to match Input. */

export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'style' | 'id'> {
  label?: string;
  hint?: string;
  options?: SelectOption[];
  id?: string;
  className?: string;
  style?: CSSProperties;
}

export function Select({ label, hint, options = [], id, disabled, className, style, ...rest }: SelectProps) {
  const autoId = useId();
  const selId = id ?? autoId;
  return (
    <div className={cn(styles.wrap, className)} style={style}>
      {label ? (
        <label htmlFor={selId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={styles.field} data-disabled={disabled || undefined}>
        <select id={selId} disabled={disabled} className={styles.select} {...rest}>
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          <Icon name="chevron-down" size={18} color="var(--stone-500)" />
        </span>
      </div>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
