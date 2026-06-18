import * as React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  /** Secondary line under the label. */
  description?: string;
  style?: React.CSSProperties;
}

/** Checkbox — soft square, gold tick on ink fill. Controlled or uncontrolled. */
export function Checkbox(props: CheckboxProps): JSX.Element;
