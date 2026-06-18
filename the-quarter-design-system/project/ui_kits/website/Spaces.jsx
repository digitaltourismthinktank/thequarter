/* The Quarter — The Spaces overview. */
const { SpaceCard, RoomCard, Badge, Button, Icon } = window.TheQuarterDesignSystem_2f2064;
const { Eyebrow, Section, SectionHead, Photo, IncludedStrip } = window.QSections;

function Spaces({ go }) {
  const D = window.QData;
  return (
    <div>
      <Section bg="var(--ink-900)" pad="64px 32px 72px">
        <div style={{ maxWidth: 720 }}>
          <Badge tone="gold" icon="leaf">Fresh, light, full of plants</Badge>
          <h1 style={{ fontSize: 'clamp(38px,5.5vw,64px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--sand-50)', margin: '18px 0 0' }}>The Spaces</h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'rgba(251,248,242,0.82)', marginTop: 18, maxWidth: 560 }}>
            Open desks, private breakout rooms, high-spec meeting rooms and a café with the cathedral view. Every corner renovated in 2025 and made to feel like home.
          </p>
        </div>
      </Section>

      <Section pad="72px 32px 40px">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24 }}>
          {D.SPACES.map(s => <SpaceCard key={s.name} name={s.name} tag={s.tag} blurb={s.blurb} imageSrc={s.img} imageCaption={s.caption} meta={s.meta} onOpen={() => {}} />)}
        </div>
      </Section>

      {/* Café feature */}
      <Section bg="var(--surface-card)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <Eyebrow>The Quarter Café</Eyebrow>
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,40px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, marginTop: 14 }}>The cathedral view, and the breakfast</h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text-body)', marginTop: 16 }}>
              Our café is an open social space — not bookable, just ours to share. It's where the day starts with a daily healthy breakfast and Lavazza coffee, and where the community happens. The cathedral sits right there in the window.
            </p>
            <div style={{ marginTop: 24 }}><Button variant="secondary" iconAfter="arrow-right" onClick={() => go('#/daypass')}>Spend a morning with us</Button></div>
          </div>
          <Photo caption="Café — cathedral view, breakfast, plants, warm light" src={D.PHOTOS.catering} ratio="5 / 4" />
        </div>
      </Section>

      {/* Meeting rooms list */}
      <Section>
        <SectionHead eyebrow="Meeting rooms" title="Rooms for the meetings that matter"
          intro="Two high-spec rooms and a hybrid-ready boardroom — half-day and full-day packages with catering." max={560} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {D.ROOMS.map(r => <RoomCard key={r.name} {...window.QRoomProps(r)} layout="horizontal" ctaLabel="Check availability" onReserve={() => go('#/rooms')} />)}
        </div>
      </Section>

      <Section bg="var(--surface-card)" pad="64px 32px 96px">
        <Eyebrow>Included with every desk plan</Eyebrow>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', margin: '12px 0 32px' }}>The good things, as standard</h2>
        <IncludedStrip items={D.INCLUDED} />
      </Section>
    </div>
  );
}
Object.assign(window, { QSpaces: Spaces });
