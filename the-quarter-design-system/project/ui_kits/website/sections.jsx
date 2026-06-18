/* The Quarter — website layout helpers (shared section primitives). */
const { Icon, Button } = window.TheQuarterDesignSystem_2f2064;

function Eyebrow({ children, style }) {
  return <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold-700)', ...style }}>{children}</span>;
}

function Section({ children, bg = 'var(--surface-page)', pad = '104px 32px', id, style }) {
  return (
    <section id={id} style={{ background: bg, padding: pad, ...style }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </section>
  );
}

function SectionHead({ eyebrow, title, intro, align = 'left', dark = false, max = 640 }) {
  return (
    <div style={{ textAlign: align, margin: align === 'center' ? '0 auto' : 0, maxWidth: max, marginBottom: 44 }}>
      {eyebrow ? <Eyebrow style={{ color: dark ? 'var(--gold-400)' : 'var(--gold-700)' }}>{eyebrow}</Eyebrow> : null}
      <h2 style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.06, marginTop: 14, color: dark ? 'var(--sand-50)' : 'var(--ink-900)' }}>{title}</h2>
      {intro ? <p style={{ fontSize: 18, lineHeight: 1.6, marginTop: 16, color: dark ? 'rgba(251,248,242,0.78)' : 'var(--text-body)' }}>{intro}</p> : null}
    </div>
  );
}

/* Art-directed photo block — real photography when `src` is given, else captioned placeholder. */
function Photo({ caption, src, dark = false, ratio = '4 / 3', radius = 'var(--radius-xl)', position = 'center', style, children }) {
  return (
    <div className={src ? '' : 'q-photo'} data-caption={src ? undefined : caption} data-dark={(!src && dark) ? '' : undefined}
      style={{ aspectRatio: ratio, borderRadius: radius, width: '100%',
        backgroundImage: src ? `url(${src})` : undefined, backgroundSize: 'cover', backgroundPosition: position,
        ...style }}>
      {children}
    </div>
  );
}

function IncludedStrip({ items, dark = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? 'rgba(251,248,242,0.08)' : 'var(--gold-100)' }}>
            <Icon name={it.icon} size={20} color={dark ? 'var(--gold-400)' : 'var(--gold-700)'} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 500, color: dark ? 'var(--sand-50)' : 'var(--text-strong)' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { QSections: { Eyebrow, Section, SectionHead, Photo, IncludedStrip } });
