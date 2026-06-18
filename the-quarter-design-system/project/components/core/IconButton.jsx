import React from 'react';
import { Icon } from './Icon.jsx';

/* The Quarter — IconButton. Square, soft-cornered icon-only control. */

const SIZES = { sm: { box: 36, icon: 18 }, md: { box: 44, icon: 20 }, lg: { box: 52, icon: 22 } };
const VARIANTS = {
  soft:    { background: 'var(--sand-100)', color: 'var(--ink-900)', border: '1px solid transparent' },
  outline: { background: 'transparent', color: 'var(--ink-900)', border: '1.5px solid var(--border-default)' },
  ghost:   { background: 'transparent', color: 'var(--stone-600)', border: '1px solid transparent' },
  solid:   { background: 'var(--ink-900)', color: 'var(--sand-50)', border: '1px solid var(--ink-900)' },
};

export function IconButton({ icon, label, variant = 'soft', size = 'md', disabled = false, style, ...rest }) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.soft;
  const [hover, setHover] = React.useState(false);
  const hoverBg = !disabled && hover
    ? (variant === 'solid' ? { background: 'var(--ink-800)' }
      : variant === 'ghost' ? { background: 'var(--sand-100)' }
      : { background: 'var(--sand-200)', borderColor: 'var(--border-default)' })
    : {};
  return (
    <button
      aria-label={label} disabled={disabled} title={label}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: s.box, height: s.box, borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
        ...v, ...hoverBg, ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={s.icon} />
    </button>
  );
}
