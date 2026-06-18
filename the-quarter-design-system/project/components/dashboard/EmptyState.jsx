import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';

/* The Quarter — EmptyState. Calm, warm "nothing here yet" panel. */

export function EmptyState({ icon = 'sparkles', title, message, actionLabel, onAction, compact = false, style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 12, padding: compact ? '36px 28px' : '56px 32px',
      background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)',
      border: '1px dashed var(--border-default)', ...style,
    }}>
      <span style={{
        width: 60, height: 60, borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--gold-100)', marginBottom: 4,
      }}>
        <Icon name={icon} size={26} color="var(--gold-700)" />
      </span>
      <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink-900)' }}>{title}</h3>
      {message ? <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: 360, lineHeight: 'var(--leading-normal)' }}>{message}</p> : null}
      {actionLabel ? <div style={{ marginTop: 8 }}><Button size="sm" variant="primary" onClick={onAction} iconAfter="arrow-right">{actionLabel}</Button></div> : null}
    </div>
  );
}
