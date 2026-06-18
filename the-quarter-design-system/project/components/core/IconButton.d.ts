import * as React from 'react';
import { IconName } from './Icon';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Icon name to render. */
  icon: IconName;
  /** Accessible label (also the tooltip). Required. */
  label: string;
  /** @default 'soft' */
  variant?: 'soft' | 'outline' | 'ghost' | 'solid';
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/** Icon-only control — square, soft-cornered, 44px default hit target. */
export function IconButton(props: IconButtonProps): JSX.Element;
