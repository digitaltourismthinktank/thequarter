'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { getCarnet, useCarnetPass, carnetIntent, type CarnetState } from '@/lib/booking';
import { CARNET_BUNDLES, DAY_PASS_PRICE, carnetPerPass } from '@/lib/rewards';
import { PREVIEW } from '@/lib/devMock';
import styles from './CarnetCard.module.css';
import pay from './RoomBooking.module.css';

/** A book of day passes — bought in-site with Stripe's Payment Element (no Payment Links).
 *  The carnet webhook tops up the member's balance on payment_intent.succeeded. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stripePromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadStripe(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const w = window as unknown as { Stripe?: (k: string) => unknown };
  if (w.Stripe) return Promise.resolve(w.Stripe(STRIPE_PUBLISHABLE_KEY));
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://js.stripe.com/v3/';
      el.async = true;
      el.onload = () => resolve(w.Stripe ? w.Stripe(STRIPE_PUBLISHABLE_KEY) : null);
      el.onerror = () => reject(new Error('stripe-load-failed'));
      document.head.appendChild(el);
    });
  }
  return stripePromise;
}

// Stripe.js can resolve before React has committed the re-render that mounts the payment
// field (e.g. when Stripe.js is already cached), so the mount node may not exist yet. Wait
// briefly for it rather than throwing immediately on a null ref.
async function waitForNode(ref: { current: HTMLDivElement | null }): Promise<HTMLDivElement | null> {
  for (let i = 0; i < 40 && !ref.current; i++) await new Promise((r) => setTimeout(r, 16));
  return ref.current;
}

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
  const [carnet, setCarnet] = useState<CarnetState>({ remaining: 0, total: 0, expires: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [buying, setBuying] = useState<number | null>(null); // passes currently being purchased
  const [payErr, setPayErr] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  async function refresh() {
    const r = await getCarnet();
    if (r.ok) setCarnet(r.data.carnet);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function useOne() {
    setBusy(true);
    setMsg(null);
    const r = await useCarnetPass();
    if (r.ok) {
      setCarnet(r.data.carnet);
      setMsg('Checked in with a day pass');
    } else {
      setMsg(friendly(r.data?.error));
    }
    setBusy(false);
  }

  async function startBuy(passes: number) {
    setPayErr(null);
    setMsg(null);
    if (PREVIEW) {
      setMsg('Checkout runs on the live site — this is a preview.');
      return;
    }
    setBusy(true);
    const r = await carnetIntent(passes);
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      setPayErr('We couldn’t start checkout just now — please try again.');
      return;
    }
    setBuying(passes);
    try {
      const stripe = await loadStripe();
      const node = await waitForNode(mountRef);
      if (!stripe || !node) throw new Error('stripe');
      stripeRef.current = stripe;
      const elements = stripe.elements({ clientSecret: r.data.clientSecret, appearance: { theme: 'flat' } });
      const payEl = elements.create('payment', { layout: 'tabs' });
      payEl.mount(node);
      elementsRef.current = elements;
    } catch {
      setPayErr('Couldn’t load the secure payment form — please try again.');
      setBuying(null);
    }
  }

  async function payNow() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true);
    setPayErr(null);
    const { error, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setBusy(false);
    if (error) return setPayErr(error.message || 'That payment didn’t go through — please try again.');
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      setBuying(null);
      setMsg('Thanks — your passes are being added. This can take a moment to show.');
      // The webhook top-up can lag a moment, so poll briefly.
      let n = 0;
      const t = setInterval(async () => {
        const r = await getCarnet();
        if (r.ok) setCarnet(r.data.carnet);
        if ((n += 1) >= 5) clearInterval(t);
      }, 2500);
    } else {
      setPayErr('Payment needs another step — please try again.');
    }
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

      {carnet.remaining > 0 && buying === null ? (
        <div className={styles.useRow}>
          <Button variant="secondary" size="sm" onClick={useOne} disabled={busy}>
            {busy ? 'One moment…' : 'Use one for today'}
          </Button>
        </div>
      ) : null}

      {buying === null ? (
        <div className={styles.bundles}>
          {CARNET_BUNDLES.map((b) => (
            <div key={b.passes} className={`${styles.bundle} ${b.bestValue ? styles.best : ''}`}>
              {b.bestValue ? <span className={styles.bestTag}>Best value</span> : null}
              <strong className={styles.bundlePasses}>{b.passes} passes</strong>
              <span className={styles.bundlePrice}>{gbp(b.price)}</span>
              <span className={styles.bundlePer}>{gbp(carnetPerPass(b))}/pass</span>
              <button type="button" className={styles.buy} onClick={() => startBuy(b.passes)} disabled={busy}>
                Buy
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={pay.payBox}>
          <p className={styles.body}>Buying {buying} day passes · {gbp(CARNET_BUNDLES.find((b) => b.passes === buying)?.price ?? 0)}</p>
          <div ref={mountRef} className={pay.payEl} />
          {payErr ? <p className={styles.msg}>{payErr}</p> : null}
          <Button variant="accent" size="sm" onClick={payNow} disabled={busy}>
            {busy ? 'Taking payment…' : 'Pay now'}
          </Button>
          <button type="button" className={styles.buyOff} onClick={() => setBuying(null)} disabled={busy}>
            Cancel
          </button>
          <p className={pay.secure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
        </div>
      )}

      <p className={styles.single}>A single day pass is {gbp(DAY_PASS_PRICE)} — the book works out cheaper per day.</p>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
