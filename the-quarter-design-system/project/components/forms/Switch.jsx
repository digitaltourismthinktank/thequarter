import React from 'react';

/* The Quarter — Switch. Soft toggle; gold when on. */

export function Switch({ label, checked, defaultChecked, onChange, disabled = false, id, style, ...rest }) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const swId = id || `q-sw-${Math.random().toString(36).slice(2, 8)}`;
  const toggle = (e) => { if (disabled) return; if (!isControlled) setInternal(v => !v); onChange?.(e); };
  return (
    <label htmlFor={swId} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }}>
      <input id={swId} type="checkbox" checked={on} onChange={toggle} disabled={disabled}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} {...rest} />
      <span aria-hidden="true" style={{
        position: 'relative', width: 46, height: 27, flex: 'none', borderRadius: 999,
        background: on ? 'var(--ink-900)' : 'var(--sand-300)',
        transition: 'background var(--duration-base) var(--ease-standard)',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: '50%',
          background: on ? 'var(--gold-400)' : 'var(--pure-white)', boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--duration-base) var(--ease-out), background var(--duration-base) var(--ease-standard)',
        }} />
      </span>
      {label ? <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-strong)', fontWeight: 'var(--fw-medium)' }}>{label}</span> : null}
    </label>
  );
}
