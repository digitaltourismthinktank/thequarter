import * as React from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  style?: React.CSSProperties;
}

/** Toggle switch — gold knob on ink track when on. Controlled or uncontrolled. */
export function Switch(props: SwitchProps): JSX.Element;
