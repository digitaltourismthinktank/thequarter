import Image from 'next/image';
import { Section, SectionHead, Eyebrow, Photo, IncludedStrip } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { SpaceCard } from '@/components/ds/SpaceCard';
import { PlanCard } from '@/components/ds/PlanCard';
import { RoomCard } from '@/components/ds/RoomCard';
import { SPACES, INCLUDED } from '@/lib/spaces';
import { PLANS } from '@/lib/plans';
import { MEETING_ROOMS } from '@/lib/rooms';
import { PHOTOS } from '@/lib/media';
import styles from './home.module.css';

const PLANTSPIRATION: [IconName, string][] = [
  ['leaf', 'Plants throughout'],
  ['coffee', 'Daily breakfast & Lavazza'],
  ['users', 'A real community'],
];

export default function HomePage() {
  const boardRoom = MEETING_ROOMS[0];
  return (
    <>
      {/* HERO */}
      <section className={styles.hero}>
        <Image src={PHOTOS.hero.src} alt={PHOTOS.hero.alt} fill priority sizes="100vw" className={styles.heroImg} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroInner}>
          <Badge tone="gold" icon="map-pin">
            Canterbury · Cathedral Quarter
          </Badge>
          <h1 className={styles.heroTitle}>
            So much more
            <br />
            than a workspace
          </h1>
          <p className={styles.heroLead}>
            A boutique coworking home above Canterbury&rsquo;s Cathedral Quarter. Come for the warmth, the natural light
            and the breakfast — find your focus, and an escape from home.
          </p>
          <div className={styles.heroActions}>
            <Button size="lg" variant="accent" href="/day-pass" iconAfter="arrow-right">
              Book a Day Pass · £21.60
            </Button>
            <Button size="lg" variant="inverse" href="/spaces">
              See the spaces
            </Button>
          </div>
        </div>
      </section>

      {/* INCLUDED */}
      <Section tone="card">
        <div className={styles.includedHead}>
          <div className={styles.includedHeadLeft}>
            <Eyebrow>Every desk plan includes</Eyebrow>
            <h2 className={styles.includedTitle}>The good things, as standard</h2>
          </div>
          <p className={styles.includedIntro}>
            No tiers of small print. Whatever plan you choose, the essentials — and the lovely bits — come included.
          </p>
        </div>
        <IncludedStrip items={INCLUDED} />
      </Section>

      {/* SPACES */}
      <Section tone="page">
        <SectionHead
          eyebrow="The Spaces"
          title="Room to think, room to gather"
          intro="From open desks in the light to private rooms for the meetings that matter — and a café with the cathedral view."
        />
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
              href="/spaces"
            />
          ))}
        </div>
      </Section>

      {/* MEETING ROOMS — revenue lever */}
      <Section tone="ink">
        <div className={styles.roomTeaser}>
          <div>
            <SectionHead
              dark
              eyebrow="Meeting rooms"
              title="The room that makes the meeting"
              intro="Two high-spec rooms and a hybrid-ready boardroom, with plug-and-play A/V and catering on request. Check this week’s availability and reserve in a couple of taps."
              max={520}
            />
            <div className={styles.heroActions}>
              <Button size="lg" variant="accent" href="/meeting-rooms" iconAfter="arrow-right">
                Check availability
              </Button>
              <Button size="lg" variant="inverse" href="/meeting-rooms">
                See the rooms
              </Button>
            </div>
          </div>
          <RoomCard
            name={boardRoom.name}
            blurb={boardRoom.blurb}
            capacity={boardRoom.capacity}
            features={boardRoom.features}
            status={boardRoom.status}
            statusLabel={boardRoom.statusLabel}
            priceNote={boardRoom.priceNote}
            imageSrc={boardRoom.photo.src}
            imageAlt={boardRoom.photo.alt}
            ctaHref={`/meeting-rooms/${boardRoom.slug}`}
          />
        </div>
      </Section>

      {/* PLANS */}
      <Section tone="page">
        <SectionHead
          align="center"
          eyebrow="Plans & pricing"
          title="Find the plan that fits your week"
          intro="Prices include VAT. Start with a Day Pass — no commitment, just a desk and a really good morning."
          max={620}
        />
        <div className={styles.planGrid}>
          {PLANS.slice(0, 4).map((p) => (
            <PlanCard
              key={p.id}
              name={p.name}
              price={p.price}
              period={p.period}
              summary={p.summary}
              features={p.features}
              featured={p.featured}
              badge={p.badge}
              ctaLabel={p.ctaLabel}
              ctaHref={p.ctaHref}
            />
          ))}
        </div>
        <div className={styles.plansFooter}>
          <Button variant="secondary" href="/plans" iconAfter="arrow-right">
            See all plans, including Hybrid Office
          </Button>
        </div>
      </Section>

      {/* PLANTSPIRATION */}
      <Section tone="card">
        <div className={styles.split}>
          <Photo
            src={PHOTOS.mainSpaceWide.src}
            alt={PHOTOS.mainSpaceWide.alt}
            ratio="5 / 4"
            sizes="(max-width: 900px) 100vw, 600px"
          />
          <div>
            <Eyebrow>Plantspiration</Eyebrow>
            <h2 className={styles.featureTitle}>Fresh, light and full of plants</h2>
            <p className={styles.featureText}>
              Renovated in 2025, The Quarter feels fresh and full of life. Greenery runs throughout, the light pours in,
              and the cathedral sits in the window of the café. It&rsquo;s the kind of place you actually want to spend
              your day.
            </p>
            <div className={styles.featurePoints}>
              {PLANTSPIRATION.map(([icon, label]) => (
                <div key={label} className={styles.featurePoint}>
                  <Icon name={icon} size={24} color="var(--gold-600)" />
                  <span className={styles.featurePointLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* CLOSING CTA */}
      <Section tone="gold">
        <div className={styles.closing}>
          <h2 className={styles.closingTitle}>Come and find your focus</h2>
          <p className={styles.closingText}>
            Book a Day Pass and spend a morning with us. We think you&rsquo;ll want to stay.
          </p>
          <div className={styles.closingActions}>
            <Button size="lg" variant="primary" href="/day-pass" iconAfter="arrow-right">
              Book a Day Pass
            </Button>
            <Button size="lg" variant="secondary" href="/meeting-rooms">
              Enquire about a room
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
