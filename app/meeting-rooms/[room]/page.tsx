import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section, SectionHead, Eyebrow, Photo } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { AvailabilityCalendar } from '@/components/ds/AvailabilityCalendar';
import { EnquiryForm } from '@/components/site/EnquiryForm';
import { RoomBooking } from '@/components/site/RoomBooking';
import { MEETING_ROOMS, ROOM_SLUGS, getMeetingRoom } from '@/lib/rooms';
import { getWeeklyAvailability } from '@/lib/availability';
import styles from './room.module.css';

interface RoomParams {
  params: { room: string };
}

export function generateStaticParams() {
  return ROOM_SLUGS.map((room) => ({ room }));
}

export function generateMetadata({ params }: RoomParams): Metadata {
  const room = getMeetingRoom(params.room);
  if (!room) return {};
  return {
    title: room.name,
    description: `${room.blurb} ${room.priceNote} in Canterbury’s Cathedral Quarter.`,
    alternates: { canonical: `/meeting-rooms/${room.slug}` },
  };
}

const STATUS_TEXT: Record<string, string> = {
  available: 'Available now',
  busy: 'In use',
  soon: 'Free soon',
};

export default function RoomDetailPage({ params }: RoomParams) {
  const room = getMeetingRoom(params.room);
  if (!room) notFound();

  const week = getWeeklyAvailability(room.slug);
  const statusText = room.statusLabel ?? STATUS_TEXT[room.status];

  return (
    <>
      {/* Header */}
      <Section tone="ink">
        <a href="/meeting-rooms" className={styles.back}>
          <Icon name="arrow-left" size={16} /> All meeting rooms
        </a>
        <h1 className={styles.h1}>{room.name}</h1>
        <div className={styles.badges}>
          <Badge tone={room.status} dot>
            {statusText}
          </Badge>
          <Badge tone="gold" icon="users">
            Seats {room.capacity}
          </Badge>
        </div>
        <p className={styles.lead}>{room.blurb}</p>
      </Section>

      {/* Photo + specs */}
      <Section tone="page">
        <div className={styles.detailGrid}>
          <Photo src={room.photo.src} alt={room.photo.alt} ratio="4 / 3" sizes="(max-width: 900px) 100vw, 620px" priority />
          <div>
            <Eyebrow>The room</Eyebrow>
            <h2 className={styles.detailTitle}>{room.name}</h2>
            <p className={styles.detailText}>{room.description}</p>
            <div className={styles.features}>
              {room.features.map((f, i) => (
                <span key={i} className={styles.feature}>
                  <Icon name={f.icon} size={16} color="var(--gold-600)" />
                  {f.label}
                </span>
              ))}
            </div>
            <ul className={styles.specs}>
              {room.specs.map((s) => (
                <li key={s.label} className={styles.specRow}>
                  <span className={styles.specLabel}>{s.label}</span>
                  <span className={styles.specVal}>{s.value}</span>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <Button variant="accent" href="#book" iconAfter="arrow-right">
                Book &amp; pay online
              </Button>
              <span className={styles.feature}>
                <Icon name="credit-card" size={16} color="var(--gold-600)" />
                {room.priceNote}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* Book & pay online */}
      <Section tone="page" id="book">
        <SectionHead
          eyebrow="Book & pay online"
          title={`Reserve ${room.name}`}
          intro="Choose your date and package, add lunch if you’d like it, and pay securely by card or Apple Pay. Quiet-day rate (20% off hire on Mon, Wed & Fri) is applied automatically."
          max={620}
        />
        <RoomBooking roomName={room.name} price={room.price} />
      </Section>

      {/* This week's availability */}
      <Section tone="card">
        <SectionHead
          eyebrow="This week"
          title="When the room is free"
          intro="A live-style view of this week. Spot a slot you like, then enquire below to reserve it."
          max={560}
        />
        <AvailabilityCalendar roomName={room.name} days={week.days} slots={week.slots} data={week.data} />
      </Section>

      {/* Enquiry */}
      <Section tone="page" id="enquire">
        <div className={styles.enquireWrap}>
          <SectionHead
            align="center"
            eyebrow="Reserve or enquire"
            title={`Enquire about ${room.name}`}
            intro="Send your preferred date and time and any catering or A/V needs — we’ll confirm and quote within a working day."
            max={620}
          />
          <EnquiryForm formName="room-enquiry" defaultRoom={room.name} />
        </div>
      </Section>
    </>
  );
}
