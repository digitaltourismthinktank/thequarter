import * as React from 'react';
import { IconName } from '../core/Icon';

export interface StatTileProps {
  label: string;
  /** Big value (number or short string). */
  value: React.ReactNode;
  /** Trailing unit, e.g. "days left". */
  unit?: string;
  icon?: IconName;
  /** Small footnote under the value. */
  hint?: string;
  /** 0–100 progress bar; omit to hide. */
  progress?: number;
  /** 'default' (white), 'gold' (soft wash), 'ink' (dark). @default 'default' */
  tone?: 'default' | 'gold' | 'ink';
  style?: React.CSSProperties;
}

/** Calm dashboard metric tile with optional progress bar. */
export function StatTile(props: StatTileProps): JSX.Element;
