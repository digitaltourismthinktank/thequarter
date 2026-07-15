import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section, SectionHead, Eyebrow, Photo } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { RoomBooking } from '@/components/site/RoomBooking';
import { TalkToUs } from '@/components/site/TalkToUs';
import { ROOM_SLUGS, getMeetingRoom } from '@/lib/rooms';
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

export default function RoomDetailPage({ params }: RoomParams) {
  const room = getMeetingRoom(params.room);
  if (!room) notFound();

  return (
    <>
      {/* Header */}
      <Section tone="ink">
        <a href="/meeting-rooms" className={styles.back}>
          <Icon name="arrow-left" size={16} /> All meeting rooms
        </a>
        <h1 className={styles.h1}>{room.name}</h1>
        <div className={styles.badges}>
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

      {/* Book & pay online — instant, in-site */}
      <Section tone="page" id="book">
        <SectionHead
          eyebrow="Book & pay online"
          title={`Reserve ${room.name}`}
          intro="Pick your date and time, add lunch if you’d like it, and pay securely by card or Apple Pay — bookable 09:00–17:30, Monday to Friday. The quiet-day rate (20% off hire on Mon, Wed & Fri) is applied automatically."
          max={620}
        />
        <RoomBooking roomName={room.name} price={room.price} />
      </Section>

      {/* Questions → chat (no enquiry-and-wait; booking is instant above) */}
      <Section tone="card" id="enquire">
        <div className={styles.enquireWrap}>
          <SectionHead
            align="center"
            eyebrow="Here to help"
            title="Have questions? Chat to us now"
            intro="Need a time outside 09:00–17:30, a larger catering order, or a hand with the A/V? Message the team and we’ll sort it — no waiting on an email."
            max={620}
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TalkToUs variant="solid" label="Chat to us now" prefill={`I’ve got a question about the ${room.name}: `} />
          </div>
        </div>
      </Section>
    </>
  );
}
