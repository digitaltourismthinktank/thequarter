import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';

/* The Quarter — SpaceCard. Showcases a space (Main Space, Flexi Rooms, Café…). */

export function SpaceCard({ name, blurb, meta = [], imageSrc, imageCaption, tag, href, onOpen, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <a href={href || '#'} onClick={(e) => { e.preventDefault(); onOpen?.(); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', background: 'var(--surface-card)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-subtle)',
        boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transform: hover ? 'translateY(-4px)' : 'none',
        transition: 'transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)',
        ...style,
      }}>
      <div className="q-photo" data-caption={imageCaption || ''} style={{ aspectRatio: '4 / 3', backgroundImage: imageSrc ? `url(${imageSrc})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {tag ? <div style={{ position: 'absolute', top: 14, left: 14 }}><Badge tone="ink">{tag}</Badge></div> : null}
      </div>
      <div style={{ padding: '22px 24px 26px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>{name}</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 'var(--leading-normal)', flex: 1 }}>{blurb}</p>
        {meta.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 4 }}>
            {meta.map((m, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-medium)' }}>
                {m.icon ? <Icon name={m.icon} size={15} color="var(--gold-600)" /> : null}{m.label}
              </span>
            ))}
          </div>
        ) : null}
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink-900)' }}>
          Explore <Icon name="arrow-right" size={16} style={{ transform: hover ? 'translateX(3px)' : 'none', transition: 'transform var(--duration-base) var(--ease-out)' }} />
        </span>
      </div>
    </a>
  );
}
