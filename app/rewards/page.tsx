import type { Metadata } from 'next';
import { Section, SectionHead, Eyebrow } from '@/components/site/primitives';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import { RewardsClient } from '@/components/site/RewardsClient';
import { LEVELS, CATALOGUE_SEED } from '@/lib/rewards';
import styles from './rewards.module.css';

export const metadata: Metadata = {
  title: 'Quarter Rewards',
  description:
    'Work at The Quarter and earn rewards to spend with Canterbury’s independent shops, cafés and bars. Points for being here and for what you spend — our way of saying thank you and keeping trade local.',
  alternates: { canonical: '/rewards' },
};

/* Three-step how-it-works. */
const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'door-open',
    title: 'Come in and work',
    text: 'Every day you’re here earns points — a few more on our quieter days. Nothing to stamp; you check in and we do the rest.',
  },
  {
    icon: 'sparkles',
    title: 'Watch them add up',
    text: 'You earn on what you spend with us too — day passes, the carnet, room hire. The longer you’re part of the place, the faster they build.',
  },
  {
    icon: 'gift',
    title: 'Spend them locally',
    text: 'Turn points into a coffee down the road, a patisserie treat, a glass at Corkk or a Cathedral pass — redeemed in a moment from your member dashboard.',
  },
];

/* A marketing line per earned tier (names/order come straight from LEVELS). */
const LEVEL_LINES: Record<string, string> = {
  newbie: 'Where everyone starts. Points on every visit, and a treat when it’s your birthday.',
  regular: 'For the familiar faces. Points build a little faster, and the birthday treat stays.',
  family: 'Properly part of the place. Points build faster still, plus a guest pass to bring someone along.',
  ambassador: 'Our regulars’ regulars. The fastest earning, guest passes when you need them, and first to know what’s on.',
};

/* A handful of the catalogue as a taste (real costs live in the member view). */
const HIGHLIGHT_IDS = ['coffee', 'treat', 'refillery', 'cathedral', 'corkk-evening'];

export default function RewardsPage() {
  const highlights = HIGHLIGHT_IDS.map((id) => CATALOGUE_SEED.find((r) => r.id === id)).filter(
    (r): r is (typeof CATALOGUE_SEED)[number] => Boolean(r),
  );

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

      {/* HOW IT WORKS */}
      <Section tone="page">
        <SectionHead
          eyebrow="How it works"
          title="Three steps, and you’re earning"
          intro="No cards to carry, no small print. You earn from your very first visit — as a member or on a day pass."
          max={620}
        />
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <div key={s.title} className={styles.step}>
              <span className={styles.stepNum}>{`0${i + 1}`}</span>
              <span className={styles.stepIcon}>
                <Icon name={s.icon} size={24} color="var(--gold-700)" />
              </span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepText}>{s.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* LEVELS */}
      <Section tone="sunken">
        <SectionHead
          eyebrow="The more you’re around"
          title="…the more you get back"
          intro="Everyone starts as a Newbie and climbs simply by being here. Higher tiers earn a little faster and open up guest passes and birthday treats — you never lose the ground you’ve made."
          max={640}
        />
        <div className={styles.levels}>
          {LEVELS.map((lv, i) => (
            <div key={lv.slug} className={styles.level}>
              <div className={styles.levelTop}>
                <span className={styles.levelName}>{lv.name}</span>
                <span className={styles.levelRank}>{`Tier ${i + 1}`}</span>
              </div>
              <p className={styles.levelLine}>{LEVEL_LINES[lv.slug]}</p>
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
        <div className={styles.rewards}>
          {highlights.map((r) => (
            <article key={r.id} className={`${styles.reward} ${r.hero ? styles.rewardHero : ''}`}>
              <span className={styles.rewardChip}>
                <Icon name={r.icon} size={22} color="var(--gold-700)" />
              </span>
              <span className={styles.rewardPartner}>{r.partner}</span>
              <h3 className={styles.rewardTitle}>{r.title}</h3>
            </article>
          ))}
        </div>
        <p className={styles.rewardsFoot}>
          Members also get always-on perks with our neighbours — <a href="/perks">see who’s involved</a>.
        </p>
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

  return <RewardsClient marketing={marketing} />;
}
