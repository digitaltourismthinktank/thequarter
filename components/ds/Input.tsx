'use client';

import { useId } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from '@/lib/cn';
import styles from './Input.module.css';

/* The Quarter — Input. Soft, airy text field with optional icon + label.
   Focus ring is CSS (:focus-within). */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'id'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

export function Input({ label, hint, error, icon, type = 'text', id, disabled, className, style, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn(styles.wrap, className)} style={style}>
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={cn(styles.field, error && styles.fieldError)} data-disabled={disabled || undefined}>
        {icon ? <Icon name={icon} size={18} color="var(--stone-500)" /> : null}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={styles.input}
          {...rest}
        />
      </div>
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
