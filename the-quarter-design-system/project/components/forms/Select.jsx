import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — Select. Native select styled to match Input. */

export function Select({ label, hint, options = [], value, defaultValue, disabled = false, id, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || `q-select-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
      {label ? <label htmlFor={selId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{label}</label> : null}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        background: disabled ? 'var(--sand-100)' : 'var(--surface-card)',
        border: `1.5px solid ${focus ? 'var(--ink-900)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', minHeight: 50,
        boxShadow: focus ? '0 0 0 4px rgba(190,155,83,0.18)' : 'none',
        transition: 'border-color var(--duration-fast) var(--ease-standard)',
      }}>
        <select
          id={selId} value={value} defaultValue={defaultValue} disabled={disabled}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none',
            background: 'transparent', flex: 1, padding: '13px 44px 13px 16px',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          {...rest}
        >
          {options.map(o => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <span style={{ position: 'absolute', right: 14, pointerEvents: 'none', display: 'flex' }}>
          <Icon name="chevron-down" size={18} color="var(--stone-500)" />
        </span>
      </div>
      {hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span> : null}
    </div>
  );
}
