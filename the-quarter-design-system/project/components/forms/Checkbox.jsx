import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — Checkbox. Soft square, gold-on-ink check. */

export function Checkbox({ label, description, checked, defaultChecked, onChange, disabled = false, id, style, ...rest }) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const cbId = id || `q-cb-${Math.random().toString(36).slice(2, 8)}`;
  const toggle = (e) => { if (disabled) return; if (!isControlled) setInternal(v => !v); onChange?.(e); };
  return (
    <label htmlFor={cbId} style={{
      display: 'flex', gap: 12, alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...style,
    }}>
      <input id={cbId} type="checkbox" checked={on} onChange={toggle} disabled={disabled}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} {...rest} />
      <span aria-hidden="true" style={{
        width: 22, height: 22, flex: 'none', borderRadius: 7, marginTop: description ? 2 : 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: on ? 'var(--ink-900)' : 'var(--surface-card)',
        border: `1.5px solid ${on ? 'var(--ink-900)' : 'var(--border-strong)'}`,
        transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
      }}>
        {on ? <Icon name="check" size={15} color="var(--gold-400)" strokeWidth={2.5} /> : null}
      </span>
      {(label || description) ? (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {label ? <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-strong)', fontWeight: 'var(--fw-medium)' }}>{label}</span> : null}
          {description ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
