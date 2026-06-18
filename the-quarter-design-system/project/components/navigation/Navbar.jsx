import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';

/* The Quarter — Navbar. Marketing-site top navigation.
   Transparent-over-hero or solid; pass the real wordmark via logoSrc. */

export function Navbar({
  logoSrc, links = [], variant = 'light', activeHref,
  onNavigate, ctaLabel = 'Book a day pass', onCta, signInLabel = 'Member login', onSignIn, style,
}) {
  const dark = variant === 'dark';
  const fg = dark ? 'var(--sand-50)' : 'var(--ink-900)';
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 32px', gap: 24, width: '100%', boxSizing: 'border-box',
      background: dark ? 'transparent' : 'rgba(251,248,242,0.86)',
      backdropFilter: dark ? 'none' : 'saturate(140%) blur(12px)',
      borderBottom: dark ? '1px solid rgba(251,248,242,0.14)' : '1px solid var(--border-subtle)',
      ...style,
    }}>
      <a href="#" onClick={(e) => { e.preventDefault(); onNavigate?.('/'); }} style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
        {logoSrc
          ? <img src={logoSrc} alt="The Quarter" style={{ height: 26, filter: dark ? 'invert(1)' : 'none' }} />
          : <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.03em', color: fg }}>The&nbsp;Quarter</span>}
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
        {links.map(l => {
          const active = l.href === activeHref;
          return (
            <a key={l.href} href={l.href}
              onClick={(e) => { e.preventDefault(); onNavigate?.(l.href); }}
              style={{
                padding: '9px 15px', borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)',
                color: active ? (dark ? 'var(--sand-50)' : 'var(--ink-900)') : (dark ? 'rgba(251,248,242,0.78)' : 'var(--stone-600)'),
                background: active ? (dark ? 'rgba(251,248,242,0.12)' : 'var(--sand-100)') : 'transparent',
                transition: 'color var(--duration-fast), background var(--duration-fast)',
              }}>
              {l.label}
            </a>
          );
        })}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <button onClick={onSignIn} style={{
          background: 'transparent', border: 'none', color: fg,
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)',
          padding: '10px 6px', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {signInLabel}
        </button>
        <Button size="sm" variant={dark ? 'inverse' : 'primary'} onClick={onCta} iconAfter="arrow-right">{ctaLabel}</Button>
      </div>
    </header>
  );
}
