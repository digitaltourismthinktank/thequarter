/* The Quarter — Plans & pricing. */
const { PlanCard, Button, Badge, Icon } = window.TheQuarterDesignSystem_2f2064;
const { Eyebrow, Section, SectionHead, IncludedStrip } = window.QSections;

function Plans({ go }) {
  const D = window.QData;
  return (
    <div>
      <Section pad="64px 32px 8px">
        <SectionHead align="center" eyebrow="Plans & pricing" title="Find the plan that fits your week"
          intro="All prices include VAT. Every desk plan comes with fibre, ergonomic desks, plug-and-play A/V, a daily healthy breakfast, Lavazza coffee and access to the Flexi Rooms. Start with a Day Pass — the public way in." max={680} />
      </Section>

      <Section pad="24px 32px 56px">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(232px,1fr))', gap: 20, alignItems: 'stretch' }}>
          {D.PLANS.map(p => (
            <PlanCard key={p.name} {...p}
              ctaLabel={p.name === 'Day Pass' ? 'Book a Day Pass' : 'Choose ' + p.name}
              onChoose={() => go(p.name === 'Day Pass' ? '#/daypass' : '#/daypass')} />
          ))}
        </div>
      </Section>

      <Section bg="var(--surface-card)" pad="64px 32px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div>
            <Eyebrow>What's always included</Eyebrow>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', margin: '12px 0 22px' }}>No tiers of small print</h2>
            <IncludedStrip items={D.INCLUDED} />
          </div>
          <div style={{ background: 'var(--ink-900)', borderRadius: 'var(--radius-xl)', padding: '34px 32px', color: 'var(--sand-50)' }}>
            <Badge tone="gold">For teams</Badge>
            <h3 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--sand-50)', margin: '16px 0 12px' }}>Need a room, not a desk?</h3>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(251,248,242,0.78)' }}>
              Our meeting rooms are quoted on enquiry, around half-day and full-day packages with catering. Check live availability and reserve, or send us a note.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <Button variant="accent" iconAfter="arrow-right" onClick={() => go('#/rooms')}>Meeting rooms</Button>
              <Button variant="inverse" icon="phone">Enquire</Button>
            </div>
          </div>
        </div>
      </Section>

      <Section pad="64px 32px 96px">
        <SectionHead align="center" title="Questions, answered" max={560} />
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            ['Can I just try it for a day?', 'Yes — the Day Pass at £21.60 is our public way in. A full day with breakfast, coffee and the Flexi Rooms included.'],
            ['Do days roll over?', 'Visitor and Resident days are used within the month. Citizen is unrestricted, so there is nothing to count.'],
            ['What is the Hybrid Office?', 'A Canterbury mailing address plus twelve days a year in the space — for those who work from home but want a base in town.'],
            ['How does meeting-room pricing work?', 'Quoted on enquiry, around half-day and full-day packages. Add catering — Lavazza, pastries and a healthy lunch — when you reserve.'],
          ].map(([q, a]) => (
            <details key={q} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '18px 4px' }}>
              <summary style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink-900)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {q}<Icon name="chevron-down" size={18} color="var(--stone-500)" />
              </summary>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-body)', marginTop: 10 }}>{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}
Object.assign(window, { QPlans: Plans });
