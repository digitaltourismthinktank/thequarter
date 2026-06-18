import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';
import { Button } from '../core/Button.jsx';

/* The Quarter — RoomCard. Meeting / flexi room with status + capacity. */

export function RoomCard({
  name, blurb, capacity, features = [], status = 'available', statusLabel,
  priceNote = 'Quoted on enquiry', imageSrc, imageCaption, ctaLabel = 'Check availability',
  onReserve, layout = 'vertical', style,
}) {
  const horizontal = layout === 'horizontal';
  const statusText = statusLabel || ({ available: 'Available now', busy: 'In use', soon: 'Free soon' }[status]);
  return (
    <div style={{
      display: 'flex', flexDirection: horizontal ? 'row' : 'column',
      background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)', ...style,
    }}>
      <div className="q-photo" data-caption={imageCaption || ''}
        style={{
          position: 'relative', flex: 'none',
          width: horizontal ? 280 : '100%', aspectRatio: horizontal ? 'auto' : '16 / 10',
          backgroundImage: imageSrc ? `url(${imageSrc})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
        <div style={{ position: 'absolute', top: 14, left: 14 }}><Badge tone={status} dot>{statusText}</Badge></div>
      </div>
      <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>{name}</h3>
          {capacity ? <Badge tone="neutral" icon="users" size="sm">{capacity}</Badge> : null}
        </div>
        {blurb ? <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 'var(--leading-normal)' }}>{blurb}</p> : null}
        {features.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {features.map((f, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-medium)' }}>
                {f.icon ? <Icon name={f.icon} size={15} color="var(--gold-600)" /> : null}{f.label || f}
              </span>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 'auto', paddingTop: 6 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{priceNote}</span>
          <Button size="sm" variant="primary" onClick={onReserve} iconAfter="arrow-right">{ctaLabel}</Button>
        </div>
      </div>
    </div>
  );
}
