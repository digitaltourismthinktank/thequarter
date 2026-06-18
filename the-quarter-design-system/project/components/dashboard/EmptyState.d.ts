import * as React from 'react';
import { IconName } from '../core/Icon';

export interface EmptyStateProps {
  /** @default 'sparkles' */
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tighter padding for in-panel use. @default false */
  compact?: boolean;
  style?: React.CSSProperties;
}

/** Calm, warm empty state — dashed soft panel, gold icon chip, optional CTA. */
export function EmptyState(props: EmptyStateProps): JSX.Element;
