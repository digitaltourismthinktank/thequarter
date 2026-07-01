import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

/* The Quarter — EmptyState. Calm, warm "nothing here yet" panel. Faithful TSX
   port of the design-system component (components/dashboard/EmptyState). */

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: CSSProperties;
}

export function EmptyState({ icon = 'sparkles', title, message, actionLabel, actionHref, onAction, compact = false, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        padding: compact ? '36px 28px' : '56px 32px',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px dashed var(--border-default)',
        ...style,
      }}
    >
      <span
        style={{
          width: 60,
          height: 60,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--gold-100)',
          marginBottom: 4,
        }}
      >
        <Icon name={icon} size={26} color="var(--gold-700)" />
      </span>
      <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--ink-900)' }}>{title}</h3>
      {message ? <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: 360, lineHeight: 'var(--leading-normal)' }}>{message}</p> : null}
      {actionLabel ? (
        <div style={{ marginTop: 8 }}>
          {actionHref ? (
            <Button size="sm" variant="primary" href={actionHref} iconAfter="arrow-right">
              {actionLabel}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={onAction} iconAfter="arrow-right">
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
