import type { ReactNode } from 'react';
import { Section } from './primitives';
import styles from './Legal.module.css';

/** Shared wrapper for the legal pages — Privacy, Terms, Code of Conduct. */
export function Legal({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <Section tone="page">
      <article className={styles.legal}>
        <span className={styles.eyebrow}>The Quarter</span>
        <h1 className={styles.title}>{title}</h1>
        {updated ? <p className={styles.updated}>{updated}</p> : null}
        {children}
      </article>
    </Section>
  );
}
