/* The Quarter — Member login & onboarding entry. */
const { Button, Input, Icon, Badge } = window.TheQuarterDesignSystem_2f2064;

function Login({ go }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 73px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <Badge tone="gold">Welcome back</Badge>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', margin: '16px 0 8px' }}>Member login</h1>
          <p style={{ fontSize: 16, color: 'var(--text-body)', lineHeight: 1.55, marginBottom: 28 }}>Sign in to see your plan, book a room and redeem your perks.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="Email" type="email" icon="user" placeholder="you@company.com" defaultValue="maya@studioholloway.co.uk" />
            <Input label="Password" type="password" placeholder="••••••••" defaultValue="••••••••••" />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 13, color: 'var(--gold-700)', fontWeight: 600 }}>Forgotten password?</a>
            </div>
            <Button variant="primary" fullWidth iconAfter="arrow-right" onClick={() => { window.location.href = '../dashboard/index.html'; }}>Sign in</Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', fontSize: 13, margin: '4px 0' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} /> or <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-body)', textAlign: 'center' }}>
              New here? <a href="#/daypass" onClick={(e) => { e.preventDefault(); go('#/daypass'); }} style={{ color: 'var(--ink-900)', fontWeight: 600 }}>Book a Day Pass</a> to get started.
            </p>
          </div>
        </div>
      </div>
      <div style={{ backgroundImage: 'url(../../assets/photos/main-space-wide.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
    </div>
  );
}
Object.assign(window, { QLogin: Login });
