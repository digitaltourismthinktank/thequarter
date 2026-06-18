'use client';

import { useId } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { cn } from '@/lib/cn';
import styles from './Checkbox.module.css';

/* The Quarter — Checkbox. Soft square, gold-on-ink check. State is native
   (:checked drives the visual), so no JS toggle is needed. */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'id' | 'type'> {
  label?: string;
  description?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

export function Checkbox({ label, description, id, disabled, className, style, ...rest }: CheckboxProps) {
  const autoId = useId();
  const cbId = id ?? autoId;
  return (
    <label
      className={cn(styles.root, description && styles.alignStart, className)}
      style={style}
      data-disabled={disabled || undefined}
    >
      <input id={cbId} type="checkbox" disabled={disabled} className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={15} color="var(--gold-400)" strokeWidth={2.5} className={styles.check} />
      </span>
      {label || description ? (
        <span className={styles.text}>
          {label ? <span className={styles.label}>{label}</span> : null}
          {description ? <span className={styles.desc}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
