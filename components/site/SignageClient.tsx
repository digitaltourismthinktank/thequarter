'use client';

import { useEffect, useState } from 'react';
import { Qr } from '@/components/ds/Qr';
import styles from './SignageClient.module.css';

/**
 * Printable signage set — a small kit staff can send to the ordinary office printer. Each
 * sheet is A4; "Print this" isolates one sheet, "Print all" sends the lot (one per page). The
 * QR codes point at the LIVE site (thequarter.work) so a printed sign works regardless of where
 * this page is viewed. On-screen controls never print (hidden in the print stylesheet).
 */

const SITE = 'https://thequarter.work';

interface Poster {
  id: string;
  kind: 'poster' | 'card';
  eyebrow: string;
  title: string;
  body: string;
  qr: string;
  scan: string;
  foot: string;
}

const POSTERS: Poster[] = [
  {
    id: 'checkin',
    kind: 'poster',
    eyebrow: 'The Quarter',
    title: 'Welcome back',
    body: 'Members — check in for the day. Scan to mark yourself in.',
    qr: `${SITE}/arrive`,
    scan: 'Scan with your phone camera',
    foot: 'No phone handy? The iPad at reception will check you in by name.',
  },
  {
    id: 'guest',
    kind: 'poster',
    eyebrow: 'Visiting today?',
    title: 'Please sign in',
    body: 'So we know who’s in the building — and your host knows you’ve arrived.',
    qr: `${SITE}/reception`,
    scan: 'Scan to sign in',
    foot: 'Or tap “I’m a guest” on the iPad at the front desk.',
  },
  {
    id: 'rewards',
    kind: 'poster',
    eyebrow: 'Quarter Rewards',
    title: 'Every day here earns you something',
    body: 'Points for checking in, a treat on your birthday, and perks all around Canterbury.',
    qr: `${SITE}/rewards`,
    scan: 'Scan to see what’s yours',
    foot: 'Members collect automatically — just keep coming in.',
  },
  {
    id: 'counter',
    kind: 'card',
    eyebrow: 'Welcome to The Quarter',
    title: 'Checking in?',
    body: 'Members scan to check in · guests scan to sign in.',
    qr: `${SITE}/reception`,
    scan: 'Point your camera here',
    foot: 'Coffee’s on us — ask us anything.',
  },
];

export function SignageClient() {
  const [only, setOnly] = useState<string | null>(null);

  // Clear the "print one" isolation once the print dialog closes, so the screen shows all again.
  useEffect(() => {
    const after = () => setOnly(null);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, []);

  function printOne(id: string) {
    setOnly(id);
    // Let the class apply before the (synchronous) print dialog reads styles.
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
              <div className={`${styles.poster} ${p.kind === 'card' ? styles.card : ''}`}>
                <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />
                <span className={styles.eyebrow}>{p.eyebrow}</span>
                <h1 className={styles.title}>{p.title}</h1>
                <p className={styles.body}>{p.body}</p>
                <div className={styles.qrBox}>
                  <Qr value={p.qr} size={p.kind === 'card' ? 150 : 260} />
                  <span className={styles.scan}>{p.scan}</span>
                </div>
                <p className={styles.foot}>{p.foot}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
