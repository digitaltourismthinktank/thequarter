import { characterById, SKIN, LINE, type QuarterCharacter as Char } from '@/lib/characters';

/**
 * A Canterbury pilgrim, drawn as a flat vector badge.
 *
 * Everything shares one figure — circle ground, shoulders, head — and each pilgrim is told
 * apart by headwear and a single prop. That constraint is deliberate: these are shown at
 * 28px in the header and the who's-in pane, where only the silhouette survives, so a hat
 * that reads instantly beats a detailed face that turns to mush.
 *
 * Inline SVG rather than files: the Artifact/CSP rules aside, twenty small sprites as
 * separate requests would be twenty round-trips for something that renders on every screen.
 */

/** Headwear and props, drawn over the shared head. Keyed by character id. */
const FEATURES: Record<string, (c: Char) => JSX.Element> = {
  knight: (c) => (
    <>
      <path d="M20 26a12 12 0 0 1 24 0v3H20z" fill={c.accent} />
      <path d="M20 26a12 12 0 0 1 24 0v-2a12 12 0 0 0-24 0z" fill={c.robe} />
      <rect x="24" y="27" width="16" height="3" rx="1.5" fill={LINE} opacity=".55" />
      <path d="M32 8l3 6h-6z" fill={c.robe} />
    </>
  ),
  squire: (c) => (
    <>
      <path d="M20 27c0-8 5-12 12-12s12 4 12 12c0-5-4-6-6-4-2-3-5-2-6 0-2-2-6-2-7 1-2-1-5 0-5 3z" fill={c.robe} />
      <path d="M44 20c4-4 7-3 8-1-3 0-5 2-6 5z" fill={c.accent} />
    </>
  ),
  yeoman: (c) => (
    <>
      <path d="M18 28c0-9 6-14 14-14s14 5 14 14c-3-2-5-8-14-8s-11 6-14 8z" fill={c.accent} />
      <path d="M46 36l8-10M50 24l4 2-2 4" stroke={c.robe} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>
  ),
  prioress: (c) => (
    <>
      <path d="M17 34c0-11 6-19 15-19s15 8 15 19c0-6-3-9-6-9H23c-3 0-6 3-6 9z" fill={c.accent} />
      <path d="M17 34c0-11 6-19 15-19s15 8 15 19v-3c0-9-6-14-15-14s-15 5-15 14z" fill={c.robe} />
    </>
  ),
  'second-nun': (c) => (
    <>
      <path d="M18 33c0-10 6-18 14-18s14 8 14 18c0-6-3-9-6-9H24c-3 0-6 3-6 9z" fill={c.robe} />
      <path d="M22 24h20v3H22z" fill={c.accent} />
    </>
  ),
  monk: (c) => (
    <>
      <path d="M21 26c1-7 5-11 11-11s10 4 11 11c-2-4-5-5-11-5s-9 1-11 5z" fill={c.accent} />
      <path d="M16 44c2-6 6-8 6-8l4 4-5 6z" fill={c.accent} />
      <path d="M48 44c-2-6-6-8-6-8l-4 4 5 6z" fill={c.accent} />
    </>
  ),
  friar: (c) => (
    <>
      <path d="M18 32c0-11 6-18 14-18s14 7 14 18c-2-5-5-8-14-8s-12 3-14 8z" fill={c.accent} />
      <circle cx="32" cy="52" r="3.5" fill={c.robe} stroke={c.accent} strokeWidth="1.5" />
    </>
  ),
  merchant: (c) => (
    <>
      <rect x="18" y="10" width="28" height="9" rx="2" fill={c.accent} />
      <rect x="21" y="17" width="22" height="4" rx="1.5" fill={c.robe} />
      <path d="M27 38q2 8 5 3 3 5 5-3z" fill={LINE} opacity=".5" />
    </>
  ),
  clerk: (c) => (
    <>
      <rect x="19" y="14" width="26" height="4" rx="1.5" fill={c.accent} />
      <path d="M24 18h16v3H24z" fill={c.robe} />
      <rect x="40" y="44" width="14" height="11" rx="1.5" fill={c.accent} />
      <path d="M47 44v11" stroke={c.robe} strokeWidth="1.6" />
    </>
  ),
  lawyer: (c) => (
    <>
      <path d="M19 30c0-10 6-16 13-16s13 6 13 16c-2-5-5-7-13-7s-11 2-13 7z" fill={c.accent} />
      <rect x="42" y="43" width="12" height="4" rx="2" fill={c.accent} />
    </>
  ),
  franklin: (c) => (
    <>
      <path d="M20 20c2-5 6-7 12-7s10 2 12 7c-3-3-7-4-12-4s-9 1-12 4z" fill={c.accent} />
      <path d="M21 33q0 14 11 14t11-14q-4 6-11 6t-11-6z" fill={c.accent} />
    </>
  ),
  cook: (c) => (
    <>
      <path d="M21 20c-4 0-6-3-4-6 1-4 5-5 8-3 2-3 8-3 10 0 3-2 7-1 8 3 2 3 0 6-4 6z" fill={c.accent} />
      <rect x="21" y="19" width="22" height="4" rx="1.5" fill={c.robe} />
      <path d="M46 52v-9a4 4 0 1 1 8 0" stroke={c.accent} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  ),
  shipman: (c) => (
    <>
      <path d="M19 22c0-6 6-9 13-9s13 3 13 9z" fill={c.accent} />
      <rect x="18" y="21" width="28" height="4" rx="2" fill={c.robe} />
      <path d="M22 34q1 13 10 13t10-13q-4 5-10 5t-10-5z" fill={LINE} opacity=".45" />
    </>
  ),
  physician: (c) => (
    <>
      <path d="M18 31c0-11 6-17 14-17s14 6 14 17c-2-5-5-8-14-8s-12 3-14 8z" fill={c.accent} />
      <rect x="44" y="42" width="7" height="12" rx="2.5" fill={c.robe} />
      <rect x="45.5" y="46" width="4" height="7" rx="1.5" fill={c.accent} />
    </>
  ),
  'wife-of-bath': (c) => (
    <>
      <ellipse cx="32" cy="20" rx="21" ry="5.5" fill={c.accent} />
      <path d="M22 20c0-6 4-9 10-9s10 3 10 9z" fill={c.robe} />
      <circle cx="46" cy="18" r="3" fill={c.robe} />
    </>
  ),
  parson: (c) => (
    <>
      <path d="M19 32c0-11 6-18 13-18s13 7 13 18c-2-5-5-8-13-8s-11 3-13 8z" fill={c.accent} />
      <path d="M50 38v18" stroke={c.accent} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  plowman: (c) => (
    <>
      <ellipse cx="32" cy="21" rx="20" ry="5" fill={c.accent} />
      <path d="M23 21c0-6 4-9 9-9s9 3 9 9z" fill={c.robe} />
    </>
  ),
  miller: (c) => (
    <>
      <path d="M20 19c2-5 6-7 12-7s10 2 12 7c-3-3-7-4-12-4s-9 1-12 4z" fill={c.accent} />
      <path d="M20 32q0 17 12 17t12-17q-5 7-12 7t-12-7z" fill={c.accent} />
      <circle cx="48" cy="46" r="6" fill={c.accent} />
      <path d="M48 40V30" stroke={c.accent} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  manciple: (c) => (
    <>
      <path d="M20 22c0-6 5-9 12-9s12 3 12 9z" fill={c.accent} />
      <path d="M42 44h10l-2 11H44z" fill={c.accent} />
      <path d="M45 44v-2a2 2 0 0 1 4 0v2" stroke={c.robe} strokeWidth="1.6" fill="none" />
    </>
  ),
  host: (c) => (
    <>
      <path d="M20 20c2-5 6-8 12-8s10 3 12 8c-3-3-7-5-12-5s-9 2-12 5z" fill={c.accent} />
      <path d="M23 34q1 12 9 12t9-12q-4 4-9 4t-9-4z" fill={c.accent} />
      <rect x="43" y="42" width="10" height="13" rx="1.5" fill={c.accent} />
      <path d="M53 45h3v5h-3" stroke={c.accent} strokeWidth="2" fill="none" />
    </>
  ),
};

export function QuarterCharacter({ id, size = 40, className }: { id?: string | null; size?: number; className?: string }) {
  const c = characterById(id);
  if (!c) return null;
  const feature = FEATURES[c.id];

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={c.name}
      style={{ display: 'block', borderRadius: '50%' }}
    >
      <circle cx="32" cy="32" r="32" fill={c.bg} />
      {/* Shoulders, then head — drawn before the headwear so hats sit on top. */}
      <path d="M9 64c0-12 10-19 23-19s23 7 23 19z" fill={c.robe} />
      <circle cx="32" cy="28" r="12.5" fill={SKIN} />
      {feature ? feature(c) : null}
      {/* Eyes last, so a low hood can't bury them. */}
      <circle cx="28" cy="29" r="1.5" fill={LINE} />
      <circle cx="36" cy="29" r="1.5" fill={LINE} />
    </svg>
  );
}
