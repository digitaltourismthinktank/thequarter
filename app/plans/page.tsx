import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, IncludedStrip } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { PlanCard } from '@/components/ds/PlanCard';
import { PLANS } from '@/lib/plans';
import { INCLUDED } from '@/lib/spaces';
import styles from './plans.module.css';

export const metadata: Metadata = {
  title: 'Plans & pricing',
  description:
    'Day Pass, Visitor, Resident, Citizen and the Hybrid Office — flexible coworking plans in Canterbury’s Cathedral Quarter. Prices include VAT.',
  alternates: { canonical: '/plans' },
};

const FAQS: [string, string][] = [
  [
    'Can I just try it for a day?',
    'Yes — the Day Pass at £21.60 is our public way in. A full day with breakfast, coffee and the Flexi Rooms included.',
  ],
  [
    'Do days roll over?',
    'Visitor and Resident days are used within the month. Citizen is unrestricted, so there is nothing to count.',
  ],
  [
    'What is the Hybrid Office?',
    'A Canterbury mailing address plus twelve days a year in the space — for those who work from home but want a base in town. Billed annually.',
  ],
  [
    'How does meeting-room pricing work?',
    'Quoted on enquiry, around half-day and full-day packages. Add catering — Lavazza, pastries and a healthy lunch — when you reserve.',
  ],
];

export default function PlansPage() {
  return (
    <>
      <Section tone="page" style={{ paddingBottom: 8 }}>
        <SectionHead
          align="center"
          eyebrow="Plans & pricing"
          title="Find the plan that fits your week"
          intro="All prices include VAT. Every desk plan comes with fibre, ergonomic desks, plug-and-play A/V, a daily healthy breakfast, Lavazza coffee and access to the Flexi Rooms. Start with a Day Pass — the public way in."
          max={680}
        />
      </Section>

      <Section tone="page" style={{ paddingTop: 24 }}>
        <div className={styles.planGrid}>
          {PLANS.map((p) => (
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
        <p className={styles.vatNote}>Prices include VAT. Cancel any time on Visitor, Resident and Citizen.</p>
      </Section>

      {/* Always included + teams */}
      <Section tone="card">
        <div className={styles.split}>
          <div>
            <Eyebrow>What&rsquo;s always included</Eyebrow>
            <h2 className={styles.includedTitle}>No tiers of small print</h2>
            <IncludedStrip items={INCLUDED} />
          </div>
          <div className={styles.teamsPanel}>
            <Badge tone="gold">For teams</Badge>
            <h3 className={styles.teamsTitle}>Need a room, not a desk?</h3>
            <p className={styles.teamsText}>
              Our meeting rooms are quoted on enquiry, around half-day and full-day packages with catering. Check live
              availability and reserve, or send us a note.
            </p>
            <div className={styles.teamsActions}>
              <Button variant="accent" href="/meeting-rooms" iconAfter="arrow-right">
                Meeting rooms
              </Button>
              <Button variant="inverse" href="/location" icon="phone">
                Enquire
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="page">
        <SectionHead align="center" title="Questions, answered" max={560} />
        <div className={styles.faq}>
          {FAQS.map(([q, a]) => (
            <details key={q} className={styles.faqItem}>
              <summary>
                {q}
                <Icon name="chevron-down" size={18} color="var(--stone-500)" className={styles.chevron} />
              </summary>
              <p className={styles.faqAnswer}>{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
