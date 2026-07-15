import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow, IncludedStrip } from '@/components/site/primitives';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { PlanCard } from '@/components/ds/PlanCard';
import { PLANS, getPlan } from '@/lib/plans';
import { CARNET_BUNDLES, carnetPerPass, DAY_PASS_PRICE } from '@/lib/rewards';
import { INCLUDED } from '@/lib/spaces';
import { JsonLd } from '@/components/site/JsonLd';
import styles from './plans.module.css';

export const metadata: Metadata = {
  title: 'Plans & pricing',
  description:
    'Day Pass, Visitor, Resident, Citizen and the Hybrid Office — flexible co-working plans in Canterbury’s Cathedral Quarter. Prices include VAT.',
  alternates: { canonical: '/plans' },
};

const FAQS: [string, string][] = [
  [
    'Can I just try it for a day?',
    'Yes — the Day Pass at £21.60 is our public way in. A full day with breakfast, coffee and use of the phone pods included.',
  ],
  [
    'Do days roll over?',
    'Visitor and Resident days are used within the month. Citizen is unrestricted, so there is nothing to count.',
  ],
  [
    'What is the Hybrid Office?',
    'A registered Canterbury office address plus twelve days a year in the space — for those who work from home but want a base in town. Billed annually.',
  ],
  [
    'How does meeting-room pricing work?',
    'Half-day and full-day packages: The Chapter House from £90 half-day / £150 full-day, The Knight’s Tale from £144 / £240 (inc. VAT). Add lunch — baguettes and cake — at £12 a head, and save 20% on room hire on our quieter days (Mon, Wed & Fri).',
  ],
];

const gbp = (n: number) => `£${n.toFixed(2)}`;

export default function PlansPage() {
  const hybrid = getPlan('hybrid-office');
  return (
    <>
      <Section tone="page" style={{ paddingBottom: 8 }}>
        <SectionHead
          align="center"
          eyebrow="Plans & pricing"
          title="Find the plan that fits your week"
          intro="All prices include VAT. Every desk plan comes with fibre, a monitor at every desk, plug-and-play A/V, a daily breakfast, bean-to-cup coffee and use of the phone pods. Start with a Day Pass — the public way in."
          max={680}
        />
      </Section>

      <Section tone="page" style={{ paddingTop: 24 }}>
        <div className={styles.planGrid}>
          {PLANS.filter((p) => p.id !== 'hybrid-office').map((p) => (
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

      {/* Other Plans — Hybrid Office + day-pass carnets */}
      <Section tone="page" style={{ paddingTop: 8 }}>
        <SectionHead
          eyebrow="Also available"
          title="Other Plans"
          intro="A registered address with a few days in the space, or a book of day passes to use as you like — cheaper per day than buying them one at a time."
          max={620}
        />
        <div className={styles.planGrid}>
          {hybrid ? (
            <PlanCard
              name={hybrid.name}
              price={hybrid.price}
              period={hybrid.period}
              summary={hybrid.summary}
              features={hybrid.features}
              badge={hybrid.badge}
              ctaLabel={hybrid.ctaLabel}
              ctaHref={hybrid.ctaHref}
            />
          ) : null}
          {CARNET_BUNDLES.map((b) => (
            <PlanCard
              key={b.passes}
              name={`${b.passes} day passes`}
              price={gbp(b.price)}
              period={`${gbp(carnetPerPass(b))} a pass`}
              summary={`A book of ${b.passes} passes to use as you like.`}
              features={[
                'Cheaper per day than a single pass',
                'Use standalone or with a plan',
                'Valid twelve months',
                'For days your plan doesn’t cover',
                'Or sign a friend in',
              ]}
              featured={b.bestValue}
              badge={b.bestValue ? 'Best value' : undefined}
              ctaLabel="Buy carnet"
              ctaHref={`/buy-carnet?bundle=${b.passes}`}
            />
          ))}
        </div>
        <p className={styles.vatNote}>A single day pass is {gbp(DAY_PASS_PRICE)}. Carnet passes are valid for twelve months.</p>
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
              Book a meeting room by the half or full day — or give your team a room of their own: privatise The Hop Yard
              or The Vineyard on your days, everyone included, invoiced quarterly.
            </p>
            <div className={styles.teamsActions}>
              <Button variant="accent" href="/privatise" iconAfter="arrow-right">
                Privatise a room
              </Button>
              <Button variant="inverse" href="/meeting-rooms">
                Meeting rooms
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

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map(([q, a]) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        }}
      />
    </>
  );
}
