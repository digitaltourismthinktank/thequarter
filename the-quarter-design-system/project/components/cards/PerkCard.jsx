import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — PerkCard. Partner perk in the member rewards catalogue. */

export function PerkCard({ partner, perk, category, expires, redeemed = false, onRedeem, logoSrc, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 22px 22px',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)',
        ...style,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 46, height: 46, flex: 'none', borderRadius: 'var(--radius-md)',
          background: 'var(--sand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-md)', color: 'var(--ink-900)', overflow: 'hidden',
        }}>
          {logoSrc ? <img src={logoSrc} alt={partner} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (partner?.[0] || '·')}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink-900)' }}>{partner}</span>
          {category ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gold-700)', fontWeight: 'var(--fw-medium)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)' }}>{category}</span> : null}
        </div>
      </div>
      <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-strong)', fontWeight: 'var(--fw-medium)', lineHeight: 'var(--leading-snug)', flex: 1 }}>{perk}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{expires || 'Always on'}</span>
        <button onClick={redeemed ? undefined : onRedeem} disabled={redeemed}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)',
            color: redeemed ? 'var(--success)' : 'var(--ink-900)', cursor: redeemed ? 'default' : 'pointer',
          }}>
          {redeemed ? <><Icon name="check" size={16} color="var(--success)" /> Redeemed</> : <>Redeem <Icon name="arrow-right" size={16} /></>}
        </button>
      </div>
    </div>
  );
}
