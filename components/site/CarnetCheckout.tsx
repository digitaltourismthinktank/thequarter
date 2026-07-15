'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { carnetIntentPublic } from '@/lib/booking';
import { CARNET_BUNDLES, carnetPerPass } from '@/lib/rewards';
import { PREVIEW } from '@/lib/devMock';
import s from './WelcomeClient.module.css';
import pay from './RoomBooking.module.css';

/**
 * Public day-pass carnet checkout — buy a book of 10 or 30 passes in-site with Stripe's
 * Payment Element (Apple Pay / card), no account needed to pay. On success we send the
 * buyer to /signup to create their account; the Stripe webhook then credits the passes
 * into their wallet (it retries until an account with this email exists). Mirrors
 * DayPassCheckout's structure, loadStripe pattern and CSS classes.
 */

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

const gbp = (n: number) => `£${n.toFixed(2)}`;
const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// Default to the best-value bundle (30), falling back to the first if none is flagged.
const DEFAULT_PASSES = (CARNET_BUNDLES.find((b) => b.bestValue) ?? CARNET_BUNDLES[0]).passes;

export function CarnetCheckout() {
  const [passes, setPasses] = useState<number>(DEFAULT_PASSES);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  const bundle = CARNET_BUNDLES.find((b) => b.passes === passes) ?? CARNET_BUNDLES[0];

  async function toPayment() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError('Please enter your name.');
    if (!isEmail(email.trim())) return setError('Please enter a valid email address.');
    if (PREVIEW) return setError('Checkout runs on the live site — this is a preview.');
    setBusy(true);
    const r = await carnetIntentPublic({
      passes,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      email: email.trim().toLowerCase(),
    });
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      setError(r.data?.error === 'bad-bundle' ? 'Please choose a valid bundle.' : 'We couldn’t start checkout just now — please try again.');
      return;
    }
    setStep('pay');
    try {
      const stripe = await loadStripe();
      if (!stripe || !mountRef.current) throw new Error('stripe');
      stripeRef.current = stripe;
      const elements = stripe.elements({ clientSecret: r.data.clientSecret, appearance: { theme: 'flat' } });
      const payEl = elements.create('payment', { layout: 'tabs' });
      payEl.mount(mountRef.current);
      elementsRef.current = elements;
    } catch {
      setError('Couldn’t load the secure payment form — please try again.');
      setStep('form');
    }
  }

  async function payNow() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true);
    setError(null);
    const { error: payErr, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setBusy(false);
    if (payErr) return setError(payErr.message || 'That payment didn’t go through — please try again.');
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) setStep('done');
    else setError('Payment needs another step — please try again.');
  }

  if (step === 'done') {
    return (
      <div className={pay.done}>
        <span className={pay.doneIcon}>
          <Icon name="check" size={26} color="var(--gold-700)" />
        </span>
        <h3 className={pay.doneTitle}>Payment complete</h3>
        <p className={pay.doneText}>
          Your {passes} day passes are paid. Now create your account with <strong>{email}</strong> so your passes land in your wallet — we
          add them automatically once you’re set up.
        </p>
        <div style={{ marginTop: 18 }}>
          <Button variant="accent" href="/signup" iconAfter="arrow-right">
            Create your account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.form}>
      {step === 'form' ? (
        <>
          <div className={s.field}>
            <span>How many passes?</span>
            <div className={pay.pkgRow}>
              {CARNET_BUNDLES.map((b) => (
                <button
                  key={b.passes}
                  type="button"
                  className={`${pay.pkg} ${b.passes === passes ? pay.pkgOn : ''}`}
                  onClick={() => setPasses(b.passes)}
                >
                  {b.passes} passes · {gbp(b.price)}
                  {b.bestValue ? ' · Best value' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className={s.row}>
            <label className={s.field}>
              <span>First name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </label>
            <label className={s.field}>
              <span>Last name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </label>
          </div>
          <label className={s.field}>
            <span>Company</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
          </label>
          <label className={s.field}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
          </label>
          {error ? <p className={s.error}>{error}</p> : null}
          <Button variant="accent" onClick={toPayment} disabled={busy}>
            {busy ? 'Starting…' : `Continue to payment · ${gbp(bundle.price)}`}
          </Button>
          <p className={s.hint}>
            {bundle.passes} day passes · {gbp(carnetPerPass(bundle))}/pass · valid 12 months. Prices include VAT.
          </p>
        </>
      ) : (
        <div className={pay.payBox}>
          <p className={s.hint}>
            Buying {passes} day passes · {gbp(bundle.price)}
          </p>
          <div ref={mountRef} className={pay.payEl} />
          {error ? <p className={s.error}>{error}</p> : null}
          <Button variant="accent" onClick={payNow} disabled={busy}>
            {busy ? 'Taking payment…' : `Pay ${gbp(bundle.price)}`}
          </Button>
          <p className={pay.secure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
        </div>
      )}
    </div>
  );
}
