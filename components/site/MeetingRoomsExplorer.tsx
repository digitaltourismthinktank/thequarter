'use client';

import { useState, useEffect } from 'react';
import { AvailabilityCalendar, type AvailabilitySelection, type SlotStatus } from '@/components/ds/AvailabilityCalendar';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Select } from '@/components/ds/Select';
import { Checkbox } from '@/components/ds/Checkbox';
import { Icon } from '@/components/ds/Icon';
import { Photo } from '@/components/site/primitives';
import { MEETING_ROOMS } from '@/lib/rooms';
import { getWeeklyAvailability } from '@/lib/availability';
import { getSpaces, getAvailability } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import { cn } from '@/lib/cn';
import styles from './MeetingRoomsExplorer.module.css';

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
const normName = (s: string) => s.toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();

/** The next `n` weekdays (Mon–Fri) from today, with iso for fetching. */
function upcomingWeekdays(n = 5) {
  const out: { label: string; date: string; iso: string }[] = [];
  const d = new Date();
  while (out.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      out.push({
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: String(d.getDate()),
        iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* The Quarter — meeting-room availability explorer. Switch rooms, read this
   week's availability (fed by the lib/availability seam) and pick a slot; the
   rail summarises the request and points to the enquiry form to reserve.
   PHASE-2: wire "Reserve this slot" to live booking instead of the enquiry. */

export function MeetingRoomsExplorer() {
  const [roomIdx, setRoomIdx] = useState(0);
  const [selection, setSelection] = useState<AvailabilitySelection | null>(null);
  const [pkg, setPkg] = useState('Half day');
  const [catering, setCatering] = useState(true);

  const room = MEETING_ROOMS[roomIdx];
  const [week, setWeek] = useState(() => getWeeklyAvailability(MEETING_ROOMS[0].slug));
  const selectedKey = selection ? `${selection.dayIndex}-${selection.slotIndex}` : '';

  // Mirror the real backend: reseed instantly, then resolve this room to its Airtable
  // space, read this week's confirmed bookings per day, and paint busy vs available.
  useEffect(() => {
    setWeek(getWeeklyAvailability(room.slug));
    if (PREVIEW) return;
    let cancelled = false;
    (async () => {
      const spacesRes = await getSpaces();
      if (cancelled || !spacesRes.ok) return;
      const space = spacesRes.data.spaces.find((s) => normName(s.name) === normName(room.name));
      if (!space) return;
      const days = upcomingWeekdays(5);
      const perDay = await Promise.all(days.map((d) => getAvailability(space.id, d.iso)));
      if (cancelled) return;
      const data: SlotStatus[][] = SLOTS.map((slot) => {
        const sMin = Number(slot.slice(0, 2)) * 60;
        const eMin = sMin + 60;
        return days.map((_, di) => {
          const r = perDay[di];
          const busy = r.ok ? (r.data.busy || []).some((b) => sMin < b.endMin && eMin > b.startMin) : false;
          return busy ? 'busy' : 'available';
        });
      });
      setWeek({ weekLabel: 'This week', days: days.map((d) => ({ label: d.label, date: d.date })), slots: SLOTS, data });
    })();
    return () => {
      cancelled = true;
    };
  }, [roomIdx, room.slug, room.name]);

  return (
    <div>
      <div className={styles.switcher} role="tablist" aria-label="Choose a room">
        {MEETING_ROOMS.map((r, i) => (
          <button
            key={r.slug}
            type="button"
            role="tab"
            aria-selected={i === roomIdx}
            onClick={() => {
              setRoomIdx(i);
              setSelection(null);
            }}
            className={cn(styles.pill, i === roomIdx && styles.pillActive)}
          >
            {r.name}
            <span className={styles.pillCap}>· {r.capacity}</span>
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <div className={styles.calendarCol}>
          <Photo
            src={room.photo.src}
            alt={room.photo.alt}
            ratio="21 / 9"
            position="center 42%"
            sizes="(max-width: 940px) 100vw, 760px"
          />
          <AvailabilityCalendar
            roomName={room.name}
            days={week.days}
            slots={week.slots}
            data={week.data}
            selectedKey={selectedKey}
            onSelect={setSelection}
          />
        </div>

        <aside className={styles.rail}>
          <div>
            <div className={styles.railHead}>
              <h3 className={styles.railTitle}>{room.name}</h3>
              <Badge tone="neutral" icon="users" size="sm">
                {room.capacity}
              </Badge>
            </div>
            <p className={styles.railBlurb}>{room.blurb}</p>
          </div>

          <div className={styles.railFeatures}>
            {room.features.map((f, i) => (
              <span key={i} className={styles.railFeature}>
                <Icon name={f.icon} size={15} color="var(--gold-600)" />
                {f.label}
              </span>
            ))}
          </div>

          <div className={styles.divider} />

          <div className={cn(styles.slotBox, selection && styles.slotBoxActive)}>
            <Icon name="calendar" size={20} color={selection ? 'var(--gold-700)' : 'var(--stone-500)'} />
            <div>
              <div className={styles.slotMain}>
                {selection ? `${selection.day.label} ${selection.day.date ?? ''} · ${selection.slot}` : 'Pick a slot from the grid'}
              </div>
              <div className={styles.slotSub}>{selection ? 'Slot selected' : 'Free slots are clickable'}</div>
            </div>
          </div>

          <Select label="Package" options={['Half day', 'Full day']} value={pkg} onChange={(e) => setPkg(e.target.value)} />
          <Checkbox
            label="Add lunch"
            description="Baguettes & cake from The Sandwich Bar · £12 a head"
            checked={catering}
            onChange={() => setCatering((c) => !c)}
          />

          <div className={styles.totalRow}>
            <span>Room hire</span>
            <span className={styles.totalVal}>
              £{pkg === 'Half day' ? room.price.half : room.price.full}
              {catering ? ' + lunch' : ''} · inc. VAT
            </span>
          </div>

          <Button variant={selection ? 'accent' : 'primary'} fullWidth href="#enquire" iconAfter="arrow-right">
            {selection ? 'Enquire to reserve this slot' : 'Enquire to reserve'}
          </Button>
          <Button variant="secondary" fullWidth href="#enquire" icon="phone">
            Send an enquiry instead
          </Button>
        </aside>
      </div>
    </div>
  );
}
