/* The Quarter — Meeting rooms: weekly availability + reservation. The revenue lever. */
const { Button, Badge, RoomCard, AvailabilityCalendar, Select, Checkbox, Icon } = window.TheQuarterDesignSystem_2f2064;
const { Eyebrow, Section, SectionHead, Photo } = window.QSections;

function MeetingRooms({ go }) {
  const D = window.QData;
  const [roomIdx, setRoomIdx] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [pkg, setPkg] = React.useState('Half day');
  const [catering, setCatering] = React.useState(true);
  const room = D.ROOMS[roomIdx];

  return (
    <div>
      {/* Header */}
      <Section bg="var(--ink-900)" pad="56px 32px 64px">
        <SectionHead dark eyebrow="Meeting rooms" title="Check availability & reserve"
          intro="Pick a room, find a free slot this week, and reserve in a couple of taps — or send an enquiry with your catering needs. Pricing is quoted on enquiry, around half-day and full-day packages." max={620} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {D.ROOMS.map((r, i) => (
            <button key={r.name} onClick={() => { setRoomIdx(i); setSel(null); }}
              style={{
                padding: '10px 18px', borderRadius: 999, border: '1.5px solid',
                borderColor: i === roomIdx ? 'var(--gold-500)' : 'rgba(251,248,242,0.22)',
                background: i === roomIdx ? 'var(--gold-500)' : 'transparent',
                color: i === roomIdx ? 'var(--ink-900)' : 'var(--sand-50)',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
              {r.name}<span style={{ opacity: 0.7, fontWeight: 500 }}>· {r.capacity}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Calendar + booking panel */}
      <Section pad="56px 32px 40px">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(300px,0.9fr)', gap: 28, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Photo caption={room.caption} src={room.img} position="center 42%" ratio="21 / 9" radius="var(--radius-xl)" />
            <AvailabilityCalendar roomName={room.name} days={D.WEEK_DAYS} slots={D.WEEK_SLOTS} data={D.WEEK_DATA}
              selectedKey={sel ? `${sel.dayIndex}-${sel.slotIndex}` : ''} onSelect={setSel} />
          </div>

          {/* Reservation rail */}
          <aside style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 18, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px 24px 26px', boxShadow: 'var(--shadow-card)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{room.name}</h3>
                <Badge tone="neutral" icon="users" size="sm">{room.capacity}</Badge>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-body)', marginTop: 8, lineHeight: 1.5 }}>{room.blurb}</p>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {room.features.map((f, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                  <Icon name={f.icon} size={15} color="var(--gold-600)" />{f.label}
                </span>
              ))}
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)' }} />

            <div style={{ background: sel ? 'var(--gold-100)' : 'var(--sand-100)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name="calendar" size={20} color={sel ? 'var(--gold-700)' : 'var(--stone-500)'} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                  {sel ? `${sel.day.label} ${sel.day.date} · ${sel.slot}` : 'Pick a slot from the grid'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sel ? 'Slot selected' : 'Free slots are tappable'}</div>
              </div>
            </div>

            <Select label="Package" options={['Half day', 'Full day']} value={pkg} onChange={(e) => setPkg(e.target.value)} />
            <Checkbox label="Add catering" description="Lavazza, pastries & a healthy lunch platter" checked={catering} onChange={() => setCatering(c => !c)} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
              <span>Total</span><span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Quoted on enquiry</span>
            </div>

            <Button variant={sel ? 'accent' : 'primary'} fullWidth disabled={!sel} iconAfter="arrow-right">
              {sel ? 'Reserve this slot' : 'Select a slot to reserve'}
            </Button>
            <Button variant="secondary" fullWidth icon="phone">Send an enquiry instead</Button>
          </aside>
        </div>
      </Section>

      {/* All rooms */}
      <Section pad="20px 32px 96px">
        <SectionHead eyebrow="The rooms" title="Three rooms, one warm standard" max={560} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24 }}>
          {D.ROOMS.map((r, i) => (
            <RoomCard key={r.name} {...window.QRoomProps(r)} ctaLabel="Select room" onReserve={() => { setRoomIdx(i); setSel(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          ))}
        </div>
      </Section>
    </div>
  );
}

Object.assign(window, { QMeetingRooms: MeetingRooms });
