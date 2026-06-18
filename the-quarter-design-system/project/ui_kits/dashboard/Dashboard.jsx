/* The Quarter — member dashboard. Calm, premium product (not an admin panel). */
const {
  Button, IconButton, Badge, Avatar, Icon, Input, Switch, Select,
  StatTile, QuarterCard, AvailabilityCalendar, PerkCard, RoomCard, EmptyState,
} = window.TheQuarterDesignSystem_2f2064;

const LOGO = '../../assets/logo-wordmark-black.png';
const MEMBER = { name: 'Maya Holloway', first: 'Maya', plan: 'Resident', email: 'maya@studioholloway.co.uk' };

const ROOMS = [
  { name: 'The Board Room', capacity: '8–10', status: 'available', blurb: 'Hybrid-ready boardroom for the meetings that matter.', img: '../../assets/photos/photo-3937.jpg', caption: 'Board Room — long table, hybrid AV', features: [{ icon: 'monitor', label: 'Hybrid A/V' }], priceNote: 'Half & full-day' },
  { name: 'The Hop Yard', capacity: '6–8', status: 'soon', statusLabel: 'Free at 14:00', blurb: 'High-spec, warm and characterful. Made for focused work.', img: '../../assets/photos/photo-3937.jpg', caption: 'The Hop Yard — bright room, AV screen', features: [{ icon: 'wifi', label: 'Fibre' }], priceNote: 'Half & full-day' },
  { name: 'The Chapter House', capacity: '4–6', status: 'busy', blurb: 'Our most intimate high-spec room, with the cathedral in the window.', img: '../../assets/photos/photo-3939.jpg', caption: 'Chapter House — round table, cathedral view', features: [{ icon: 'leaf', label: 'Cathedral view' }], priceNote: 'Half & full-day' },
];
const WEEK_DAYS = [{ label: 'Mon', date: '16' }, { label: 'Tue', date: '17' }, { label: 'Wed', date: '18' }, { label: 'Thu', date: '19' }, { label: 'Fri', date: '20' }];
const WEEK_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
const WEEK_DATA = [
  ['available', 'busy', 'available', 'soon', 'available'],
  ['busy', 'available', 'available', 'busy', 'available'],
  ['available', 'available', 'busy', 'available', 'soon'],
  ['busy', 'busy', 'available', 'available', 'available'],
  ['available', 'soon', 'available', 'busy', 'available'],
  ['available', 'available', 'busy', 'available', 'busy'],
  ['available', 'busy', 'available', 'available', 'available'],
];
const PERKS = [
  { partner: 'The Pound Bar', category: 'Food & drink', perk: '20% off brunch, Monday to Friday', expires: 'Ends 30 Jun' },
  { partner: 'Curzon Canterbury', category: 'Culture', perk: '2-for-1 cinema tickets midweek', redeemed: true },
  { partner: 'The Goods Shed', category: 'Food & drink', perk: 'A free pastry with any coffee', expires: 'Ends 14 Jul' },
  { partner: 'Canterbury Cycles', category: 'Getting here', perk: '15% off servicing & rentals', expires: 'Always on' },
];

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'monitor' },
  { id: 'book', label: 'Book a room', icon: 'calendar' },
  { id: 'perks', label: 'Perks', icon: 'gift' },
  { id: 'account', label: 'Account', icon: 'settings' },
];

function Sidebar({ view, setView }) {
  return (
    <aside style={{ width: 252, flex: 'none', background: 'var(--ink-900)', color: 'var(--sand-50)', display: 'flex', flexDirection: 'column', padding: '24px 18px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 22px' }}>
        <img src="../../assets/app-icon.png" alt="The Quarter" style={{ width: 36, height: 36, borderRadius: 9 }} />
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>The Quarter</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV.map(n => {
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => setView(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: active ? 'rgba(251,248,242,0.1)' : 'transparent', color: active ? 'var(--sand-50)' : 'rgba(251,248,242,0.66)',
                fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: active ? 600 : 500, textAlign: 'left', transition: 'background var(--duration-fast)' }}>
              <Icon name={n.icon} size={19} color={active ? 'var(--gold-400)' : 'rgba(251,248,242,0.6)'} />{n.label}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop: '1px solid rgba(251,248,242,0.14)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar name={MEMBER.name} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{MEMBER.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(251,248,242,0.6)' }}>{MEMBER.plan}</div>
        </div>
        <a href="../website/index.html#/login" title="Sign out" style={{ display: 'flex' }}><Icon name="log-out" size={18} color="rgba(251,248,242,0.6)" /></a>
      </div>
    </aside>
  );
}

