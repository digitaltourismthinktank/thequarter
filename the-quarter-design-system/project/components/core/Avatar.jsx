import React from 'react';

/* The Quarter — Avatar. Member photo or initials, soft circle. */

const SIZES = { xs: 28, sm: 36, md: 44, lg: 56, xl: 72 };

export function Avatar({ name = '', src, size = 'md', style, ...rest }) {
  const px = SIZES[size] || SIZES.md;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: px, height: px, borderRadius: '50%', overflow: 'hidden', flex: 'none',
        background: 'var(--gold-100)', color: 'var(--gold-700)',
        fontWeight: 'var(--fw-semibold)', fontSize: px * 0.36, letterSpacing: '0.01em',
        border: '1.5px solid var(--pure-white)', boxShadow: 'var(--shadow-xs)',
        ...style,
      }}
      {...rest}
    >
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (initials || '·')}
    </span>
  );
}
