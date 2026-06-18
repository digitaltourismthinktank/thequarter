/* The Quarter — Perks. */
const { PerkCard, Badge, Button } = window.TheQuarterDesignSystem_2f2064;
const { Eyebrow, Section, SectionHead } = window.QSections;

function Perks({ go }) {
  const D = window.QData;
  const cats = ['All', ...Array.from(new Set(D.PERKS.map(p => p.category)))];
  const [cat, setCat] = React.useState('All');
  const list = cat === 'All' ? D.PERKS : D.PERKS.filter(p => p.category === cat);
  return (
    <div>
      <Section bg="var(--gold-100)" pad="64px 32px 56px">
        <div style={{ maxWidth: 680 }}>
          <Eyebrow>Member perks</Eyebrow>
          <h1 style={{ fontSize: 'clamp(38px,5.5vw,60px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.02, margin: '14px 0 0' }}>Good things, around the corner</h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--stone-700)', marginTop: 16 }}>
            Being a member opens doors across the Cathedral Quarter — food, coffee, culture and the little favours that make a neighbourhood feel like yours. Browse and redeem from your Quarter Card.
          </p>
        </div>
      </Section>

      <Section pad="48px 32px 96px">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{
                padding: '9px 17px', borderRadius: 999, border: '1.5px solid',
                borderColor: c === cat ? 'var(--ink-900)' : 'var(--border-default)',
                background: c === cat ? 'var(--ink-900)' : 'transparent',
                color: c === cat ? 'var(--sand-50)' : 'var(--stone-600)',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 20 }}>
          {list.map(p => <PerkCard key={p.partner} {...p} />)}
        </div>
      </Section>

      <Section bg="var(--ink-900)" pad="72px 32px 88px">
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--sand-50)' }}>Perks live on your Quarter Card</h2>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(251,248,242,0.78)', marginTop: 14 }}>
            Members carry the Quarter Card in Apple Wallet. Tap to browse partner perks and redeem them in a moment.
          </p>
          <div style={{ marginTop: 26 }}><Button size="lg" variant="accent" iconAfter="arrow-right" onClick={() => go('#/daypass')}>Become a member</Button></div>
        </div>
      </Section>
    </div>
  );
}
Object.assign(window, { QPerks: Perks });
