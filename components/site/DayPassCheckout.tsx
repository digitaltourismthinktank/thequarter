'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { dayPassIntent } from '@/lib/booking';
import { Confirmation, signupHref } from './Confirmation';
import { DatePickerModal } from './DatePickerModal';
import { PREVIEW } from '@/lib/devMock';
import s from './WelcomeClient.module.css';
import pay from './RoomBooking.module.css';
import dp from '@/app/day-pass/day-pass.module.css';

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

// We open at 9am. Arrivals can be requested from 08:00; anything before 09:00 is an
// out-of-hours REQUEST (booked anyway, flagged for staff to confirm). 30-min steps to 17:30.
const OPEN_TIME = '09:00';
const ARRIVAL_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let m = 8 * 60; m <= 17 * 60 + 30; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
})();

export function DayPassCheckout() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [arrival, setArrival] = useState('09:00');
  const [arrivalOpen, setArrivalOpen] = useState(false);
  // Times sort correctly as zero-padded 'HH:MM' strings, so a plain compare flags pre-open.
  const outOfHours = arrival < OPEN_TIME;
  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TEST COMP: a secret ?test=<code> in the URL routes to the server's env-gated comp path
  // (skips Stripe, £0). SSR-guarded — read only in the browser. Absent for normal users.
  const [testCode, setTestCode] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('test');
    if (t) setTestCode(t);
  }, []);

  // Walk-in (reception QR → /day-pass?walkin=1): they're standing at the door NOW, so pre-fill
  // today's date and round the arrival to the current half-hour. They can still change either.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('walkin') !== '1' && p.get('today') !== '1') return;
    const d = new Date();
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    const mins = Math.min(Math.max(d.getHours() * 60 + d.getMinutes(), 8 * 60), 17 * 60 + 30);
    const rm = mins % 60 < 30 ? 0 : 30;
    setArrival(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(rm).padStart(2, '0')}`);
  }, []);

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
    const r = await dayPassIntent({ firstName: firstName.trim(), lastName: lastName.trim(), company: company.trim(), email: email.trim().toLowerCase(), date, arrival, test: testCode || undefined });
    setBusy(false);
    // TEST COMP: server skipped Stripe and already recorded + emailed — jump straight to done.
    if (r.ok && r.data.comped === true) return setStep('done');
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
            You’re all set for {prettyDate || 'your chosen day'}, arriving around {arrival}
            {outOfHours ? ' (requested — we’ll confirm this early start with you)' : ''}. Your day is already held against your email — no
            account needed to walk in. Just tell the team you have a Day Pass.
          </>
        }
        rows={[
          { icon: 'ticket', label: 'Day Pass', value: prettyDate || '—' },
          { icon: 'clock', label: 'Arrival', value: outOfHours ? `${arrival} · requested — pending confirmation` : arrival },
        ]}
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
          href: signupHref(email, { firstName, lastName, phone }),
        }}
        footnote={
          <>
            Breakfast, coffee and a desk are waiting on the 1st &amp; 2nd floors, 27–28 Burgate. Need somewhere private for a
            call or a meeting? <a href="/meeting-rooms">Book a phone pod or a room by the hour ›</a>
          </>
        }
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
            <span>Contact number</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07700 900000" />
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
          <div className={s.field}>
            <span>Arrival time</span>
            <button type="button" className={pay.dateTrigger} onClick={() => setArrivalOpen(true)}>
              <Icon name="clock" size={16} color="var(--gold-700)" />
              {arrival}
              {outOfHours ? <span className={dp.timeReqPill}>by request</span> : null}
            </button>
            {outOfHours ? (
              <p className={dp.arrivalNote}>That’s before we open at 9am — we’ll book it as a request and confirm with you.</p>
            ) : null}
          </div>
          {arrivalOpen ? (
            <div className={dp.timeOverlay} role="dialog" aria-modal="true" aria-label="Choose an arrival time" onClick={() => setArrivalOpen(false)}>
              <div className={dp.timeModal} onClick={(e) => e.stopPropagation()}>
                <div className={dp.timeHead}>
                  <span className={dp.timeTitle}>Arrival time</span>
                  <span className={dp.timeSub}>We open at 9am</span>
                </div>
                <div className={dp.timeList}>
                  {ARRIVAL_TIMES.map((t) => {
                    const req = t < OPEN_TIME;
                    const sel = t === arrival;
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`${dp.timeOpt} ${sel ? dp.timeOptSel : ''} ${req ? dp.timeOptReq : ''}`}
                        onClick={() => {
                          setArrival(t);
                          setArrivalOpen(false);
                        }}
                      >
                        <span>{t}</span>
                        {req ? <span className={dp.timeReqTag}>before we open — by request</span> : null}
                      </button>
                    );
                  })}
                </div>
                <p className={dp.timeFoot}>Pick when you plan to arrive. Anything before 9am is booked as a request and confirmed with you.</p>
              </div>
            </div>
          ) : null}
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
