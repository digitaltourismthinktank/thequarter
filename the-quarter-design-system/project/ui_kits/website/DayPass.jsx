/* The Quarter — Day Pass checkout. */
const { Button, Input, Select, Checkbox, Badge, Icon } = window.TheQuarterDesignSystem_2f2064;
const { Section } = window.QSections;

function DayPass({ go }) {
  const [done, setDone] = React.useState(false);
  const [breakfast, setBreakfast] = React.useState(true);
  const base = 21.60;
  const total = base; // breakfast included
  return (
    <Section bg="var(--surface-page)" pad="48px 32px 96px">
      <button onClick={() => go('#/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', color: 'var(--stone-600)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, marginBottom: 28, cursor: 'pointer' }}>
        <Icon name="arrow-left" size={16} /> Back
      </button>

      {done ? (
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', padding: '56px 40px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><Icon name="check" size={30} color="var(--gold-700)" strokeWidth={2.5} /></span>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }}>You're booked in</h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-body)', marginTop: 14 }}>
            We've sent your Day Pass to your inbox. Come up to the first floor, grab a coffee and a breakfast, and find your focus. See you soon.
          </p>
          <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => go('#/')}>Back to home</Button>
            <Button variant="secondary" iconAfter="arrow-right" onClick={() => go('#/perks')}>See member perks</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(320px,0.85fr)', gap: 40, alignItems: 'start', maxWidth: 1080, margin: '0 auto' }}>
          {/* Form */}
          <div>
            <Badge tone="gold" icon="map-pin">Cathedral Quarter, Canterbury</Badge>
            <h1 style={{ fontSize: 'clamp(32px,4vw,46px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.04, margin: '14px 0 8px' }}>Book your Day Pass</h1>
            <p style={{ fontSize: 17, color: 'var(--text-body)', lineHeight: 1.55, maxWidth: 480 }}>A full day with us — breakfast, Lavazza, fibre and the Flexi Rooms included. No commitment, just a really good day.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 30 }}>
              <Input label="First name" placeholder="Maya" />
              <Input label="Last name" placeholder="Holloway" />
              <Input label="Email" type="email" icon="user" placeholder="you@company.com" style={{ gridColumn: '1 / -1' }} />
              <Select label="Which day?" options={['Tomorrow · Tue 17 Jun', 'Wed 18 Jun', 'Thu 19 Jun', 'Fri 20 Jun', 'Pick another date']} style={{ gridColumn: '1 / -1' }} />
            </div>

            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
              <Checkbox label="Daily healthy breakfast" description="Included — let us know you're coming" checked={breakfast} onChange={() => setBreakfast(b => !b)} />
              <Checkbox label="Email me about members' socials" />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 30, marginBottom: 14 }}>Payment</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <Input label="Card number" icon="credit-card" placeholder="1234 5678 9012 3456" style={{ gridColumn: '1 / -1' }} />
              <Input label="Expiry" placeholder="MM / YY" />
              <Input label="CVC" placeholder="123" />
            </div>
          </div>

          {/* Summary */}
          <aside style={{ position: 'sticky', top: 24, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px 24px 26px', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Your order</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 10 }}>
              <span style={{ color: 'var(--text-strong)', fontWeight: 500 }}>Day Pass</span><span style={{ fontWeight: 600 }}>£21.60</span>
            </div>
            {[['Daily breakfast', breakfast], ['Lavazza & premium drinks', true], ['Fibre & ergonomic desk', true], ['Flexi Rooms access', true]].map(([t, on]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: on ? 'var(--text-body)' : 'var(--stone-400)', marginBottom: 8 }}>
                <Icon name="check" size={15} color={on ? 'var(--gold-600)' : 'var(--stone-300)'} strokeWidth={2.25} />{t}<span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>Included</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>£{total.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Includes VAT. One day, all in.</p>
            <Button variant="accent" fullWidth iconAfter="arrow-right" onClick={() => setDone(true)}>Confirm & pay £21.60</Button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>You'll get your pass by email straight away.</p>
          </aside>
        </div>
      )}
    </Section>
  );
}
Object.assign(window, { QDayPass: DayPass });
