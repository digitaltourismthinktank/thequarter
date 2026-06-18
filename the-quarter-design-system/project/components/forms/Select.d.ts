import * as React from 'react';

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'style'> {
  label?: string;
  hint?: string;
  /** Options as strings or {value,label} objects. */
  options?: Array<string | SelectOption>;
  style?: React.CSSProperties;
}

/** Styled native select — matches Input's shape and focus ring. */
export function Select(props: SelectProps): JSX.Element;
