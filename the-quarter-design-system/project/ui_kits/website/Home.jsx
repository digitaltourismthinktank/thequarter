/* The Quarter — Homepage. */
const { Button, Badge, SpaceCard, PlanCard, RoomCard, Icon } = window.TheQuarterDesignSystem_2f2064;
const { Eyebrow, Section, SectionHead, Photo, IncludedStrip } = window.QSections;

function Home({ go }) {
  const D = window.QData;
  return (
    <div>
      {/* HERO */}
      <section style={{ position: 'relative', minHeight: 660, display: 'flex', alignItems: 'flex-end', padding: '0 32px 72px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${D.PHOTOS.hero})`, backgroundSize: 'cover', backgroundPosition: 'center 38%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,17,13,0.52) 0%, rgba(20,17,13,0.18) 36%, rgba(20,17,13,0.78) 100%)' }} />
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ maxWidth: 720 }}>
            <Badge tone="gold" icon="map-pin">Canterbury · Cathedral Quarter</Badge>
            <h1 style={{ fontSize: 'clamp(44px, 7vw, 84px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 0.98, color: 'var(--sand-50)', margin: '18px 0 0' }}>
              So much more<br />than a workspace
            </h1>
            <p style={{ fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.55, color: 'rgba(251,248,242,0.88)', marginTop: 22, maxWidth: 560 }}>
              A boutique coworking home above Canterbury's Cathedral Quarter. Come for the warmth, the natural light and the breakfast — find your focus, and an escape from home.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 32 }}>
              <Button size="lg" variant="accent" iconAfter="arrow-right" onClick={() => go('#/daypass')}>Book a Day Pass · £21.60</Button>
              <Button size="lg" variant="inverse" onClick={() => go('#/spaces')}>See the spaces</Button>
            </div>
          </div>
        </div>
      </section>

      {/* INCLUDED */}
      <Section bg="var(--surface-card)" pad="64px 32px">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ maxWidth: 440 }}>
            <Eyebrow>Every desk plan includes</Eyebrow>
            <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 12 }}>The good things, as standard</h2>
          </div>
          <p style={{ maxWidth: 420, fontSize: 16, lineHeight: 1.6, color: 'var(--text-body)' }}>
            No tiers of small print. Whatever plan you choose, the essentials — and the lovely bits — come included.
          </p>
        </div>
        <IncludedStrip items={D.INCLUDED} />
      </Section>

      {/* SPACES */}
      <Section>
        <SectionHead eyebrow="The Spaces" title="Room to think, room to gather"
          intro="From open desks in the light to private rooms for the meetings that matter — and a café with the cathedral view." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {D.SPACES.map(s => (
            <SpaceCard key={s.name} name={s.name} tag={s.tag} blurb={s.blurb} imageSrc={s.img} imageCaption={s.caption} meta={s.meta} onOpen={() => go('#/spaces')} />
          ))}
        </div>
      </Section>

      {/* MEETING ROOMS — revenue lever */}
      <Section bg="var(--ink-900)">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)', gap: 56, alignItems: 'center' }}>
          <div>
            <SectionHead dark eyebrow="Meeting rooms" title="The room that makes the meeting"
              intro="Two high-spec rooms and a hybrid-ready boardroom, with plug-and-play A/V and catering on request. Check this week's availability and reserve in a couple of taps." max={520} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Button size="lg" variant="accent" iconAfter="arrow-right" onClick={() => go('#/rooms')}>Check availability</Button>
              <Button size="lg" variant="inverse" onClick={() => go('#/rooms')}>See the rooms</Button>
            </div>
          </div>
          <RoomCard {...roomProps(D.ROOMS[0])} onReserve={() => go('#/rooms')} />
        </div>
      </Section>

      {/* PLANS */}
      <Section>
        <SectionHead align="center" eyebrow="Plans & pricing" title="Find the plan that fits your week"
          intro="Prices include VAT. Start with a Day Pass — no commitment, just a desk and a really good morning." max={620} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 22, alignItems: 'stretch' }}>
          {D.PLANS.slice(0, 4).map(p => (
            <PlanCard key={p.name} {...p} ctaLabel={p.name === 'Day Pass' ? 'Book a Day Pass' : 'Choose ' + p.name}
              onChoose={() => go(p.name === 'Day Pass' ? '#/daypass' : '#/plans')} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <Button variant="secondary" iconAfter="arrow-right" onClick={() => go('#/plans')}>See all plans, including Hybrid Office</Button>
        </div>
      </Section>

      {/* PLANTSPIRATION FEATURE */}
      <Section bg="var(--surface-card)">
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48, alignItems: 'center' }}>
          <Photo caption="Plantspiration — greenery, the café, people at a social" src={D.PHOTOS.mainSpaceWide} ratio="5 / 4" />
          <div>
            <Eyebrow>Plantspiration</Eyebrow>
            <h2 style={{ fontSize: 'clamp(28px,3.4vw,40px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.08, marginTop: 14 }}>
              Fresh, light and full of plants
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text-body)', marginTop: 16 }}>
              Renovated in 2025, The Quarter feels fresh and full of life. Greenery runs throughout, the light pours in, and the cathedral sits in the window of the café. It's the kind of place you actually want to spend your day.
            </p>
            <div style={{ display: 'flex', gap: 24, marginTop: 26 }}>
              {[['leaf', 'Plants throughout'], ['coffee', 'Daily breakfast & Lavazza'], ['users', 'A real community']].map(([ic, t]) => (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 130 }}>
                  <Icon name={ic} size={24} color="var(--gold-600)" />
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.3 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* CLOSING CTA */}
      <Section bg="var(--gold-100)" pad="96px 32px">
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.04 }}>Come and find your focus</h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--stone-700)', marginTop: 16 }}>
            Book a Day Pass and spend a morning with us. We think you'll want to stay.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <Button size="lg" variant="primary" iconAfter="arrow-right" onClick={() => go('#/daypass')}>Book a Day Pass</Button>
            <Button size="lg" variant="secondary" onClick={() => go('#/rooms')}>Enquire about a room</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function roomProps(r) {
  return { name: r.name, capacity: r.capacity, status: r.status, statusLabel: r.statusLabel, blurb: r.blurb, imageSrc: r.img, imageCaption: r.caption, features: r.features, priceNote: r.priceNote };
}

Object.assign(window, { QHome: Home, QRoomProps: roomProps });
