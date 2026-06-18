import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — Input. Soft, airy text field with optional icon + label. */

export function Input({
  label, hint, error, icon, type = 'text', id, value, defaultValue,
  placeholder, disabled = false, style, ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || `q-input-${Math.random().toString(36).slice(2, 8)}`;
  const borderColor = error ? 'var(--danger)' : focus ? 'var(--ink-900)' : 'var(--border-default)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
      {label ? (
        <label htmlFor={inputId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{label}</label>
      ) : null}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        background: disabled ? 'var(--sand-100)' : 'var(--surface-card)',
        border: `1.5px solid ${borderColor}`, borderRadius: 'var(--radius-md)',
        minHeight: 50, transition: 'border-color var(--duration-fast) var(--ease-standard)',
        boxShadow: focus ? '0 0 0 4px rgba(190,155,83,0.18)' : 'none',
      }}>
        {icon ? <Icon name={icon} size={18} color="var(--stone-500)" /> : null}
        <input
          id={inputId} type={type} value={value} defaultValue={defaultValue}
          placeholder={placeholder} disabled={disabled}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--text-strong)',
            padding: '13px 0', minWidth: 0,
          }}
          {...rest}
        />
      </div>
      {error ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{error}</span>
        : hint ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span> : null}
    </div>
  );
}
