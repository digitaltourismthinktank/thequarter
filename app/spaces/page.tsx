import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, Photo, IncludedStrip } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { SpaceCard } from '@/components/ds/SpaceCard';
import { RoomCard } from '@/components/ds/RoomCard';
import { PodBooking } from '@/components/site/PodBooking';
import { SPACES, INCLUDED } from '@/lib/spaces';
import { MEETING_ROOMS } from '@/lib/rooms';
import { PHOTOS } from '@/lib/media';
import styles from './spaces.module.css';

export const metadata: Metadata = {
  title: 'The Spaces',
  description:
    'The open workspace, the phone pods, two meeting rooms and The Kentish Pantry with its Cathedral view — every corner of The Quarter in Canterbury’s Cathedral Quarter.',
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
            Open desks, private phone pods, high-spec meeting rooms and a café with the Cathedral view. Every corner
            renovated between 2023 and 2025 and made to feel like home.
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
          body="Open desks across three light-filled rooms — Dane John Gardens, The Vineyard and The Hop Yard — each with fibre, a monitor at every desk and plug-and-play A/V. Take any free seat: natural light pours in, plants run throughout, and there’s the quiet hum of people getting good work done."
          meta={[
            { icon: 'users', label: 'Three co-working rooms' },
            { icon: 'wifi', label: 'Fibre internet' },
            { icon: 'leaf', label: 'Plantspiration' },
          ]}
          photo={PHOTOS.mainSpace}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 'clamp(20px, 3vw, 32px)' }}>
          {[
            { p: PHOTOS.hopYard, cap: 'The Hop Yard — seats seven' },
            { p: PHOTOS.vineyard, cap: 'The Vineyard — seats six' },
          ].map((it) => (
            <figure key={it.p.src} style={{ margin: 0 }}>
              <Photo src={it.p.src} alt={it.p.alt} ratio="3 / 2" sizes="(max-width: 720px) 100vw, 460px" />
              <figcaption style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--stone-700)' }}>{it.cap}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Privatise nudge — the open rooms can become a team's own */}
      <Section tone="gold">
        <SectionHead
          align="center"
          eyebrow="For teams"
          title="Make one of these rooms your team's own"
          intro="Bringing your team in on the same days each week or month? Privatise The Hop Yard or The Vineyard — the whole room, everyone included, set up in minutes and invoiced quarterly."
          max={620}
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <Button href="/privatise" variant="primary" iconAfter="arrow-right">
            Explore privatisation
          </Button>
        </div>
      </Section>

      {/* The Phone Pods */}
      <Section tone="page" id="flexi">
        <Feature
          reverse
          eyebrow="The Phone Pods · the Bell Tower & the Scriptorium"
          title="A door to close when you need it"
          body="Two slat-lined booths for a call, a catch-up or an hour of heads-down quiet — included with every desk plan, or bookable on their own for a single meeting. Drop in when you need a moment apart, then step back out into the room."
          meta={[
            { icon: 'door-open', label: 'Drop-in for members' },
            { icon: 'users', label: '1–2 people' },
          ]}
          photo={PHOTOS.flexi}
        />
        <div style={{ marginTop: 'clamp(24px, 4vw, 40px)' }}>
          <PodBooking />
        </div>
      </Section>

      {/* The Kentish Pantry */}
      <Section tone="card" id="cafe">
        <Feature
          eyebrow="The Kentish Pantry"
          title="The Cathedral view, and the breakfast"
          body="An open social space — not bookable, just ours to share. The day starts here: a daily breakfast with yoghurts, cereals and, when they’re going, complimentary pastries and cakes; a bean-to-cup machine for a coffee made just how you like it, a big range of teas, and filtered & sparkling water by Arke. Snip your own herbs from our Auk Smart Garden on the windowsill. It’s where the community happens — with the Cathedral right there in the window."
          meta={[
            { icon: 'coffee', label: 'Bean-to-cup, made your way' },
            { icon: 'leaf', label: 'Herbs from our Auk Smart Garden' },
            { icon: 'cake', label: 'Pastries & cakes, on us' },
          ]}
          photo={PHOTOS.breakfast}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 'clamp(20px, 3vw, 32px)' }}>
          {[
            { p: PHOTOS.urbanFarm, cap: 'Our Auk Smart Garden — help yourself to fresh herbs' },
            { p: PHOTOS.coffeeMachine, cap: 'Personalise your coffee, with syrups and cold drinks alongside' },
            { p: PHOTOS.pastries, cap: 'Pastries & cakes, complimentary and subject to availability' },
          ].map((it) => (
            <figure key={it.p.src} style={{ margin: 0 }}>
              <Photo src={it.p.src} alt={it.p.alt} ratio="4 / 3" sizes="(max-width: 720px) 100vw, 360px" />
              <figcaption style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--stone-700)', lineHeight: 1.4 }}>{it.cap}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Meeting rooms */}
      <Section tone="page">
        <SectionHead
          eyebrow="Meeting rooms"
          title="Rooms for the meetings that matter"
          intro="Two high-spec rooms — including a hybrid-ready boardroom — as half-day and full-day packages, with a lunch add-on and 20% off hire on quiet days. Check this week's availability and book, or send an enquiry."
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
