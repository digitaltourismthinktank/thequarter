'use client';

import { useState } from 'react';
import { useMember } from './useMember';
import { isAdminEmail } from '@/lib/admin';
import { MemberShell } from './MemberShell';
import { RULE_FACTS, RULE_SECTIONS } from '@/lib/rulebook';
import styles from './RuleBookClient.module.css';

/**
 * /admin/rules — what the system does on its own.
 *
 * The point isn't documentation for its own sake. It turns "I think booking a room emails
 * ops" into a claim you can check, which is the only way to notice a missing email or an
 * automation that quietly stopped. Each row names the function it came from so anything
 * doubtful can be read at source rather than argued about.
 */
export function RuleBookClient() {
  const { loading, member } = useMember();
  const [q, setQ] = useState('');

  if (loading) return <MemberShell><p className={styles.state}>Loading…</p></MemberShell>;
  if (!isAdminEmail(member?.auth?.email)) {
    return <MemberShell><p className={styles.state}>This page is for the team.</p></MemberShell>;
  }

  const needle = q.trim().toLowerCase();
  const sections = !needle
    ? RULE_SECTIONS
    : RULE_SECTIONS.map((sec) => ({
        ...sec,
        rows: sec.rows.filter((r) =>
          [r.trigger, r.source, r.member, r.ops, r.push, r.records, r.points, r.notes]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(needle),
        ),
      })).filter((sec) => sec.rows.length);

  return (
    <MemberShell wide>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Admin</span>
        <h1 className={styles.h1}>What happens automatically</h1>
        <p className={styles.sub}>
          Every email, notification and record the system produces on its own. Each row names the function behind it.
          This is written by hand, so if you change what a function does, change its row too.
        </p>
      </header>

      <input
        className={styles.search}
        placeholder="Search — e.g. weekend, refund, pod, push"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search the rules"
      />

      <section className={styles.facts}>
        {RULE_FACTS.map((f) => (
          <div key={f.label} className={styles.fact}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </section>

      {sections.map((sec) => (
        <section key={sec.title} className={styles.section}>
          <h2 className={styles.h2}>{sec.title}</h2>
          {sec.blurb ? <p className={styles.blurb}>{sec.blurb}</p> : null}
          <div className={styles.rows}>
            {sec.rows.map((r) => (
              <article key={r.trigger} className={styles.row}>
                <div className={styles.rowHead}>
                  <h3 className={styles.trigger}>{r.trigger}</h3>
                  <code className={styles.source}>{r.source}</code>
                </div>
                <dl className={styles.effects}>
                  {r.member ? (<div><dt>Emails the member</dt><dd>{r.member}</dd></div>) : null}
                  {r.ops ? (<div><dt>Emails ops</dt><dd>{r.ops}</dd></div>) : null}
                  {r.push ? (<div><dt>Notification</dt><dd>{r.push}</dd></div>) : null}
                  {r.records ? (<div><dt>Records</dt><dd>{r.records}</dd></div>) : null}
                  {r.points ? (<div><dt>Points</dt><dd>{r.points}</dd></div>) : null}
                  {r.notes ? (<div className={styles.wide}><dt>Worth knowing</dt><dd>{r.notes}</dd></div>) : null}
                </dl>
              </article>
            ))}
          </div>
        </section>
      ))}

      {!sections.length ? <p className={styles.state}>Nothing matches “{q}”.</p> : null}
    </MemberShell>
  );
}
