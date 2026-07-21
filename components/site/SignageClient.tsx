'use client';

import { useEffect, useState } from 'react';
import { Qr } from '@/components/ds/Qr';
import { Icon } from '@/components/ds/Icon';
import styles from './SignageClient.module.css';

/**
 * Printable signage set — a small kit staff can send to the ordinary office printer. Each
 * sheet is A4; "Print this" isolates one sheet, "Print all" sends the lot (one per page). The
 * QR codes point at the LIVE site (thequarter.work) so a printed sign works regardless of where
 * this page is viewed. On-screen controls never print (hidden in the print stylesheet).
 *
 * Design: each poster LEADS with the reason to act (the benefits), not the QR. The code sits in
 * a quiet strip at the foot — a way in, not the headline. Brand gold + ink over warm paper.
 */

const SITE = 'https://thequarter.work';

interface Poster {
  id: string;
  kind: 'poster' | 'card';
  eyebrow: string;
  title: string;
  lead: string;
  benefits: string[];
  note?: { title: string; body: string };
  qr: string;
  scan: string;
  foot?: string;
}

const POSTERS: Poster[] = [
  {
    id: 'checkin',
    kind: 'poster',
    eyebrow: 'Members',
    title: 'Make every day count',
    lead: 'A two-second check-in when you arrive — and it pays you back.',
    benefits: [
      'Earn Quarter Rewards points every day you’re in',
      'Double points on our quietest days',
      'Counted for the day — no need to sign in twice',
    ],
    note: {
      title: 'Check in in one tap',
      body: 'Add The Quarter to your phone: open thequarter.work, tap Share → “Add to Home Screen”. It opens straight to your check-in.',
    },
    qr: `${SITE}/arrive`,
    scan: 'Scan to check in now',
    foot: 'No phone handy? The iPad at reception checks you in by name.',
  },
  {
    id: 'rewards',
    kind: 'poster',
    eyebrow: 'Quarter Rewards',
    title: 'The more you’re here, the more you get',
    lead: 'It builds quietly in the background. You just keep coming in.',
    benefits: [
      'Points for every check-in and every booking',
      'A little treat on your birthday',
      'Perks from independents right across Canterbury',
      'Climb the tiers — the rewards grow as you do',
    ],
    qr: `${SITE}/rewards`,
    scan: 'Scan to see what’s yours',
    foot: 'Members collect automatically — nothing to sign up for.',
  },
  {
    id: 'guest',
    kind: 'poster',
    eyebrow: 'Visiting today?',
    title: 'Welcome — please sign in',
    lead: 'So we know who’s in the building, and your host knows you’ve arrived.',
    benefits: [
      'Takes about ten seconds',
      'Your host is notified the moment you sign in',
      'The coffee’s on us while you settle in',
    ],
    qr: `${SITE}/reception`,
    scan: 'Scan, or use the iPad at the front desk',
    foot: 'Here for a day’s work instead? Ask us about a Day Pass.',
  },
  {
    id: 'counter',
    kind: 'card',
    eyebrow: 'Welcome to The Quarter',
    title: 'Checking in?',
    lead: 'Members check in · guests sign in · everyone’s coffee is on us.',
    benefits: [],
    qr: `${SITE}/reception`,
    scan: 'Point your camera here',
    foot: 'Ask us anything — we’re right here.',
  },
];

export function SignageClient() {
  const [only, setOnly] = useState<string | null>(null);

  useEffect(() => {
    const after = () => setOnly(null);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, []);

  function printOne(id: string) {
    setOnly(id);
    setTimeout(() => window.print(), 50);
  }
  function printAll() {
    setOnly(null);
    setTimeout(() => window.print(), 50);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div>
          <strong className={styles.controlsTitle}>Signage</strong>
          <span className={styles.controlsHint}>Print on the office printer — A4, one per page. QR codes go to the live site.</span>
        </div>
        <button type="button" className={styles.printAll} onClick={printAll}>Print all</button>
      </div>

      <div className={styles.sheets}>
        {POSTERS.map((p) => (
          <div key={p.id} className={`${styles.sheetHolder} ${only && only !== p.id ? styles.hiddenInPrint : ''}`}>
            <div className={styles.sheetTools}>
              <span className={styles.sheetLabel}>{p.kind === 'card' ? 'Counter card' : 'A4 poster'} · {p.title}</span>
              <button type="button" className={styles.printOne} onClick={() => printOne(p.id)}>Print this</button>
            </div>

            <div className={`${styles.sheet} ${p.kind === 'card' ? styles.sheetCard : ''}`}>
              <article className={`${styles.poster} ${p.kind === 'card' ? styles.card : ''}`}>
                <header className={styles.head}>
                  <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
                  <span className={styles.eyebrow}>{p.eyebrow}</span>
                </header>

                <div className={styles.mid}>
                  <h1 className={styles.title}>{p.title}</h1>
                  <p className={styles.lead}>{p.lead}</p>

                  {p.benefits.length ? (
                    <ul className={styles.benefits}>
                      {p.benefits.map((b) => (
                        <li key={b}>
                          <span className={styles.tick}><Icon name="check" size={16} color="var(--gold-700)" /></span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {p.note ? (
                    <div className={styles.note}>
                      <strong>{p.note.title}</strong>
                      <span>{p.note.body}</span>
                    </div>
                  ) : null}
                </div>

                <footer className={styles.scanStrip}>
                  <Qr value={p.qr} size={p.kind === 'card' ? 128 : 150} />
                  <div className={styles.scanText}>
                    <strong>{p.scan}</strong>
                    {p.foot ? <span>{p.foot}</span> : null}
                  </div>
                </footer>
              </article>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
