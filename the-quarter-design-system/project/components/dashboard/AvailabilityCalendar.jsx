import React from 'react';
import { Icon } from '../core/Icon.jsx';

/* The Quarter — AvailabilityCalendar. Weekly room availability grid.
   The biggest revenue lever: glanceable, tappable, calm. Columns = days,
   rows = time slots, cells carry a status. Available cells are selectable. */

const CELL = {
  available: { bg: 'var(--surface-card)', border: '1px solid var(--border-default)', color: 'var(--ink-900)', label: 'Free', hover: 'var(--gold-100)' },
  busy:      { bg: 'var(--sand-100)', border: '1px solid var(--border-subtle)', color: 'var(--stone-400)', label: 'Booked', hover: null },
  soon:      { bg: 'rgba(181,134,47,0.10)', border: '1px solid rgba(181,134,47,0.3)', color: 'var(--warning)', label: 'Held', hover: 'var(--gold-100)' },
};

export function AvailabilityCalendar({
  days = [], slots = [], data = [], roomName, selectedKey, onSelect, style,
}) {
  const [internalSel, setInternalSel] = React.useState(null);
  const sel = selectedKey !== undefined ? selectedKey : internalSel;
  const pick = (di, si, status) => {
    if (status === 'busy') return;
    const key = `${di}-${si}`;
    if (selectedKey === undefined) setInternalSel(key);
    onSelect?.({ day: days[di], slot: slots[si], dayIndex: di, slotIndex: si, status });
  };
  const cols = `72px repeat(${days.length}, 1fr)`;
  return (
    <div style={{
      background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '20px 22px 22px',
      border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {roomName ? <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)' }}>{roomName}</h3> : null}
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>This week</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <Legend swatch="var(--surface-card)" border="var(--border-default)" label="Free" />
          <Legend swatch="rgba(181,134,47,0.18)" border="rgba(181,134,47,0.3)" label="Held" />
          <Legend swatch="var(--sand-100)" border="var(--border-subtle)" label="Booked" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6 }}>
        <div />
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', paddingBottom: 4 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink-900)' }}>{d.label}</div>
            {d.date ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{d.date}</div> : null}
          </div>
        ))}

        {slots.map((slot, si) => (
          <React.Fragment key={si}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-medium)' }}>{slot}</div>
            {days.map((_, di) => {
              const status = (data[si] && data[si][di]) || 'available';
              const c = CELL[status];
              const key = `${di}-${si}`;
              const isSel = sel === key;
              return (
                <button key={di} onClick={() => pick(di, si, status)} disabled={status === 'busy'}
                  style={{
                    height: 44, borderRadius: 'var(--radius-sm)', cursor: status === 'busy' ? 'default' : 'pointer',
                    background: isSel ? 'var(--ink-900)' : c.bg,
                    border: isSel ? '1px solid var(--ink-900)' : c.border,
                    color: isSel ? 'var(--gold-400)' : c.color,
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast)',
                  }}
                  onMouseEnter={(e) => { if (!isSel && c.hover) e.currentTarget.style.background = c.hover; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = c.bg; }}
                >
                  {isSel ? <Icon name="check" size={16} color="var(--gold-400)" strokeWidth={2.5} /> : c.label}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Legend({ swatch, border, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 12, borderRadius: 4, background: swatch, border: `1px solid ${border}` }} />{label}
    </span>
  );
}
