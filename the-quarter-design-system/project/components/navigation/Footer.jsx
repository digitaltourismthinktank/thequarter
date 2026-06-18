import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — Footer. Warm, dark, generous. Used site-wide. */

export function Footer({ logoSrc, columns = [], note, address, style }) {
  return (
    <footer style={{
      background: 'var(--ink-900)', color: 'var(--sand-50)',
      padding: '72px 32px 36px', ...style,
    }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, justifyContent: 'space-between', paddingBottom: 56, borderBottom: '1px solid rgba(251,248,242,0.14)' }}>
          <div style={{ maxWidth: 320 }}>
            {logoSrc
              ? <img src={logoSrc} alt="The Quarter" style={{ height: 28, filter: 'invert(1)', marginBottom: 20 }} />
              : <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: '-0.03em', marginBottom: 20 }}>The Quarter</div>}
            <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', color: 'rgba(251,248,242,0.72)' }}>
              So much more than a workspace. A boutique coworking home in Canterbury's Cathedral Quarter.
            </p>
            {address ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 18, color: 'rgba(251,248,242,0.72)', fontSize: 'var(--text-sm)' }}>
                <Icon name="map-pin" size={16} color="var(--gold-400)" />
                <span>{address}</span>
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 56 }}>
            {columns.map(col => (
              <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', color: 'var(--gold-400)', fontWeight: 'var(--fw-semibold)' }}>{col.title}</span>
                {col.links.map(l => (
                  <a key={l.label} href={l.href || '#'} style={{ fontSize: 'var(--text-sm)', color: 'rgba(251,248,242,0.82)' }}>{l.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', paddingTop: 28, fontSize: 'var(--text-xs)', color: 'rgba(251,248,242,0.55)' }}>
          <span>{note || '© The Quarter, run by the Digital Tourism Think Tank.'}</span>
          <span style={{ display: 'flex', gap: 22 }}>
            <a href="#" style={{ color: 'rgba(251,248,242,0.7)' }}>Privacy</a>
            <a href="#" style={{ color: 'rgba(251,248,242,0.7)' }}>House rules</a>
            <a href="#" style={{ color: 'rgba(251,248,242,0.7)' }}>Contact</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
