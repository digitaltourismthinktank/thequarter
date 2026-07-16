'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { isAdminEmail } from '@/lib/admin';
import { POINTS_PER_POUND_VALUE, POINTS_PER_GBP, LEVELS } from '@/lib/rewards';
import { useMember } from './useMember';
import styles from './AdminGuide.module.css';

/** Example reward used throughout the points explainer. */
const COFFEE_PRICE = 4.2;
const coffeePoints = Math.round(COFFEE_PRICE * POINTS_PER_POUND_VALUE); // 420
const ambassador = LEVELS.find((l) => l.slug === 'ambassador') || LEVELS[LEVELS.length - 1];
/** £ a member must spend to earn the coffee's points, at a given earn boost. */
const spendToEarn = (boost: number) => coffeePoints / (POINTS_PER_GBP * boost); // Base 420, Ambassador 280
const giveBackPct = (boost: number) => (COFFEE_PRICE / spendToEarn(boost)) * 100; // 1.0% / 1.5%

function Section({ icon, badge, title, children }: { icon: IconName; badge: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <span className={styles.badge}>{badge}</span>
          <h2 className={styles.h2}>{title}</h2>
        </div>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function AdminGuide() {
  const { loading, member } = useMember();

  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

  if (loading) return <p className={styles.state}>Loading…</p>;
  if (!member) return <p className={styles.state}>Please sign in…</p>;
  if (!isAdminEmail(member.auth?.email)) {
    return (
      <p className={styles.state}>
        This area is for The Quarter team. <a href="/dashboard">Back to your dashboard</a>.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <Link href="/admin" className={styles.back}>
          <Icon name="arrow-left" size={16} />
          <span>Back to Admin</span>
        </Link>
      </div>

      <header className={styles.hero}>
        <span className={styles.kicker}>Staff guide</span>
        <h1 className={styles.h1}>How Rewards &amp; Partners work</h1>
        <p className={styles.lede}>
          Everything you need to run the loyalty side of The Quarter with confidence — what the difference is between a
          perk and a reward, who pays for what, how points map to pounds, and how our partners get paid. Read it once and
          nothing here should ever surprise you.
        </p>
      </header>

      <nav className={styles.toc} aria-label="On this page">
        {[
          ['a', 'Perks vs Rewards'],
          ['b', 'The three funding types'],
          ['c', 'Points & value'],
          ['d', 'The points explainer'],
          ['e', 'Enrolling a partner'],
          ['f', 'Redemption & scanning'],
          ['g', 'Partner visibility'],
          ['h', 'Payouts'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className={styles.tocLink}>
            <span className={styles.tocLetter}>{id}</span>
            {label}
          </a>
        ))}
      </nav>

      <div id="a">
        <Section icon="gift" badge="A" title="Perks vs Rewards">
          <p>
            These are two different things and it&apos;s worth keeping them straight:
          </p>
          <div className={styles.split}>
            <div className={styles.splitCard}>
              <h3 className={styles.h3}>Perks</h3>
              <p>
                A standing <strong>discount or nicety</strong> a partner offers Quarter members — say 10% off, or a free
                pastry with a coffee. There are <strong>no points involved</strong>. The member shows they&apos;re a
                member at the till and the partner applies it. Perks are shown in the app so members can browse them.
              </p>
            </div>
            <div className={styles.splitCard}>
              <h3 className={styles.h3}>Rewards</h3>
              <p>
                Something a member <strong>spends points</strong> to claim. Redeeming produces a{' '}
                <strong>QR voucher</strong> that staff scan at the till. The scan is what actually honours it (and, for
                funded rewards, draws down the partner&apos;s pot). Rewards live in the catalogue members redeem from.
              </p>
            </div>
          </div>
          <p className={styles.aside}>
            Rule of thumb: <strong>no points → perk. Points + a QR voucher → reward.</strong>
          </p>
        </Section>
      </div>

      <div id="b">
        <Section icon="briefcase" badge="B" title="The three funding types">
          <p>Every reward has a funding type. It only tells us one thing: who ultimately pays for it.</p>
          <ul className={styles.fundList}>
            <li>
              <span className={styles.fundTag}>Inventory</span>
              <p>
                <strong>Our own stock</strong> — a Quarter tote, a notebook, a guest day pass. Nobody is owed anything;
                we just hand it over. No float, no payout.
              </p>
            </li>
            <li>
              <span className={styles.fundTag}>Partner-float</span>
              <p>
                The partner <strong>pre-pays a pot</strong> (a &ldquo;float&rdquo;) and we draw it down each time a
                member redeems. When the pot runs low they top it up. We never owe them money — they&apos;re in credit
                with us.
              </p>
            </li>
            <li>
              <span className={styles.fundTag}>Quarter-funded</span>
              <p>
                We fund the reward <strong>at a partner</strong> — e.g. a coffee &ldquo;on The Quarter&rdquo;. We{' '}
                <strong>owe the partner</strong> for each redemption and settle it monthly.
              </p>
            </li>
          </ul>
          <p className={styles.aside}>
            Members never see the funding type — it&apos;s an internal, admin-only field.
          </p>
        </Section>
      </div>

      <div id="c">
        <Section icon="pound-sterling" badge="C" title="Points & value">
          <p>
            The whole economy runs on one fixed anchor:{' '}
            <strong>{POINTS_PER_POUND_VALUE} points = £1 of reward value.</strong> Members earn roughly{' '}
            <strong>{POINTS_PER_GBP} point per £1 they spend</strong> with us (memberships, day passes, the carnet, room
            hire and lunches). So the points are, in effect, a small give-back on real spend.
          </p>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{POINTS_PER_POUND_VALUE}</span>
              <span className={styles.statLabel}>points = £1 of reward</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{POINTS_PER_GBP}/£1</span>
              <span className={styles.statLabel}>earned on spend</span>
            </div>
          </div>
        </Section>
      </div>

      <div id="d">
        <Section icon="sparkles" badge="D" title="The points explainer (don't panic)">
          <p>
            This is the bit that looks scarier than it is. A <strong>£{COFFEE_PRICE.toFixed(2)} coffee</strong> costs{' '}
            <strong>{coffeePoints} points</strong> and costs us <strong>£{COFFEE_PRICE.toFixed(2)} for anyone</strong> —
            an Ambassador, a brand-new member, everyone. <strong>You never pay value × the member&apos;s level.</strong>
          </p>
          <p>
            The 50% Ambassador boost is on <strong>earning</strong>, not on the reward&apos;s value. A higher level just
            means the member reaches the {coffeePoints} points <strong>faster</strong> — the coffee is still a{' '}
            £{COFFEE_PRICE.toFixed(2)} coffee to us either way.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Spends</th>
                  <th>Earns</th>
                  <th>Reward</th>
                  <th>Give-back</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base member</td>
                  <td>£{spendToEarn(1).toFixed(0)}</td>
                  <td>{coffeePoints} pts</td>
                  <td>£{COFFEE_PRICE.toFixed(2)}</td>
                  <td className={styles.pct}>{giveBackPct(1).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Ambassador (+50%)</td>
                  <td>£{spendToEarn(ambassador.boost).toFixed(0)}</td>
                  <td>{coffeePoints} pts</td>
                  <td>£{COFFEE_PRICE.toFixed(2)}</td>
                  <td className={styles.pct}>{giveBackPct(ambassador.boost).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            An Ambassador does cost us a touch more per pound they spend ({giveBackPct(ambassador.boost).toFixed(1)}% vs{' '}
            {giveBackPct(1).toFixed(1)}%) — but that&apos;s the whole point of the loyalty ladder, and it&apos;s a rounding
            error, not a runaway cost. It is <strong>never</strong> the reward&apos;s value multiplied by anything.
          </p>
          <p className={styles.aside}>
            When you set a reward&apos;s cost in admin, the £→points recommender pins{' '}
            <strong>cost = value × {POINTS_PER_POUND_VALUE}</strong> — so a £{COFFEE_PRICE.toFixed(2)} reward suggests{' '}
            {coffeePoints} points and you can never accidentally overspend.
          </p>
        </Section>
      </div>

      <div id="e">
        <Section icon="user" badge="E" title="Enrolling a partner">
          <ol className={styles.steps}>
            <li>Have the conversation — approach the partner and agree the reward or perk you&apos;ll offer.</li>
            <li>
              Agree the <strong>funding</strong>: is it their float (they pre-pay), Quarter-funded (we settle monthly),
              or our own inventory?
            </li>
            <li>
              In <strong>Admin → Partners → &ldquo;Add partner&rdquo;</strong>, enter their name, the reward/perk, the
              funding, and the initial float £ if they&apos;re pre-paying.
            </li>
            <li>
              Add their <strong>contact</strong> and <strong>bank details</strong> for payouts.
            </li>
          </ol>
          <div className={styles.note}>
            <Icon name="key" size={16} />
            <p>
              Bank details are stored <strong>privately</strong> for payouts only. They never appear on the partner&apos;s
              balance page, in any member-facing view, or in logs.
            </p>
          </div>
        </Section>
      </div>

      <div id="f">
        <Section icon="ticket" badge="F" title="Redemption & scanning">
          <ol className={styles.steps}>
            <li>A member spends their points on a reward in the app.</li>
            <li>
              They get a <strong>QR voucher</strong> on screen.
            </li>
            <li>
              Staff <strong>scan it at the till</strong> to honour it.
            </li>
            <li>
              The <strong>first scan</strong> is what records the redemption and, for funded rewards, draws the £ value
              from the partner&apos;s float. A reload or re-scan never charges twice.
            </li>
          </ol>
        </Section>
      </div>

      <div id="g">
        <Section icon="mail" badge="G" title="Partner visibility">
          <p>Partners are kept in the loop automatically — you don&apos;t have to chase anything:</p>
          <ul className={styles.bullets}>
            <li>
              They get an <strong>activity email</strong> each time a member redeems one of their rewards — with the
              reward, its £ value and their updated balance.
            </li>
            <li>
              They have a <strong>self-service balance link</strong> (no login) they can bookmark to watch their float and
              recent redemptions any time.
            </li>
            <li>
              The Quarter <strong>reconciles and pays monthly</strong> — partners don&apos;t need to invoice us.
            </li>
          </ul>
        </Section>
      </div>

      <div id="h">
        <Section icon="credit-card" badge="H" title="Payouts">
          <p>Two different mechanics, depending on funding:</p>
          <div className={styles.split}>
            <div className={styles.splitCard}>
              <h3 className={styles.h3}>Floats (partner-funded)</h3>
              <p>
                These <strong>draw down live</strong> as members redeem. Watch the status: <em>Healthy</em>,{' '}
                <em>Running low</em>, then <em>Spent</em>. When a float is running low, ask the partner to top it up.
                Nothing to pay — they&apos;re in credit with us.
              </p>
            </div>
            <div className={styles.splitCard}>
              <h3 className={styles.h3}>Quarter-funded</h3>
              <p>
                These show up in the <strong>monthly payout report</strong> as what we owe each partner. Pay it from the
                bank, then hit <strong>&ldquo;Mark as paid&rdquo;</strong> to clear the balance and reset the running
                total.
              </p>
            </div>
          </div>
        </Section>
      </div>

      <footer className={styles.footer}>
        <Link href="/admin" className={styles.footBtn}>
          <Icon name="arrow-left" size={16} />
          Back to Admin
        </Link>
        <Link href="/dashboard" className={styles.footLink}>
          Member dashboard
        </Link>
      </footer>
    </div>
  );
}
