import React from 'react';
import { Icon } from './Icon.jsx';

/* The Quarter — Badge. Small status / availability pill. Warm, quiet. */

const TONES = {
  neutral:  { background: 'var(--sand-100)', color: 'var(--stone-700)', dot: 'var(--stone-400)' },
  gold:     { background: 'var(--gold-100)', color: 'var(--gold-700)', dot: 'var(--gold-500)' },
  ink:      { background: 'var(--ink-900)', color: 'var(--sand-50)', dot: 'var(--gold-400)' },
  available:{ background: 'rgba(75,122,82,0.12)', color: 'var(--success)', dot: 'var(--success)' },
  busy:     { background: 'rgba(169,68,47,0.12)', color: 'var(--danger)', dot: 'var(--danger)' },
  soon:     { background: 'rgba(181,134,47,0.14)', color: 'var(--warning)', dot: 'var(--warning)' },
};

export function Badge({ children, tone = 'neutral', dot = false, icon, size = 'md', style, ...rest }) {
  const t = TONES[tone] || TONES.neutral;
  const pad = size === 'sm' ? '3px 9px' : '5px 12px';
  const fs = size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad,
        background: t.background, color: t.color, borderRadius: 'var(--radius-pill)',
        fontSize: fs, fontWeight: 'var(--fw-semibold)', letterSpacing: '0.01em',
        lineHeight: 1, whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      {dot ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.dot, flex: 'none' }} /> : null}
      {icon ? <Icon name={icon} size={size === 'sm' ? 12 : 14} /> : null}
      {children}
    </span>
  );
}
