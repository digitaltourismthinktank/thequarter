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
    'The Quarter is a boutique coworking home in Canterbury’s Cathedral Quarter, run by the Digital Tourism Think Tank as a considered sideline. Warmth wins.',
  alternates: { canonical: '/about' },
};

const VALUES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'coffee',
    title: 'Warmth wins',
    text: 'Where “slick” and “warm” pull against each other, warmth wins. Hospitality-grade, never tech-startup.',
  },
  {
    icon: 'sparkles',
    title: 'Find your focus',
    text: 'Quiet when you need it, company when you don’t. A room that helps you do your best work.',
  },
  {
    icon: 'leaf',
    title: 'An escape from home',
    text: 'A reason to leave the spare room — natural light, real people and a proper change of scene.',
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
          <h1 className={styles.h1}>A considered sideline, run with care</h1>
          <p className={styles.lead}>
            The Quarter is a boutique coworking home on the first floor of a renovated building in Canterbury&rsquo;s
            Cathedral Quarter — run by the Digital Tourism Think Tank, for people who want warmth, human contact and a
            change of scene.
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
              Renovated in 2025, it&rsquo;s fresh, full of light and full of plants, with the cathedral right there in the
              window of the café. Come for the view and the breakfast; stay for the people.
            </p>
          </div>
        </div>
      </Section>

      {/* Plantspiration */}
      <Section tone="page" id="plantspiration">
        <div className={styles.split}>
          <div>
            <Eyebrow>Plantspiration</Eyebrow>
            <h2 className={styles.featureTitle}>A little plantspiration</h2>
            <p className={styles.featureText}>
              Greenery runs throughout, the light pours in, and the day starts with a daily healthy breakfast and Lavazza
              coffee. It&rsquo;s the kind of place you actually want to spend your day — calm, cared-for and quietly alive.
            </p>
          </div>
          <Photo src={PHOTOS.cafe.src} alt={PHOTOS.cafe.alt} ratio="5 / 4" sizes="(max-width: 900px) 100vw, 600px" />
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
            intro="Book a Day Pass and spend a morning with us. We think you’ll want to stay."
            max={560}
          />
          <div className={styles.closingActions}>
            <Button size="lg" variant="primary" href="/day-pass" iconAfter="arrow-right">
              Book a Day Pass
            </Button>
            <Button size="lg" variant="secondary" href="/location">
              Find us
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
