import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { RoomCard } from '@/components/ds/RoomCard';
import { MeetingRoomsExplorer } from '@/components/site/MeetingRoomsExplorer';
import { EnquiryForm } from '@/components/site/EnquiryForm';
import { MEETING_ROOMS } from '@/lib/rooms';
import styles from './meeting-rooms.module.css';

export const metadata: Metadata = {
  title: 'Meeting rooms',
  description:
    'Check this week’s availability and reserve a hybrid-ready boardroom or one of two high-spec meeting rooms in Canterbury’s Cathedral Quarter. Half-day and full-day packages with catering.',
  alternates: { canonical: '/meeting-rooms' },
};

const ASSURANCES = [
  'Pricing is quoted on enquiry, around half-day and full-day packages.',
  'Add catering — Lavazza, pastries and a healthy lunch platter.',
  'We reply within one working day to confirm your slot.',
];

export default function MeetingRoomsPage() {
  return (
    <>
      <Section tone="ink">
        <SectionHead
          dark
          eyebrow="Meeting rooms"
          title="Check availability & reserve"
          intro="Pick a room, find a free slot this week, and enquire to reserve in a couple of taps — or send a note with your catering needs. Pricing is quoted on enquiry, around half-day and full-day packages."
          max={620}
        />
      </Section>

      <Section tone="page">
        <MeetingRoomsExplorer />
      </Section>

      <Section tone="card">
        <SectionHead eyebrow="The rooms" title="Three rooms, one warm standard" max={560} />
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
              confirm and quote.
            </p>
            <div className={styles.enquireList}>
              {ASSURANCES.map((a) => (
                <div key={a} className={styles.enquireItem}>
                  <Icon name="check" size={18} color="var(--gold-600)" strokeWidth={2.25} />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </div>
          <EnquiryForm formName="room-enquiry" />
        </div>
      </Section>
    </>
  );
}
