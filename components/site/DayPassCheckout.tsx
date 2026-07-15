'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { dayPassIntent } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import s from './WelcomeClient.module.css';
import pay from './RoomBooking.module.css';

/**
 * Native Day Pass checkout — £21.60, paid in-site with Stripe's Payment Element
 * (Apple Pay / card). Replaces the legacy Typeform. On success the Stripe webhook
 * records the pass + emails the confirmation; no account needed for a guest day.
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

const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export function DayPassCheckout() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  async function toPayment() {
    setError(null);
    if (!name.trim()) return setError('Please enter your name.');
    if (!isEmail(email.trim())) return setError('Please enter a valid email address.');
    if (!date) return setError('Please choose which day.');
    if (PREVIEW) return setError('Checkout runs on the live site — this is a preview.');
    setBusy(true);
    const r = await dayPassIntent({ name: name.trim(), email: email.trim().toLowerCase(), date });
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      setError(r.data?.error === 'bad-date' ? 'Please choose a valid day.' : 'We couldn’t start checkout just now — please try again.');
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
        <h3 className={pay.doneTitle}>You’re booked in</h3>
        <p className={pay.doneText}>
          Your Day Pass for {date} is paid. We’ve emailed the details to {email} — see you then. Breakfast is on us.
        </p>
      </div>
    );
  }

  return (
    <div className={s.form}>
      {step === 'form' ? (
        <>
          <label className={s.field}>
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className={s.field}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
          </label>
          <label className={s.field}>
            <span>Which day?</span>
            <input type="date" value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} />
          </label>
          {error ? <p className={s.error}>{error}</p> : null}
          <Button variant="accent" onClick={toPayment} disabled={busy}>
            {busy ? 'Starting…' : 'Continue to payment · £21.60'}
          </Button>
        </>
      ) : (
        <div className={pay.payBox}>
          <div ref={mountRef} className={pay.payEl} />
          {error ? <p className={s.error}>{error}</p> : null}
          <Button variant="accent" onClick={payNow} disabled={busy}>
            {busy ? 'Taking payment…' : 'Pay £21.60'}
          </Button>
          <p className={pay.secure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
        </div>
      )}
    </div>
  );
}
