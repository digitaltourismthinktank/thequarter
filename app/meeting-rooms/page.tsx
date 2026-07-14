import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, Photo } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { RoomCard } from '@/components/ds/RoomCard';
import { MeetingRoomsExplorer } from '@/components/site/MeetingRoomsExplorer';
import { EnquiryForm } from '@/components/site/EnquiryForm';
import { MEETING_ROOMS } from '@/lib/rooms';
import { PHOTOS } from '@/lib/media';
import styles from './meeting-rooms.module.css';

export const metadata: Metadata = {
  title: 'Meeting rooms',
  description:
    'Check this week’s availability and book one of two high-spec meeting rooms — including a hybrid-ready boardroom — in Canterbury’s Cathedral Quarter. Half-day and full-day packages, with a lunch add-on and a quiet-day discount.',
  alternates: { canonical: '/meeting-rooms' },
};

const ASSURANCES = [
  'Half-day and full-day packages — from £90 (The Chapter House), £144 (The Knight’s Tale), inc. VAT.',
  'Add lunch — baguettes and cake from The Sandwich Bar, £12 a head.',
  'Save 20% on room hire on our quieter days: Monday, Wednesday & Friday.',
];

export default function MeetingRoomsPage() {
  return (
    <>
      <Section tone="ink">
        <SectionHead
          dark
          eyebrow="Meeting rooms"
          title="Check availability & reserve"
          intro="Pick a room, find a free slot this week, and book in a couple of clicks — or send a note with your catering needs. Half-day and full-day packages, with a lunch add-on and a quiet-day discount."
          max={620}
        />
      </Section>

      <Section tone="page">
        <MeetingRoomsExplorer />
      </Section>

      <Section tone="card">
        <SectionHead eyebrow="The rooms" title="Two rooms, one warm standard" max={560} />
        <div className={styles.roomsGrid}>
          {MEETING_ROOMS.map((r) => (
            <RoomCard
              key={r.slug}
              name={r.name}
              blurb={r.blurb}
              capacity={r.capacity}
              features={r.features}
              status={r.status}
              statusLabel={r.statusLabel}
              priceNote={r.priceNote}
              imageSrc={r.photo.src}
              imageAlt={r.photo.alt}
              ctaLabel="View room"
              ctaHref={`/meeting-rooms/${r.slug}`}
            />
          ))}
        </div>
      </Section>

      <Section tone="page" id="enquire">
        <div className={styles.enquireGrid}>
          <div>
            <Eyebrow>Reserve or enquire</Eyebrow>
            <SectionHead title="Tell us what you need" max={420} />
            <p className={styles.enquireText}>
              Send us the room, a rough date and time, and anything that would make it perfect. We&rsquo;ll come back to
              confirm your booking.
            </p>
            <div className={styles.enquireList}>
              {ASSURANCES.map((a) => (
                <div key={a} className={styles.enquireItem}>
                  <Icon name="check" size={18} color="var(--gold-600)" strokeWidth={2.25} />
                  <span>{a}</span>
                </div>
              ))}
            </div>
            <figure style={{ margin: '24px 0 0' }}>
              <Photo src={PHOTOS.catering.src} alt={PHOTOS.catering.alt} ratio="16 / 9" sizes="(max-width: 900px) 100vw, 480px" />
              <figcaption style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--stone-700)' }}>
                Make it a hosted lunch — baguettes &amp; cake from The Sandwich Bar, £12 a head.
              </figcaption>
            </figure>
          </div>
          <EnquiryForm formName="room-enquiry" />
        </div>
      </Section>
    </>
  );
}
