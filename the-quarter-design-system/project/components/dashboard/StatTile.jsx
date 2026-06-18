import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — StatTile. Calm dashboard metric (days left, bookings…). */

export function StatTile({ label, value, unit, icon, hint, progress, tone = 'default', style }) {
  const isInk = tone === 'ink';
  const isGold = tone === 'gold';
  const bg = isInk ? 'var(--ink-900)' : isGold ? 'var(--gold-100)' : 'var(--surface-card)';
  const fg = isInk ? 'var(--sand-50)' : 'var(--ink-900)';
  const sub = isInk ? 'rgba(251,248,242,0.66)' : 'var(--text-muted)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 14, padding: '22px 24px',
      background: bg, borderRadius: 'var(--radius-lg)',
      border: isInk ? '1px solid var(--ink-900)' : isGold ? '1px solid var(--gold-200)' : '1px solid var(--border-subtle)',
      boxShadow: isInk ? 'none' : 'var(--shadow-card)', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: sub, fontWeight: 'var(--fw-medium)' }}>{label}</span>
        {icon ? (
          <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isInk ? 'rgba(251,248,242,0.1)' : isGold ? 'var(--gold-200)' : 'var(--sand-100)' }}>
            <Icon name={icon} size={18} color={isInk ? 'var(--gold-400)' : 'var(--gold-700)'} />
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--tracking-tight)', color: fg, lineHeight: 1 }}>{value}</span>
        {unit ? <span style={{ fontSize: 'var(--text-sm)', color: sub }}>{unit}</span> : null}
      </div>
      {typeof progress === 'number' ? (
        <div style={{ height: 6, borderRadius: 999, background: isInk ? 'rgba(251,248,242,0.16)' : 'var(--sand-200)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%', borderRadius: 999, background: 'var(--gold-500)' }} />
        </div>
      ) : null}
      {hint ? <span style={{ fontSize: 'var(--text-xs)', color: sub }}>{hint}</span> : null}
    </div>
  );
}