function Topbar({ title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</h1>
        {sub ? <p style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <IconButton icon="search" label="Search" variant="soft" />
        <IconButton icon="bell" label="Notifications" variant="soft" />
      </div>
    </div>
  );
}

function Overview({ setView }) {
  const [sel, setSel] = React.useState(null);
  return (
    <div>
      <Topbar title={`Morning, ${MEMBER.first}`} sub="Tuesday 17 June · the café is open and the coffee's on" />
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <StatTile label="Days remaining" value="6" unit="of 10" icon="calendar" progress={60} hint="Resets 1 July" />
            <StatTile label="Your plan" value="Resident" icon="user" tone="gold" hint="£138 · ten days" />
            <StatTile label="Perks redeemed" value="3" icon="gift" tone="ink" hint="This month" />
          </div>

          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '22px 24px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Upcoming</h3>
              <Button size="sm" variant="ghost" iconAfter="arrow-right" onClick={() => setView('book')}>Book another</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--sand-100)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ flex: 'none', width: 52, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold-700)', textTransform: 'uppercase' }}>Wed</div>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>18</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>The Hop Yard · 11:00–12:00</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Half day · catering added</div>
              </div>
              <Badge tone="available" dot>Confirmed</Badge>
            </div>
          </div>

          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '22px 24px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Book a room this week</h3>
              <Button size="sm" variant="ghost" iconAfter="arrow-right" onClick={() => setView('book')}>Full week</Button>
            </div>
            <AvailabilityCalendar roomName="The Board Room" days={WEEK_DAYS} slots={WEEK_SLOTS.slice(0, 5)} data={WEEK_DATA.slice(0, 5)}
              selectedKey={sel ? `${sel.dayIndex}-${sel.slotIndex}` : ''} onSelect={setSel} style={{ boxShadow: 'none', border: '1px solid var(--border-subtle)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <QuarterCard memberName={MEMBER.name} plan="Citizen" cardId="0042" logoSrc={LOGO} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" fullWidth icon="credit-card">Add to Apple Wallet</Button>
          </div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '20px 22px', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600 }}>Perks for you</h3>
              <Button size="sm" variant="ghost" onClick={() => setView('perks')}>All</Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PerkCard {...PERKS[0]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookView() {
  const [roomIdx, setRoomIdx] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [pkg, setPkg] = React.useState('Half day');
  const room = ROOMS[roomIdx];
  return (
    <div>
      <Topbar title="Book a room" sub="Live availability this week — tap a free slot to reserve" />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {ROOMS.map((r, i) => (
          <button key={r.name} onClick={() => { setRoomIdx(i); setSel(null); }}
            style={{ padding: '9px 16px', borderRadius: 999, border: '1.5px solid', borderColor: i === roomIdx ? 'var(--ink-900)' : 'var(--border-default)',
              background: i === roomIdx ? 'var(--ink-900)' : 'transparent', color: i === roomIdx ? 'var(--sand-50)' : 'var(--stone-600)',
              fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {r.name} <span style={{ opacity: 0.7 }}>· {r.capacity}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(280px,0.8fr)', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ width: '100%', aspectRatio: '21 / 9', borderRadius: 'var(--radius-xl)', backgroundImage: `url(${room.img})`, backgroundSize: 'cover', backgroundPosition: 'center 42%' }} />
          <AvailabilityCalendar roomName={room.name} days={WEEK_DAYS} slots={WEEK_SLOTS} data={WEEK_DATA}
            selectedKey={sel ? `${sel.dayIndex}-${sel.slotIndex}` : ''} onSelect={setSel} />
        </div>
        <aside style={{ position: 'sticky', top: 24, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '22px 24px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{room.name}</h3>
          <div style={{ background: sel ? 'var(--gold-100)' : 'var(--sand-100)', borderRadius: 'var(--radius-md)', padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'center' }}>
            <Icon name="calendar" size={19} color={sel ? 'var(--gold-700)' : 'var(--stone-500)'} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{sel ? `${sel.day.label} ${sel.day.date} · ${sel.slot}` : 'Pick a free slot'}</span>
          </div>
          <Select label="Package" options={['Half day', 'Full day']} value={pkg} onChange={(e) => setPkg(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-muted)' }}>
            <span>Comes off your plan</span><span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{pkg === 'Full day' ? '1 day' : '½ day'}</span>
          </div>
          <Button variant={sel ? 'accent' : 'primary'} fullWidth disabled={!sel} iconAfter="arrow-right">{sel ? 'Reserve slot' : 'Select a slot'}</Button>
        </aside>
      </div>
    </div>
  );
}

function PerksView() {
  const [perks, setPerks] = React.useState(PERKS);
  const redeem = (i) => setPerks(ps => ps.map((p, j) => j === i ? { ...p, redeemed: true, expires: undefined } : p));
  return (
    <div>
      <Topbar title="Perks" sub="Browse and redeem from your Quarter Card" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 18 }}>
        {perks.map((p, i) => <PerkCard key={p.partner} {...p} onRedeem={() => redeem(i)} />)}
      </div>
    </div>
  );
}

function AccountView() {
  return (
    <div>
      <Topbar title="Account" sub="Your details and how The Quarter reaches you" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 820, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px 26px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Your details</h3>
          <Input label="Full name" defaultValue={MEMBER.name} />
          <Input label="Email" type="email" icon="user" defaultValue={MEMBER.email} />
          <Input label="Company (for invoices)" defaultValue="Studio Holloway" />
          <div><Button variant="primary">Save changes</Button></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px 26px', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Notifications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Switch label="Members' socials & events" defaultChecked />
              <Switch label="Booking reminders" defaultChecked />
              <Switch label="New perks from partners" />
            </div>
          </div>
          <div style={{ background: 'var(--gold-100)', borderRadius: 'var(--radius-xl)', padding: '22px 24px' }}>
            <h3 style={{ fontSize: 17, fontWeight: 600 }}>On the Resident plan</h3>
            <p style={{ fontSize: 14, color: 'var(--stone-700)', lineHeight: 1.5, margin: '8px 0 16px' }}>Ten days a month, £138. Here most days? Citizen is unrestricted at £258.</p>
            <Button variant="primary" iconAfter="arrow-right">Upgrade to Citizen</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [view, setView] = React.useState('overview');
  const VIEWS = { overview: <Overview setView={setView} />, book: <BookView />, perks: <PerksView />, account: <AccountView /> };
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-page)' }}>
      <Sidebar view={view} setView={setView} />
      <main style={{ flex: 1, padding: '32px 40px 64px', minWidth: 0 }}>{VIEWS[view]}</main>
    </div>
  );
}

Object.assign(window, { QDashboard: Dashboard });
