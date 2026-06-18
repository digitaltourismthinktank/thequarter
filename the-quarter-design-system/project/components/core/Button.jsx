import React from 'react';
import { Icon } from './Icon.jsx';

/* The Quarter — Button
   Confident, warm, soft-cornered. Primary = ink (black) fill; gold is reserved
   as the accent variant for premium / highlight CTAs. */

const SIZES = {
  sm: { padding: '8px 16px', font: 'var(--text-sm)', gap: '6px', icon: 16, radius: 'var(--radius-md)', minH: 36 },
  md: { padding: '12px 22px', font: 'var(--text-base)', gap: '8px', icon: 18, radius: 'var(--radius-pill)', minH: 46 },
  lg: { padding: '16px 30px', font: 'var(--text-md)', gap: '10px', icon: 20, radius: 'var(--radius-pill)', minH: 56 },
};

const VARIANTS = {
  primary: { background: 'var(--ink-900)', color: 'var(--sand-50)', border: '1.5px solid var(--ink-900)' },
  accent:  { background: 'var(--gold-500)', color: 'var(--ink-900)', border: '1.5px solid var(--gold-500)' },
  secondary: { background: 'transparent', color: 'var(--ink-900)', border: '1.5px solid var(--border-strong)' },
  ghost:   { background: 'transparent', color: 'var(--ink-900)', border: '1.5px solid transparent' },
  inverse: { background: 'var(--sand-50)', color: 'var(--ink-900)', border: '1.5px solid var(--sand-50)' },
};

export function Button({
  children, variant = 'primary', size = 'md', icon, iconAfter,
  fullWidth = false, disabled = false, style, ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const hoverStyle = !disabled && hover ? {
    primary:   { background: 'var(--ink-800)', borderColor: 'var(--ink-800)' },
    accent:    { background: 'var(--accent-hover)', borderColor: 'var(--accent-hover)' },
    secondary: { background: 'var(--ink-900)', color: 'var(--sand-50)', borderColor: 'var(--ink-900)' },
    ghost:     { background: 'var(--sand-100)' },
    inverse:   { background: 'var(--pure-white)' },
  }[variant] : {};

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, padding: s.padding, minHeight: s.minH,
        fontFamily: 'var(--font-sans)', fontSize: s.font, fontWeight: 'var(--fw-semibold)',
        letterSpacing: '-0.01em', lineHeight: 1, borderRadius: s.radius,
        width: fullWidth ? '100%' : 'auto',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transform: active ? 'scale(0.97)' : 'scale(1)',
        transition: 'background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
        ...v, ...hoverStyle, ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={s.icon} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={s.icon} /> : null}
    </button>
  );
}
