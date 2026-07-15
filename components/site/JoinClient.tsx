'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { getMemberstack, memberstackError } from '@/lib/memberstack';
import { PLANS, PLAN_MEMBERSTACK_ID, PLAN_DAY_ALLOWANCE, type PlanId } from '@/lib/plans';
import { ANNUAL_PLANS } from '@/lib/rewards';
import { subscribeToPlan, saveProfile, registerReferral } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import { CompanyInput } from './CompanyInput';
import s from './WelcomeClient.module.css';
import pay from './RoomBooking.module.css';

/**
 * Native, in-site join flow (no Payment Links, no redirect to Stripe's hosted page):
 *   1. details  — email, name, monthly/annual → creates a Stripe subscription (server)
 *   2. pay      — Stripe Payment Element, confirmed in place (Apple Pay / card)
 *   3. account  — password + profile → Memberstack member, tagged plan + seeded days
 * The Stripe webhook syncs plan/days on invoice.paid; this creates the login the moment
 * payment succeeds, closing the pay-→-account gap the Payment Links left open.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

export function JoinClient({ plan }: { plan: string }) {
  const router = useRouter();
  const slug = plan as PlanId;
  const planDef = PLANS.find((p) => p.id === slug);
  const plnId = PLAN_MEMBERSTACK_ID[slug];
  const allowance = PLAN_DAY_ALLOWANCE[slug];
  const annualOnly = slug === 'hybrid-office';

  const [term, setTerm] = useState<'monthly' | 'annual'>(annualOnly ? 'annual' : 'monthly');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [bdayDay, setBdayDay] = useState('');
  const [bdayMonth, setBdayMonth] = useState('');
  const [company, setCompany] = useState('');
  const [agree, setAgree] = useState(false);
  const [startMode, setStartMode] = useState<'today' | 'date'>('today');
  const [startDate, setStartDate] = useState('');
  // Server decides the real mode from the (London-timezone) start date; 'setup' = future-dated
  // (save the card now, Stripe charges at the start date), 'payment' = charge now.
  const [payMode, setPayMode] = useState<'payment' | 'setup'>('payment');

  const [step, setStep] = useState<'details' | 'pay' | 'account'>('details');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const custRef = useRef<{ subscriptionId: string; customerId: string } | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  const termLabel = useMemo(() => (annualOnly ? 'billed annually' : term === 'annual' ? 'billed annually' : 'billed monthly'), [term, annualOnly]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const startLabel = useMemo(
    () => (startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : ''),
    [startDate],
  );

  // The price shown MUST match what Stripe charges for the selected term. Visitor/Resident/Citizen
  // annual totals live in ANNUAL_PLANS; Hybrid is annual-only and quoted per-month as a hook on the
  // Plans page (£42), so here we surface its real annual total. (Provisional figures — reconcile
  // with the live Stripe annual prices.)
  const HYBRID_ANNUAL = 504; // £42 × 12
  const annualTotal = ANNUAL_PLANS[slug]?.annual ?? (annualOnly ? HYBRID_ANNUAL : null);
  const showAnnual = annualOnly || term === 'annual';
  const displayPrice = showAnnual && annualTotal != null ? `£${annualTotal.toLocaleString('en-GB')}` : planDef?.price;
  const displayPeriod = showAnnual ? 'a year' : planDef?.period;

  // Step 1 → create the subscription server-side, then mount the Payment Element.
  async function toPayment() {
    setError(null);
    if (!isEmail(email.trim())) return setError('Please enter a valid email address.');
    if (startMode === 'date' && !startDate) return setError('Please choose a start date, or switch to “Start today”.');
    if (PREVIEW) return setError('Checkout runs on the live site — this is a preview.');
    setBusy(true);
    const startArg = startMode === 'date' && startDate ? startDate : undefined;
    const r = await subscribeToPlan({ plan: slug, term, email: email.trim().toLowerCase(), name: `${firstName} ${lastName}`.trim(), startDate: startArg });
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      const code = r.data?.error;
      setError(
        code === 'bad-email'
          ? 'Please enter a valid email address.'
          : code === 'already-subscribed'
            ? r.data?.message || 'You already have this membership — please sign in instead.'
            : 'We couldn’t start checkout just now — please try again.',
      );
      return;
    }
    // The server is the authority on whether this is future-dated (setup) or immediate (payment).
    setPayMode(r.data.mode === 'setup' ? 'setup' : 'payment');
    custRef.current = { subscriptionId: r.data.subscriptionId, customerId: r.data.customerId };
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
      setStep('details');
    }
  }

  // Step 2 → confirm in place. Future-dated (setup): save the card now, Stripe charges at the
  // start date. Today (payment): confirm the first-invoice PaymentIntent (charge now).
  async function payNow() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true);
    setError(null);
    if (payMode === 'setup') {
      const { error: setupErr, setupIntent } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      setBusy(false);
      if (setupErr) return setError(setupErr.message || 'We couldn’t save your card — please try again.');
      if (setupIntent && (setupIntent.status === 'succeeded' || setupIntent.status === 'processing')) setStep('account');
      else setError('That needs another step — please try again.');
      return;
    }
    const { error: payErr, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setBusy(false);
    if (payErr) return setError(payErr.message || 'That payment didn’t go through — please try again.');
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) setStep('account');
    else setError('Payment needs another step — please try again.');
  }

  // Step 3 → create the Memberstack account (payment already taken).
  async function createAccount() {
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!phone.trim()) return setError('Please add a phone number so we can reach you.');
    if (!agree) return setError('Please accept the Terms & Code of Conduct to continue.');
    setBusy(true);
    try {
      const ms = await getMemberstack();
      if (!ms) {
        setError('Sign-up is unavailable right now — please try again shortly.');
        setBusy(false);
        return;
      }
      const customFields: Record<string, string> = {};
      if (firstName) customFields['first-name'] = firstName;
      if (lastName) customFields['last-name'] = lastName;
      // Future-dated joins start with NO days until their start date; the Stripe webhook grants
      // the allowance when the first real invoice is taken at trial_end (subscription_cycle).
      if (allowance !== undefined)
        customFields['days-remaining'] = payMode === 'setup' ? '0' : allowance === null ? 'Unlimited' : String(allowance);
      await ms.signupMemberEmailPassword({
        email: email.trim().toLowerCase(),
        password,
        plans: plnId ? [{ planId: plnId }] : [],
        customFields,
        metaData: { termsAcceptedAt: new Date().toISOString(), phone: phone.trim(), stripeCustomerId: custRef.current?.customerId ?? '' },
      });
      const profile: { bday?: string; company?: string } = {};
      if (bdayDay && bdayMonth) {
        const mm = String(MONTHS.indexOf(bdayMonth) + 1).padStart(2, '0');
        const dd = String(Number(bdayDay)).padStart(2, '0');
        profile.bday = `${mm}-${dd}`;
      }
      if (company.trim()) profile.company = company.trim();
      if (profile.bday || profile.company) {
        try {
          await saveProfile(profile);
        } catch {
          /* non-blocking */
        }
      }
      try {
        const ref = window.localStorage.getItem('q_ref');
        if (ref) {
          await registerReferral(ref);
          window.localStorage.removeItem('q_ref');
        }
      } catch {
        /* non-blocking */
      }
      router.push('/dashboard');
    } catch (err) {
      setError(memberstackError(err));
      setBusy(false);
    }
  }

  if (!planDef) {
    return (
      <p className={s.state}>
        We couldn&rsquo;t find that plan. <a href="/plans">See plans</a>.
      </p>
    );
  }

  return (
    <div className={s.wrap}>
      <span className={s.eyebrow}>Join The Quarter</span>
      <h1 className={s.title}>
        {step === 'account'
          ? payMode === 'setup'
            ? 'Card saved — set up your login'
            : 'Payment received — set up your login'
          : `Join as ${planDef.name}`}
      </h1>
      <p className={s.sub}>
        {step === 'details' && <>The {planDef.name} plan — {displayPrice} · {displayPeriod}. Pay securely below; no accounts to create first.</>}
        {step === 'pay' &&
          (payMode === 'setup' && startLabel ? (
            <>You&rsquo;re joining {planDef.name} ({termLabel}). Starts {startLabel} — save your card now, nothing to pay today.</>
          ) : (
            <>You&rsquo;re joining {planDef.name} ({termLabel}). Pay by card or Apple Pay — you stay right here.</>
          ))}
        {step === 'account' &&
          (payMode === 'setup' ? (
            <>Your card is saved and your start date is booked. Create your login to reach your dashboard, door code, days and bookings.</>
          ) : (
            <>All done on payment. Create your login to reach your dashboard, door code, days and bookings.</>
          ))}
      </p>

      <div className={s.form}>
        {step === 'details' && (
          <>
            {!annualOnly && (
              <div className={s.field}>
                <span>Billing</span>
                <div className={pay.pkgRow}>
                  <button type="button" className={`${pay.pkg} ${term === 'monthly' ? pay.pkgOn : ''}`} onClick={() => setTerm('monthly')}>
                    Monthly
                  </button>
                  <button type="button" className={`${pay.pkg} ${term === 'annual' ? pay.pkgOn : ''}`} onClick={() => setTerm('annual')}>
                    Annual
                  </button>
                </div>
              </div>
            )}
            <label className={s.field}>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
            </label>
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
              <span>Company (optional)</span>
              <CompanyInput value={company} onChange={setCompany} placeholder="" />
            </label>
            <div className={s.field}>
              <span>Start date</span>
              <div className={pay.pkgRow}>
                <button type="button" className={`${pay.pkg} ${startMode === 'today' ? pay.pkgOn : ''}`} onClick={() => setStartMode('today')}>
                  Start today
                </button>
                <button type="button" className={`${pay.pkg} ${startMode === 'date' ? pay.pkgOn : ''}`} onClick={() => setStartMode('date')}>
                  Start on a date
                </button>
              </div>
            </div>
            {startMode === 'date' && (
              <label className={s.field}>
                <span>Choose your start date</span>
                <input type="date" value={startDate} min={todayStr} onChange={(e) => setStartDate(e.target.value)} />
              </label>
            )}
            {error ? <p className={s.error}>{error}</p> : null}
            <Button variant="primary" onClick={toPayment} disabled={busy}>
              {busy ? 'Starting checkout…' : 'Continue to payment'}
            </Button>
          </>
        )}

        {step === 'pay' && (
          <>
            <div className={pay.payBox}>
              <div ref={mountRef} className={pay.payEl} />
              {error ? <p className={s.error}>{error}</p> : null}
              <Button variant="primary" onClick={payNow} disabled={busy}>
                {busy
                  ? payMode === 'setup'
                    ? 'Saving your card…'
                    : 'Taking payment…'
                  : payMode === 'setup'
                    ? `Save card — starts ${startLabel}`
                    : `Pay — ${displayPrice}`}
              </Button>
              <p className={pay.secure}>
                {payMode === 'setup' ? <>Saved securely with Stripe · first payment on {startLabel}.</> : <>Paid securely with Stripe · Apple Pay &amp; cards.</>}
              </p>
            </div>
          </>
        )}

        {step === 'account' && (
          <>
            <label className={s.field}>
              <span>Email</span>
              <input type="email" value={email} readOnly autoComplete="email" />
            </label>
            <label className={s.field}>
              <span>Phone</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07700 900000" />
            </label>
            <label className={s.field}>
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </label>
            <div className={s.field}>
              <span>Birthday (optional)</span>
              <div className={s.row}>
                <select className={s.select} value={bdayDay} onChange={(e) => setBdayDay(e.target.value)} aria-label="Birthday day">
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select className={s.select} value={bdayMonth} onChange={(e) => setBdayMonth(e.target.value)} aria-label="Birthday month">
                  <option value="">Month</option>
                  {MONTHS.map((mo) => (
                    <option key={mo} value={mo}>
                      {mo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className={s.agree}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noreferrer">
                  Terms of Membership
                </a>{' '}
                &amp;{' '}
                <a href="/code-of-conduct" target="_blank" rel="noreferrer">
                  Code of Conduct
                </a>
                .
              </span>
            </label>
            {error ? <p className={s.error}>{error}</p> : null}
            <Button variant="primary" onClick={createAccount} disabled={busy || !agree}>
              {busy ? 'Creating your account…' : 'Create my account'}
            </Button>
          </>
        )}
      </div>

      <p className={s.alt}>
        {step === 'account' ? (
          <>
            <Icon name="check" size={14} color="var(--gold-700)" /> {payMode === 'setup' ? 'Card saved' : 'Payment complete'}
          </>
        ) : (
          <>
            Already a member? <a href="/login">Log in</a>.
          </>
        )}
      </p>
    </div>
  );
}
