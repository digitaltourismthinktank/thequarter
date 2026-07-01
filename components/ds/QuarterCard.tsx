import type { CSSProperties } from 'react';

/* The Quarter — QuarterCard. The digital membership card (Apple-Wallet-style).
   Ink ground, gold detail, the wordmark, member + plan + card id. The premium
   hero of the member dashboard. Faithful TSX port of the design-system component
   (components/dashboard/QuarterCard). */

export interface QuarterCardProps {
  memberName: string;
  plan?: string;
  cardId?: string;
  sinceLabel?: string;
  logoSrc?: string;
  qr?: boolean;
  style?: CSSProperties;
}

// Fixed QR motif (decorative) — the filled cells, matching the design system.
const QR_CELLS = new Set([0, 1, 2, 4, 5, 9, 10, 12, 14, 15, 18, 20, 21, 22, 24]);

export function QuarterCard({
  memberName,
  plan = 'Citizen',
  cardId = '0042',
  sinceLabel = 'Member since 2025',
  logoSrc,
  qr = true,
  style,
}: QuarterCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 380,
        aspectRatio: '1.586 / 1',
        padding: '26px 28px',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        color: 'var(--sand-50)',
        background: 'linear-gradient(150deg, #2A251E 0%, #1E1A15 56%, #14110D 100%)',
        boxShadow: 'var(--shadow-gold)',
        ...style,
      }}
    >
      {/* gold arc motif echoing the app icon */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -90,
          right: -70,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 70%, rgba(210,181,118,0.36), rgba(190,155,83,0.04) 70%)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="The Quarter" style={{ height: 22, filter: 'invert(1)' }} />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.03em' }}>The Quarter</span>
          )}
          <div
            style={{
              fontSize: 'var(--text-2xs)',
              letterSpacing: 'var(--tracking-caps)',
              textTransform: 'uppercase',
              color: 'var(--gold-400)',
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            Quarter Card
          </div>
        </div>
        <span
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--gold-500)',
            color: 'var(--gold-300)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
          }}
        >
          {plan}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--sand-50)' }}>{memberName}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 'var(--text-xs)', color: 'rgba(251,248,242,0.62)' }}>
            <span>No. {cardId}</span>
            <span>{sinceLabel}</span>
          </div>
        </div>
        {qr ? (
          <div
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              flex: 'none',
              borderRadius: 8,
              background: 'var(--sand-50)',
              display: 'grid',
              gridTemplateColumns: 'repeat(5,1fr)',
              gridTemplateRows: 'repeat(5,1fr)',
              gap: 2,
              padding: 5,
            }}
          >
            {Array.from({ length: 25 }).map((_, i) => (
              <span key={i} style={{ background: QR_CELLS.has(i) ? 'var(--ink-900)' : 'transparent', borderRadius: 1 }} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
