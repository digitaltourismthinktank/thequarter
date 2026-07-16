import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { RewardsClient } from '@/components/site/RewardsClient';
import { RewardShowcase } from '@/components/site/RewardShowcase';
import { PerksGrid } from '@/components/site/PerksGrid';
import { TreatsGrid } from '@/components/site/TreatsGrid';
import { LEVELS, EARN_RULES, POINTS_PER_POUND_VALUE } from '@/lib/rewards';
import { Breadcrumbs } from '@/components/site/Breadcrumbs';
import styles from './rewards.module.css';

export const metadata: Metadata = {
  title: 'Quarter Rewards',
  description:
    'Work at The Quarter and earn points to spend with Canterbury’s independent shops, cafés and bars — plus always-on perks around the corner. Points for being here and for what you spend, our way of saying thank you and keeping trade local.',
  alternates: { canonical: '/rewards' },
};

/* A marketing line per earned tier (names/order come straight from LEVELS). */
const LEVEL_LINES: Record<string, string> = {
  newbie: 'Where everyone starts. Points on every visit, and a treat when it’s your birthday.',
  regular: 'For the familiar faces. Points build a little faster, and the birthday treat stays.',
  family: 'Properly part of the place. Points build faster still, plus a guest pass to bring someone along.',
  ambassador: 'Our regulars’ regulars. The fastest earning, guest passes when you need them, and first to know what’s on.',
};

/* Earn-rate label per level, mirroring the member levels rail. */
function earnRate(boost: number): string {
  return boost === 1 ? 'Base earn rate' : `Earn ${Math.round((boost - 1) * 100)}% faster`;
}

export default function RewardsPage() {
  const marketing = (
    <>
      {/* HERO */}
      <Section tone="gold">
        <div className={styles.header}>
          <Eyebrow>Quarter Rewards</Eyebrow>
          <h1 className={styles.h1}>Work here, earn rewards to spend with local independents</h1>
          <p className={styles.lead}>
            <span className={styles.leadStrong}>It’s our way of saying thank you.</span> Simply by spending time at The
            Quarter you earn points — and we turn them into treats at the independent shops, cafés and bars around us.
            Good for you, and good for the neighbourhood that makes this corner of Canterbury what it is.
          </p>
        </div>
      </Section>

      {/* SHOWCASE — the ring + the loyalty card at every level */}
      <Section tone="ink">
        <SectionHead
          align="center"
          dark
          eyebrow="Your Quarter Card"
          title="Every visit earns. Every level unlocks more."
          intro="Watch your points ring fill and your card gild as you climb — from your very first morning to Ambassador."
          max={640}
        />
        <RewardShowcase />
      </Section>

      {/* HOW YOU EARN — real earn rules */}
      <Section tone="page">
        <SectionHead
          eyebrow="How you earn"
          title="Points, just for being a regular"
          intro="No cards to carry, no small print. You earn from your very first visit — as a member or on a day pass."
          max={620}
        />
        <div className={styles.earnRows}>
          {EARN_RULES.map((rule) => (
            <div key={rule.title} className={`${styles.earnRow} ${rule.lead ? styles.earnLead : ''}`}>
              <span className={`${styles.earnChip} ${rule.lead ? styles.earnChipLead : ''}`}>
                <Icon name={rule.icon} size={20} color={rule.lead ? 'var(--ink-900)' : 'var(--gold-700)'} />
              </span>
              <div className={styles.earnText}>
                <strong>{rule.title}</strong>
                <span>{rule.note}</span>
              </div>
              <span className={`${styles.earnVal} ${rule.lead ? styles.earnValLead : ''}`}>{rule.value}</span>
            </div>
          ))}
        </div>
        <p className={styles.anchor}>
          Simple maths: <strong>{POINTS_PER_POUND_VALUE} points = £1</strong> to spend with our neighbours.
        </p>
      </Section>

      {/* LEVELS — public variant of the member levels rail */}
      <Section tone="sunken">
        <SectionHead
          eyebrow="The more you’re around"
          title="…the more you get back"
          intro="Everyone starts as a Newbie and climbs simply by being here. Higher tiers earn a little faster and open up guest passes and birthday treats — you never lose the ground you’ve made."
          max={640}
        />
        <div className={styles.levels}>
          {LEVELS.map((lv) => (
            <div key={lv.slug} className={styles.level}>
              <div className={styles.levelHead}>
                <span className={styles.levelName}>{lv.name}</span>
                <span className={styles.levelThresh}>{lv.min > 0 ? `${lv.min.toLocaleString('en-GB')} pts` : 'Start'}</span>
              </div>
              <span className={styles.levelRate}>{earnRate(lv.boost)}</span>
              <p className={styles.levelLine}>{LEVEL_LINES[lv.slug]}</p>
              <ul className={styles.levelPerks}>
                {lv.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* TREATS */}
      <Section tone="page">
        <SectionHead
          eyebrow="Treats worth earning"
          title="Points, spent around the corner"
          intro="A taste of what’s on the board. We refresh it with our partners through the year — and every redemption puts a little trade back into a local independent."
          max={640}
        />
        <TreatsGrid />
        <p className={styles.rewardsFoot}>
          Members also get always-on perks with our neighbours — <a href="#perks">see who’s involved</a>.
        </p>
      </Section>

      {/* LOCAL PERKS — the old /perks marketing, absorbed here */}
      <Section tone="sunken" id="perks">
        <SectionHead
          eyebrow="Always-on"
          title="Perks around the corner"
          intro="Beyond points, being a member opens doors across the Cathedral Quarter — food, coffee, culture and the little favours that make a neighbourhood feel like yours. Here’s a taste; members redeem from the Quarter Card."
          max={660}
        />
        <PerksGrid />
      </Section>

      {/* CTA */}
      <Section tone="ink">
        <div className={styles.cta}>
          <SectionHead
            align="center"
            dark
            title="It starts the day you join"
            intro="Become a member and you’re earning from your first morning. Prefer to try us first? A day pass earns too."
            max={560}
          />
          <div className={styles.ctaActions}>
            <Button size="lg" variant="accent" href="/plans" iconAfter="arrow-right">
              Become a member
            </Button>
            <Button size="lg" variant="inverse" href="/day-pass">
              Buy a day pass
            </Button>
          </div>
          <p className={styles.ctaAside}>
            Already a member? <a href="/login">See your points</a>.
          </p>
        </div>
      </Section>
    </>
  );

  return (
    <>
      <RewardsClient marketing={marketing} />
      <Breadcrumbs trail={[{ name: 'Rewards', path: '/rewards' }]} />
    </>
  );
}
