import * as React from 'react';
import { IconName } from '../core/Icon';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  /** Field label shown above the input. */
  label?: string;
  /** Helper text below the field. */
  hint?: string;
  /** Error message — turns the field red and replaces the hint. */
  error?: string;
  /** Optional leading icon. */
  icon?: IconName;
  style?: React.CSSProperties;
}

/** Text field — soft-cornered, airy, with gold focus ring. */
export function Input(props: InputProps): JSX.Element;
