import type { CSSProperties } from 'react';

/* The Quarter — QuarterCard. The digital membership + loyalty card. Ink ground,
   gold detail, the wordmark, member + plan + card id + points. The card's finish
   deepens with the member's earned level (Newbie → Ambassador). The premium hero
   of the member dashboard. */

export type CardLevel = 'newbie' | 'regular' | 'family' | 'ambassador';

export interface QuarterCardProps {
  memberName: string;
  plan?: string;
  cardId?: string;
  sinceLabel?: string;
  level?: CardLevel;
  points?: number;
  rewards?: number;
  logoSrc?: string;
  qr?: boolean;
  style?: CSSProperties;
}

// Fixed QR motif (decorative) — the filled cells, matching the design system.
const QR_CELLS = new Set([0, 1, 2, 4, 5, 9, 10, 12, 14, 15, 18, 20, 21, 22, 24]);

const LEVEL_NAME: Record<CardLevel, string> = { newbie: 'Newbie', regular: 'Regular', family: 'Family', ambassador: 'Ambassador' };
/** The card finish deepens and gilds with the earned level. */
const LEVEL_STYLE: Record<CardLevel, { bg: string; arc: string; border: string }> = {
  newbie: { bg: 'linear-gradient(150deg, #2A251E 0%, #1E1A15 56%, #14110D 100%)', arc: 'rgba(210,181,118,0.30)', border: 'transparent' },
  regular: { bg: 'linear-gradient(150deg, #322A20 0%, #241E17 56%, #17130E 100%)', arc: 'rgba(210,181,118,0.40)', border: 'rgba(210,181,118,0.16)' },
  family: { bg: 'linear-gradient(150deg, #3A2F1F 0%, #2A2216 56%, #1A150D 100%)', arc: 'rgba(216,185,112,0.52)', border: 'rgba(214,183,110,0.30)' },
  ambassador: { bg: 'linear-gradient(150deg, #4A3A21 0%, #332714 56%, #1F1708 100%)', arc: 'rgba(226,196,120,0.64)', border: 'rgba(224,193,118,0.5)' },
};

export function QuarterCard({
  memberName,
  plan = 'Citizen',
  cardId = '0042',
  sinceLabel = 'Member since 2025',
  level = 'newbie',
  points,
  rewards,
  logoSrc,
  qr = true,
  style,
}: QuarterCardProps) {
  const skin = LEVEL_STYLE[level] ?? LEVEL_STYLE.newbie;
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
        background: skin.bg,
        border: `1px solid ${skin.border}`,
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
          background: `radial-gradient(circle at 30% 70%, ${skin.arc}, rgba(190,155,83,0.04) 70%)`,
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
            Quarter Card · {LEVEL_NAME[level]}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, fontSize: 'var(--text-xs)', color: 'rgba(251,248,242,0.62)' }}>
            <span>No. {cardId}</span>
            {typeof points === 'number' ? <span style={{ color: 'var(--gold-300)', fontWeight: 600 }}>{points.toLocaleString('en-GB')} pts</span> : null}
            {typeof rewards === 'number' && rewards > 0 ? (
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(210,181,118,0.16)',
                  border: '1px solid var(--gold-500)',
                  color: 'var(--gold-300)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {rewards} to redeem
              </span>
            ) : null}
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
