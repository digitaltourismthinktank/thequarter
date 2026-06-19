import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, Photo, IncludedStrip } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { SpaceCard } from '@/components/ds/SpaceCard';
import { RoomCard } from '@/components/ds/RoomCard';
import { SPACES, INCLUDED } from '@/lib/spaces';
import { MEETING_ROOMS } from '@/lib/rooms';
import { PHOTOS } from '@/lib/media';
import styles from './spaces.module.css';

export const metadata: Metadata = {
  title: 'The Spaces',
  description:
    'The open workspace, the Flexi Rooms, three meeting rooms and the Quarter Café with its cathedral view — every corner of The Quarter in Canterbury’s Cathedral Quarter.',
  alternates: { canonical: '/spaces' },
};

interface FeatureProps {
  eyebrow: string;
  title: string;
  body: string;
  meta?: { icon: IconName; label: string }[];
  photo: { src: string; alt: string };
  reverse?: boolean;
}

function Feature({ eyebrow, title, body, meta, photo, reverse }: FeatureProps) {
  const img = <Photo src={photo.src} alt={photo.alt} ratio="5 / 4" sizes="(max-width: 900px) 100vw, 600px" />;
  const text = (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={styles.featureTitle}>{title}</h2>
      <p className={styles.featureText}>{body}</p>
      {meta?.length ? (
        <div className={styles.featureMeta}>
          {meta.map((m, i) => (
            <span key={i} className={styles.featureMetaItem}>
              <Icon name={m.icon} size={18} color="var(--gold-600)" />
              {m.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
  return (
    <div className={styles.feature}>
      {reverse ? (
        <>
          {text}
          {img}
        </>
      ) : (
        <>
          {img}
          {text}
        </>
      )}
    </div>
  );
}

export default function SpacesPage() {
  return (
    <>
      {/* Header */}
      <Section tone="ink">
        <div className={styles.header}>
          <Badge tone="gold" icon="leaf">
            Fresh, light, full of plants
          </Badge>
          <h1 className={styles.h1}>The Spaces</h1>
          <p className={styles.lead}>
            Open desks, private breakout rooms, high-spec meeting rooms and a café with the cathedral view. Every corner
            renovated in 2025 and made to feel like home.
          </p>
        </div>
      </Section>

      {/* Overview cards */}
      <Section tone="page">
        <div className={styles.cardGrid}>
          {SPACES.map((s) => (
            <SpaceCard
              key={s.id}
              name={s.name}
              tag={s.tag}
              blurb={s.blurb}
              imageSrc={s.photo.src}
              imageAlt={s.photo.alt}
              meta={s.meta}
              href={s.href}
            />
          ))}
        </div>
      </Section>

      {/* The Open Workspace */}
      <Section tone="card" id="open-workspace">
        <Feature
          eyebrow="The Open Workspace"
          title="Find your focus in the light"
          body="Open desks in the main room, with fibre, ergonomic chairs and plug-and-play A/V at hand. Natural light pours in, plants run throughout, and there's the quiet hum of people getting good work done. Your day, your seat."
          meta={[
            { icon: 'users', label: 'Open seating' },
            { icon: 'wifi', label: 'Fibre internet' },
            { icon: 'leaf', label: 'Plantspiration' },
          ]}
          photo={PHOTOS.mainSpace}
        />
      </Section>

      {/* The Flexi Rooms */}
      <Section tone="page" id="flexi">
        <Feature
          reverse
          eyebrow="The Flexi Rooms · the Bell Tower & the Scriptorium"
          title="A door to close when you need it"
          body="Two slat-lined booths for a call, a catch-up or an hour of heads-down quiet — included with every desk plan. Drop in when you need a moment apart, then step back out into the room."
          meta={[
            { icon: 'door-open', label: 'Drop-in, no booking' },
            { icon: 'users', label: '1–2 people' },
          ]}
          photo={PHOTOS.flexi}
        />
      </Section>

      {/* The Quarter Café */}
      <Section tone="card" id="cafe">
        <Feature
          eyebrow="The Quarter Café"
          title="The cathedral view, and the breakfast"
          body="An open social space — not bookable, just ours to share. It's where the day starts with a daily healthy breakfast and Lavazza coffee, and where the community happens. The cathedral sits right there in the window."
          meta={[
            { icon: 'coffee', label: 'Lavazza & breakfast' },
            { icon: 'leaf', label: 'Cathedral view' },
            { icon: 'utensils', label: 'Not bookable — open to all members' },
          ]}
          photo={PHOTOS.cafe}
        />
      </Section>

      {/* Meeting rooms */}
      <Section tone="page">
        <SectionHead
          eyebrow="Meeting rooms"
          title="Rooms for the meetings that matter"
          intro="A hybrid-ready boardroom and two high-spec rooms — half-day and full-day packages with catering. Check this week's availability and reserve, or send an enquiry."
          max={580}
        />
        <div className={styles.roomsList}>
          {MEETING_ROOMS.map((r) => (
            <RoomCard
              key={r.slug}
              layout="horizontal"
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

      {/* Included */}
      <Section tone="card">
        <Eyebrow>Included with every desk plan</Eyebrow>
        <h2 className={styles.includedTitle}>The good things, as standard</h2>
        <IncludedStrip items={INCLUDED} />
      </Section>

      {/* CTA */}
      <Section tone="gold">
        <div className={styles.closing}>
          <SectionHead
            align="center"
            title="Come and spend a morning with us"
            intro="Book a Day Pass and feel the place — breakfast, coffee and a desk in the light."
            max={560}
          />
          <div className={styles.closingActions}>
            <Button size="lg" variant="primary" href="/day-pass" iconAfter="arrow-right">
              Book a Day Pass
            </Button>
            <Button size="lg" variant="secondary" href="/meeting-rooms">
              Check meeting rooms
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
