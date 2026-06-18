import * as React from 'react';
import { IconName } from './Icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. primary = ink fill; accent = gold; secondary = outline; ghost; inverse (on dark). @default 'primary' */
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'inverse';
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Leading icon name. */
  icon?: IconName;
  /** Trailing icon name (e.g. 'arrow-right'). */
  iconAfter?: IconName;
  /** Stretch to fill its container. @default false */
  fullWidth?: boolean;
  disabled?: boolean;
}

/**
 * The Quarter's primary action control — soft pill, confident and warm.
 * @startingPoint section="Core" subtitle="Buttons in every variant & size" viewport="700x200"
 */
export function Button(props: ButtonProps): JSX.Element;
