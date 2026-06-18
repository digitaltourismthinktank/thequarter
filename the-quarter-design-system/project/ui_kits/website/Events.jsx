/* The Quarter — Events. */
const { Badge, Button, Icon } = window.TheQuarterDesignSystem_2f2064;
const { Eyebrow, Section, SectionHead, Photo } = window.QSections;

const EVENTS = [
  { date: '20 Jun', day: 'Fri', title: 'Friday breakfast social', time: '08:30 – 10:00', kind: 'Community', blurb: 'Start the weekend early. Pastries, Lavazza and good company in the café.' },
  { date: '25 Jun', day: 'Wed', title: 'Plantspiration: repotting workshop', time: '17:30 – 19:00', kind: 'Workshop', blurb: 'Bring a tired plant or take one home. A hands-in-the-soil hour with our resident grower.' },
  { date: '02 Jul', day: 'Wed', title: 'Members\u2019 lunch & learn', time: '12:30 – 13:30', kind: 'Talk', blurb: 'A relaxed talk over lunch from a member doing something interesting. Lunch on us.' },
  { date: '11 Jul', day: 'Fri', title: 'Summer rooftop drinks', time: '18:00 – late', kind: 'Social', blurb: 'The cathedral, golden hour and a glass of something. Our favourite evening of the month.' },
];

function Events({ go }) {
  return (
    <div>
      <Section bg="var(--surface-card)" pad="64px 32px 48px">
        <div style={{ maxWidth: 680 }}>
          <Eyebrow>What\u2019s on</Eyebrow>
          <h1 style={{ fontSize: 'clamp(38px,5.5vw,60px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.02, margin: '14px 0 0' }}>Events at The Quarter</h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text-body)', marginTop: 16 }}>
            People stay for the community. Breakfasts, workshops, talks and the occasional rooftop drink — all part of being here.
          </p>
        </div>
      </Section>

      <Section pad="48px 32px 88px">
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 40, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {EVENTS.map(e => (
              <div key={e.title} style={{ display: 'flex', gap: 20, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px 22px', boxShadow: 'var(--shadow-card)' }}>
                <div style={{ flex: 'none', width: 64, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{e.day}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{e.date.split(' ')[0]}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.date.split(' ')[1]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <Badge tone="neutral" size="sm">{e.kind}</Badge>
                  <h3 style={{ fontSize: 19, fontWeight: 600, margin: '8px 0 4px' }}>{e.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-body)', lineHeight: 1.5 }}>{e.blurb}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}><Icon name="clock" size={14} color="var(--gold-600)" />{e.time}</div>
                </div>
                <div style={{ alignSelf: 'center' }}><Button size="sm" variant="secondary">RSVP</Button></div>
              </div>
            ))}
          </div>
          <div style={{ position: 'sticky', top: 24 }}>
            <Photo caption="A members\u2019 social \u2014 people, plants, golden hour" src="../../assets/photos/photo-1949.jpg" ratio="4 / 5" />
            <div style={{ background: 'var(--gold-100)', borderRadius: 'var(--radius-lg)', padding: '20px 22px', marginTop: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600 }}>Not a member yet?</h3>
              <p style={{ fontSize: 14, color: 'var(--stone-700)', lineHeight: 1.5, margin: '8px 0 16px' }}>Day Pass holders are welcome at most socials. Come and meet the place.</p>
              <Button variant="primary" fullWidth iconAfter="arrow-right" onClick={() => go('#/daypass')}>Book a Day Pass</Button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
Object.assign(window, { QEvents: Events });
