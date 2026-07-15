import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, Photo } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { RoomCard } from '@/components/ds/RoomCard';
import { MeetingRoomsExplorer } from '@/components/site/MeetingRoomsExplorer';
import { RoomRefreshments } from '@/components/site/RoomRefreshments';
import { TalkToUs } from '@/components/site/TalkToUs';
import { MEETING_ROOMS } from '@/lib/rooms';
import { Breadcrumbs } from '@/components/site/Breadcrumbs';
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
          intro="Pick a room, choose your time, and pay securely online — bookable 09:00–17:30, Monday to Friday. Half-day and full-day packages, with a lunch add-on and a quiet-day discount."
          max={620}
        />
      </Section>

      <Section tone="page">
        <MeetingRoomsExplorer />
      </Section>

      <Section tone="card">
        <SectionHead
          eyebrow="While you’re here"
          title="Fully inclusive meetings"
          intro="Every room booking comes with tea, coffee, pastries and yoghurts. Add a proper lunch from The Sandwich Bar for £12 a head."
          max={620}
        />
        <RoomRefreshments />
      </Section>

      <Section tone="sunken">
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

      <Section tone="gold">
        <SectionHead
          align="center"
          eyebrow="For teams"
          title="A regular base for your team?"
          intro="Looking for a regular workspace for your team? Privatise one of our open workspaces — The Hop Yard or The Vineyard — on a weekly basis. The whole room, everyone included, invoiced quarterly."
          max={620}
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Button href="/privatise" variant="primary" iconAfter="arrow-right">
            Explore privatisation
          </Button>
        </div>
      </Section>

      <Section tone="page" id="enquire">
        <SectionHead
          align="center"
          eyebrow="Here to help"
          title="Questions? Chat to us now"
          intro="Tell us the room, a date and time, and anything that would make it perfect — a bigger catering order, a time outside 09:00–17:30, or a hand with the A/V. We’ll sort it, no waiting on an email."
          max={620}
        />
        <div className={styles.enquireList} style={{ maxWidth: 560, margin: '0 auto' }}>
          {ASSURANCES.map((a) => (
            <div key={a} className={styles.enquireItem}>
              <Icon name="check" size={18} color="var(--gold-600)" strokeWidth={2.25} />
              <span>{a}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <TalkToUs variant="solid" label="Chat to us now" prefill="I’d like to book a meeting room: " />
        </div>
      </Section>

      <Breadcrumbs trail={[{ name: 'Meeting rooms', path: '/meeting-rooms' }]} />
    </>
  );
}
