import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, Photo } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { PHOTOS } from '@/lib/media';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About',
  description:
    'The Quarter is a boutique co-working home in Canterbury’s Cathedral Quarter, run by SE1 Media. Going to work here feels like coming home.',
  alternates: { canonical: '/about' },
};

const VALUES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'coffee',
    title: 'Like coming home',
    text: 'Going to work at The Quarter should feel like coming home — a friendly welcome, familiar faces and none of the isolation of the spare room.',
  },
  {
    icon: 'sparkles',
    title: 'Find your focus',
    text: 'Quiet when you need it, company when you don’t. A room that helps you do your best work.',
  },
  {
    icon: 'leaf',
    title: 'An escape from home',
    text: 'A reason to leave the spare room — natural light, real people and a proper change of scenery.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <Section tone="ink">
        <div className={styles.header}>
          <Badge tone="gold" icon="map-pin">
            Cathedral Quarter, Canterbury
          </Badge>
          <h1 className={styles.h1}>Going to work that feels like coming home</h1>
          <p className={styles.lead}>
            The Quarter is a boutique co-working home across the first and second floors of a lovingly renovated building
            in Canterbury&rsquo;s Cathedral Quarter — run by SE1 Media, for people who want warmth, human contact and a
            change of scenery.
          </p>
        </div>
      </Section>

      {/* Story */}
      <Section tone="card">
        <div className={styles.split}>
          <Photo src={PHOTOS.mainSpaceWide.src} alt={PHOTOS.mainSpaceWide.alt} ratio="5 / 4" sizes="(max-width: 900px) 100vw, 600px" />
          <div>
            <Eyebrow>Our story</Eyebrow>
            <h2 className={styles.featureTitle}>So much more than a workspace</h2>
            <p className={styles.featureText}>
              We didn&rsquo;t set out to build a workspace empire. The Quarter is a considered sideline — a beautiful room
              we wanted to spend our own days in, opened up to a community of people who feel the same.
            </p>
            <p className={styles.featureText}>
              Renovated between 2023 and 2025, it&rsquo;s fresh, full of light and full of plants, with the Cathedral right
              there in the window of the café. Come for the view and the breakfast; stay for the people.
            </p>
          </div>
        </div>
      </Section>

      {/* Plantspiration */}
      <Section tone="page" id="plantspiration">
        <div className={styles.split}>
          <div>
            <Eyebrow>Plantspiration</Eyebrow>
            <h2 className={styles.featureTitle}>Help yourself to the harvest</h2>
            <p className={styles.featureText}>
              Our Auk Smart Garden is a living urban farm at the heart of the office &mdash; fresh herbs and greens growing
              all year round, and you&rsquo;re welcome to help yourself to whatever&rsquo;s ready to pick. Greenery runs
              right through the building too, so the air stays fresh and everyone breathes a little easier.
            </p>
          </div>
          <Photo src={PHOTOS.urbanFarm.src} alt={PHOTOS.urbanFarm.alt} ratio="5 / 4" sizes="(max-width: 900px) 100vw, 600px" />
        </div>
      </Section>

      {/* Dog friendly — Marmaduke */}
      <Section tone="page">
        <div className={styles.split}>
          <div>
            <Eyebrow>Dog friendly</Eyebrow>
            <h2 className={styles.featureTitle}>Proudly dog-friendly</h2>
            <p className={styles.featureText}>
              Well-behaved four-legged colleagues are always welcome here &mdash; bring yours along, they&rsquo;ll be in
              good company. Chief among our regulars is Marmaduke, our resident pug and self-appointed Chief Happiness
              Officer, who takes his morning-greeting and lap-warming duties very seriously.
            </p>
          </div>
          <Photo src={PHOTOS.marmaduke.src} alt={PHOTOS.marmaduke.alt} ratio="5 / 4" sizes="(max-width: 900px) 100vw, 600px" />
        </div>
      </Section>

      {/* Values */}
      <Section tone="card">
        <SectionHead eyebrow="What we believe" title="The things we won’t compromise on" max={560} />
        <div className={styles.values}>
          {VALUES.map((v) => (
            <div key={v.title} className={styles.valueCard}>
              <span className={styles.valueIcon}>
                <Icon name={v.icon} size={22} color="var(--gold-700)" />
              </span>
              <h3 className={styles.valueTitle}>{v.title}</h3>
              <p className={styles.valueText}>{v.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section tone="gold">
        <div className={styles.closing}>
          <SectionHead
            align="center"
            title="Come and see what we’ve built"
            intro="The best way to feel the place is to visit. Book a tour, or spend a morning on a Day Pass — we think you’ll want to stay."
            max={560}
          />
          <div className={styles.closingActions}>
            <Button size="lg" variant="primary" href="/tour" iconAfter="arrow-right">
              Book a tour
            </Button>
            <Button size="lg" variant="secondary" href="/day-pass">
              Book a Day Pass
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
