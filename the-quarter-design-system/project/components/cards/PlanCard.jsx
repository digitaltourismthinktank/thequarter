import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';

/* The Quarter — PlanCard. Membership plan / pricing tile. */

export function PlanCard({
  name, price, period, summary, features = [], featured = false,
  ctaLabel = 'Choose plan', onChoose, badge, style,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 20, padding: '30px 28px 32px',
      background: featured ? 'var(--ink-900)' : 'var(--surface-card)',
      color: featured ? 'var(--sand-50)' : 'var(--text-body)',
      borderRadius: 'var(--radius-xl)',
      border: featured ? '1px solid var(--ink-900)' : '1px solid var(--border-subtle)',
      boxShadow: featured ? 'var(--shadow-lg)' : 'var(--shadow-card)',
      position: 'relative', ...style,
    }}>
      {badge ? (
        <span style={{
          position: 'absolute', top: 22, right: 22, padding: '5px 12px', borderRadius: 'var(--radius-pill)',
          background: 'var(--gold-500)', color: 'var(--ink-900)', fontSize: 'var(--text-2xs)',
          fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
        }}>{badge}</span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 'var(--fw-semibold)', color: featured ? 'var(--gold-400)' : 'var(--gold-700)' }}>{name}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--tracking-tight)', color: featured ? 'var(--sand-50)' : 'var(--ink-900)' }}>{price}</span>
          {period ? <span style={{ fontSize: 'var(--text-sm)', color: featured ? 'rgba(251,248,242,0.7)' : 'var(--text-muted)' }}>{period}</span> : null}
        </div>
        {summary ? <p style={{ fontSize: 'var(--text-sm)', color: featured ? 'rgba(251,248,242,0.78)' : 'var(--text-body)', lineHeight: 'var(--leading-normal)' }}>{summary}</p> : null}
      </div>
      <div style={{ height: 1, background: featured ? 'rgba(251,248,242,0.16)' : 'var(--border-subtle)' }} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 'var(--text-sm)', color: featured ? 'rgba(251,248,242,0.9)' : 'var(--text-body)' }}>
            <Icon name="check" size={17} color={featured ? 'var(--gold-400)' : 'var(--gold-600)'} strokeWidth={2.25} style={{ marginTop: 1 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button variant={featured ? 'accent' : 'primary'} fullWidth onClick={onChoose} iconAfter="arrow-right">{ctaLabel}</Button>
    </div>
  );
}
