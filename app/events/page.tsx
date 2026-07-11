import type { Metadata } from 'next';
import { Section, Eyebrow, Photo } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { EVENTS } from '@/lib/events';
import { PHOTOS } from '@/lib/media';
import { EventsClient } from '@/components/site/EventsClient';
import styles from './events.module.css';

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Member socials, business briefings and charity Friday access at The Quarter, Canterbury. People stay for the community — breakfasts, workshops, talks and the occasional rooftop drink.',
  alternates: { canonical: '/events' },
};

export default function EventsPage() {
  const marketing = (
    <>
      <Section tone="card" style={{ paddingBottom: 'clamp(40px, 6vw, 64px)' }}>
        <div style={{ maxWidth: 680 }}>
          <Eyebrow>What&rsquo;s on</Eyebrow>
          <h1
            style={{
              fontSize: 'clamp(38px, 5.5vw, 60px)',
              fontWeight: 700,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
              margin: '14px 0 0',
            }}
          >
            Events at The Quarter
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text-body)', marginTop: 16 }}>
            People stay for the community. Member socials, business briefings, workshops and charity Friday access — all
            part of being here.
          </p>
        </div>
      </Section>

      <Section tone="page" style={{ paddingTop: 'clamp(40px, 6vw, 56px)' }}>
        <div className={styles.layout}>
          <div className={styles.list}>
            {EVENTS.map((e) => {
              const [num, mon] = e.date.split(' ');
              return (
                <article key={e.title} className={styles.event}>
                  <div className={styles.date}>
                    <div className={styles.dateDay}>{e.day}</div>
                    <div className={styles.dateNum}>{num}</div>
                    <div className={styles.dateMon}>{mon}</div>
                  </div>
                  <div className={styles.eventBody}>
                    <Badge tone="neutral" size="sm">
                      {e.kind}
                    </Badge>
                    <h2 className={styles.eventTitle}>{e.title}</h2>
                    <p className={styles.eventBlurb}>{e.blurb}</p>
                    <div className={styles.eventTime}>
                      <Icon name="clock" size={14} color="var(--gold-600)" />
                      {e.time}
                    </div>
                  </div>
                  <div className={styles.eventAction}>
                    <Button size="sm" variant="secondary" href="/location#contact">
                      RSVP
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.aside}>
            <Photo src={PHOTOS.breakfast.src} alt={PHOTOS.breakfast.alt} ratio="4 / 5" sizes="(max-width: 900px) 100vw, 460px" />
            <div className={styles.asideCard}>
              <h2 className={styles.asideTitle}>Not a member yet?</h2>
              <p className={styles.asideText}>
                Day Pass holders are welcome at most socials, and Charity Friday opens the café to friends of members.
                Come and meet the place.
              </p>
              <Button variant="primary" fullWidth href="/day-pass" iconAfter="arrow-right">
                Book a Day Pass
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );

  return <EventsClient marketing={marketing} />;
}
