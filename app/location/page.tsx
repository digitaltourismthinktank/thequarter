import type { Metadata } from 'next';
import { Section, Eyebrow } from '@/components/site/primitives';
import { Icon } from '@/components/ds/Icon';
import { EnquiryForm } from '@/components/site/EnquiryForm';
import { SITE } from '@/lib/site';
import styles from './location.module.css';

export const metadata: Metadata = {
  title: 'Location & contact',
  description:
    'Find The Quarter across the first and second floors of Canterbury’s Cathedral Quarter. Opening hours, how to get here, and how to reach us.',
  alternates: { canonical: '/location' },
};

export default function LocationPage() {
  return (
    <>
      <Section tone="page" style={{ paddingBottom: 'clamp(28px, 4vw, 40px)' }}>
        <div className={styles.header}>
          <Eyebrow>Find us</Eyebrow>
          <h1 className={styles.h1}>Location &amp; contact</h1>
          <p className={styles.lead}>
            The first and second floors, in the heart of Canterbury&rsquo;s Cathedral Quarter — with the Cathedral right
            there in the café window. Come up and say hello.
          </p>
        </div>
      </Section>

      <Section tone="page" style={{ paddingTop: 0 }}>
        <div className={styles.layout}>
          {/* Details + map */}
          <div>
            <Eyebrow>Visit</Eyebrow>
            <h2 className={styles.formTitle} style={{ marginTop: 12 }}>
              Come up to the first &amp; second floors
            </h2>

            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>
                  <Icon name="map-pin" size={20} color="var(--gold-700)" />
                </span>
                <div>
                  <div className={styles.infoLabel}>Address</div>
                  <div className={styles.infoText}>{SITE.address}</div>
                </div>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>
                  <Icon name="clock" size={20} color="var(--gold-700)" />
                </span>
                <div>
                  <div className={styles.infoLabel}>Hours</div>
                  <div className={styles.infoText}>Monday to Friday, 9am – 5:30pm. Members have access on their plan.</div>
                </div>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>
                  <Icon name="door-open" size={20} color="var(--gold-700)" />
                </span>
                <div>
                  <div className={styles.infoLabel}>Getting here</div>
                  <div className={styles.infoText}>
                    A few minutes&rsquo; walk from Canterbury West and the city centre. Paid parking nearby; bike-friendly.
                  </div>
                </div>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoIcon}>
                  <Icon name="phone" size={20} color="var(--gold-700)" />
                </span>
                <div>
                  <div className={styles.infoLabel}>Get in touch</div>
                  <div className={styles.infoText}>
                    <a className={styles.infoLink} href={`mailto:${SITE.email}`}>
                      {SITE.email}
                    </a>
                    <br />
                    <a className={styles.infoLink} href={`tel:${SITE.phone.replace(/[^+\d]/g, '')}`}>
                      {SITE.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <iframe
              className={styles.map}
              title="The Quarter on the map — Canterbury Cathedral Quarter"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=Canterbury%20Cathedral%2C%20Canterbury&output=embed"
            />
          </div>

          {/* Contact form */}
          <div id="contact">
            <h2 className={styles.formTitle}>Send us a note</h2>
            <p className={styles.formIntro}>
              Questions about plans, rooms or visiting? Drop us a line and we&rsquo;ll reply within a working day.
            </p>
            <EnquiryForm formName="contact" withRoom={false} />
          </div>
        </div>
      </Section>
    </>
  );
}
