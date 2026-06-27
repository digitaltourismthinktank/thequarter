'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { getCarnet, useCarnetPass, type CarnetState } from '@/lib/booking';
import { CARNET_BUNDLES, DAY_PASS_PRICE, carnetPerPass } from '@/lib/rewards';
import { useMember } from './useMember';
import styles from './CarnetCard.module.css';

/** Stripe Payment Links per bundle (env overrides the live defaults). */
const CARNET_LINKS: Record<number, string | undefined> = {
  10: process.env.NEXT_PUBLIC_STRIPE_CARNET_10_URL || 'https://buy.stripe.com/dRm006aGyb8QcbUfwl2B21u',
  30: process.env.NEXT_PUBLIC_STRIPE_CARNET_30_URL || 'https://buy.stripe.com/bJeaEKg0Sb8Q1xg4RH2B21v',
};
const buyUrl = (passes: number, email?: string | null) => {
  const base = CARNET_LINKS[passes];
  if (!base) return undefined;
  return email ? `${base}?prefilled_email=${encodeURIComponent(email)}` : base;
};
const gbp = (n: number) => `£${n.toFixed(2)}`;

function friendly(code?: string): string {
  switch (code) {
    case 'no-passes':
      return 'No passes left — buy a book below.';
    case 'expired':
      return 'Your passes have expired.';
    case 'already-in':
      return 'You’re already checked in today.';
    case 'closed-weekend':
    case 'closed-day':
      return 'The Quarter is closed that day.';
    default:
      return 'Something went wrong — please try again.';
  }
}

export function CarnetCard() {
  const { member } = useMember();
  const email = member?.auth?.email || null;
  const [carnet, setCarnet] = useState<CarnetState>({ remaining: 0, total: 0, expires: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  async function refresh() {
    const r = await getCarnet();
    if (r.ok) setCarnet(r.data.carnet);
  }
  useEffect(() => {
    refresh();
  }, []);
  // Returning from a carnet purchase — the webhook top-up can lag a moment, so poll briefly.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('carnet') !== 'thanks') return;
    setThanks(true);
    let n = 0;
    const t = setInterval(async () => {
      const r = await getCarnet();
      if (r.ok) setCarnet(r.data.carnet);
      if ((n += 1) >= 4) clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  async function useOne() {
    setBusy(true);
    setMsg(null);
    const r = await useCarnetPass();
    if (r.ok) {
      setCarnet(r.data.carnet);
      setMsg('Checked in with a day pass ✓');
    } else {
      setMsg(friendly(r.data?.error));
    }
    setBusy(false);
  }

  const pct = carnet.total > 0 ? Math.round((carnet.remaining / carnet.total) * 100) : 0;
  const validUntil = carnet.expires
    ? new Date(`${carnet.expires}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Day passes</span>
      <h2 className={styles.title}>A book of day passes</h2>
      <p className={styles.body}>For days your plan doesn&rsquo;t cover, or to sign a friend in. Valid 12 months, use as you like.</p>
      {thanks ? <p className={styles.thanks}>Thanks — your passes are being added. This can take a moment to show.</p> : null}

      <div className={styles.balanceRow}>
        <div className={styles.balance}>
          <strong>{carnet.remaining}</strong>
          <span> of {carnet.total} left</span>
        </div>
        {validUntil ? <span className={styles.valid}>Valid until {validUntil}</span> : null}
      </div>
      {carnet.total > 0 ? (
        <div className={styles.meter}>
          <span style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      {carnet.remaining > 0 ? (
        <div className={styles.useRow}>
          <Button variant="secondary" size="sm" onClick={useOne} disabled={busy}>
            {busy ? 'One moment…' : 'Use one for today'}
          </Button>
        </div>
      ) : null}

      <div className={styles.bundles}>
        {CARNET_BUNDLES.map((b) => {
          const url = buyUrl(b.passes, email);
          return (
            <div key={b.passes} className={`${styles.bundle} ${b.bestValue ? styles.best : ''}`}>
              {b.bestValue ? <span className={styles.bestTag}>Best value</span> : null}
              <strong className={styles.bundlePasses}>{b.passes} passes</strong>
              <span className={styles.bundlePrice}>{gbp(b.price)}</span>
              <span className={styles.bundlePer}>{gbp(carnetPerPass(b))}/pass</span>
              {url ? (
                <a className={styles.buy} href={url}>
                  Buy
                </a>
              ) : (
                <span className={styles.buyOff}>Ask us</span>
              )}
            </div>
          );
        })}
      </div>
      <p className={styles.single}>A single day pass is {gbp(DAY_PASS_PRICE)} — the book works out cheaper per day.</p>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
