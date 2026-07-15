'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { dayPassIntent } from '@/lib/booking';
import { Confirmation, signupHref } from './Confirmation';
import { DatePickerModal } from './DatePickerModal';
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

// Stripe.js can resolve before React has committed the 'pay'-step re-render (e.g. when
// Stripe.js is already cached), so the mount node may not exist yet. Wait briefly for it
// rather than throwing immediately on a null ref.
async function waitForNode(ref: { current: HTMLDivElement | null }): Promise<HTMLDivElement | null> {
  for (let i = 0; i < 40 && !ref.current; i++) await new Promise((r) => setTimeout(r, 16));
  return ref.current;
}

const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export function DayPassCheckout() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
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
    if (!firstName.trim() || !lastName.trim()) return setError('Please enter your name.');
    if (!isEmail(email.trim())) return setError('Please enter a valid email address.');
    if (!date) return setError('Please choose which day.');
    if (PREVIEW) return setError('Checkout runs on the live site — this is a preview.');
    setBusy(true);
    const r = await dayPassIntent({ firstName: firstName.trim(), lastName: lastName.trim(), company: company.trim(), email: email.trim().toLowerCase(), date });
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      setError(r.data?.error === 'bad-date' ? 'Please choose a valid day.' : 'We couldn’t start checkout just now — please try again.');
      return;
    }
    setStep('pay');
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
    const prettyDate = date
      ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return (
      <Confirmation
        eyebrow="Day Pass confirmed"
        title="Your day is reserved"
        intro={
          <>
            You’re all set for {prettyDate || 'your chosen day'}. Your day is already held against your email — no account needed to walk
            in. Just tell the team you have a Day Pass.
          </>
        }
        rows={[{ icon: 'ticket', label: 'Day Pass', value: prettyDate || '—' }]}
        amount="£21.60"
        email={email}
        account={{
          heading: 'Create your account',
          body: (
            <>
              Your day is booked either way. Create a free account with <strong>{email}</strong> to save it to your profile, and to unlock
              Quarter Rewards and room bookings for next time.
            </>
          ),
          cta: 'Create your account',
          href: signupHref(email),
        }}
        footnote={<>Breakfast, coffee and a desk are waiting on the 1st &amp; 2nd floors, 27–28 Burgate.</>}
      />
    );
  }

  return (
    <div className={s.form}>
      {step === 'form' ? (
        <>
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
          <div className={s.field}>
            <span>Which day?</span>
            <button type="button" className={pay.dateTrigger} onClick={() => setDateOpen(true)}>
              <Icon name="calendar" size={16} color="var(--gold-700)" />
              {date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' }) : 'Choose your day'}
            </button>
          </div>
          <DatePickerModal open={dateOpen} onClose={() => setDateOpen(false)} onPick={(d) => setDate(d)} single />
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
