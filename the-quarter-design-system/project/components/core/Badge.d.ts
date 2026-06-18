import * as React from 'react';
import { IconName } from './Icon';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Status tone. `available`/`busy`/`soon` are room-status colours. @default 'neutral' */
  tone?: 'neutral' | 'gold' | 'ink' | 'available' | 'busy' | 'soon';
  /** Show a leading status dot. @default false */
  dot?: boolean;
  /** Optional leading icon. */
  icon?: IconName;
  /** @default 'md' */
  size?: 'sm' | 'md';
}

/** Quiet status pill — room availability, plan tags, "Included" markers. */
export function Badge(props: BadgeProps): JSX.Element;
