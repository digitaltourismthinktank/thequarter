'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { getSpaces, roomIntent, roomMemberStatus, roomMemberFree, type RoomQuoteLine, type RoomMemberStatus } from '@/lib/booking';
import { useMember } from './useMember';
import { PREVIEW } from '@/lib/devMock';
import styles from './RoomBooking.module.css';

/**
 * Native meeting-room booking. A logged-in member books free up to their monthly
 * hours cap (the two main rooms; pods are free elsewhere); non-members — and members
 * over their cap — pay by card / Apple Pay via Stripe's Payment Element. Price is a
 * client estimate; the server recomputes the authoritative amount + enforces the cap.
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
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.async = true;
      s.onload = () => resolve(w.Stripe ? w.Stripe(STRIPE_PUBLISHABLE_KEY) : null);
      s.onerror = () => reject(new Error('stripe-load-failed'));
      document.head.appendChild(s);
    });
  }
  return stripePromise;
}

const QUIET_DAYS = [1, 3, 5];
const LUNCH_PER_HEAD = 12;
const PACKAGES = [
  { id: 'am', label: 'Morning · 09:00–13:00', span: 'half' as const, hours: 4 },
  { id: 'pm', label: 'Afternoon · 13:30–17:30', span: 'half' as const, hours: 4 },
  { id: 'full', label: 'Full day · 09:00–17:30', span: 'full' as const, hours: 8.5 },
];

const money = (n: number) => `£${n.toFixed(2)}`;
const norm = (s: string) => s.toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();

const ERRORS: Record<string, string> = {
  'slot-taken': 'That slot has just been taken — please pick another.',
  weekend: 'Meeting rooms are bookable Monday to Friday.',
  'closed-day': 'We’re closed that day — please pick another date.',
  'cap-exceeded': 'That would take you over your free hours this month — you can still book it below and pay.',
  'bad-email': 'Please enter a valid email address.',
  'missing-company': 'Please add the company or organisation name.',
  'no-space': 'This room isn’t bookable online just now — please enquire below.',
  'not-configured': 'Online booking is being set up — please enquire below for now.',
};

export function RoomBooking({ roomName, price }: { roomName: string; price: { half: number; full: number } }) {
  const { member } = useMember();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [status, setStatus] = useState<RoomMemberStatus | null>(null);

  const [date, setDate] = useState('');
  const [pkg, setPkg] = useState('am');
  const [people, setPeople] = useState(4);
  const [lunch, setLunch] = useState(false);
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [freeDone, setFreeDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverLines, setServerLines] = useState<RoomQuoteLine[] | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  // Resolve this marketing room to its bookable Airtable space (match by name).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getSpaces();
      if (cancelled) return;
      const match = r.ok ? r.data.spaces.find((s) => norm(s.name) === norm(roomName)) : null;
      setSpaceId(match?.id ?? null);
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName]);

  // Member's free-hours status for the selected month.
  useEffect(() => {
    if (!member || PREVIEW) return;
    let cancelled = false;
    (async () => {
      const r = await roomMemberStatus(date || undefined);
      if (!cancelled && r.ok) setStatus(r.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [member, date]);

  const pkgDef = PACKAGES.find((p) => p.id === pkg)!;
  const span = pkgDef.span;
  const est = useMemo(() => {
    let hire = span === 'full' ? price.full : price.half;
    const dow = date ? new Date(`${date}T00:00:00`).getDay() : -1;
    const quiet = QUIET_DAYS.includes(dow);
    if (quiet) hire = Math.round(hire * 0.8 * 100) / 100;
    const lunchTotal = lunch ? Math.max(1, people) * LUNCH_PER_HEAD : 0;
    return { hire, quiet, lunchTotal, total: Math.round((hire + lunchTotal) * 100) / 100 };
  }, [span, price, date, lunch, people]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // A member is booking free when they have enough free hours left for this package.
  const freeEligible = !!member && !!status && !!date && pkgDef.hours <= status.remaining + 1e-6;
  const overCap = !!member && !!status && pkgDef.hours > status.remaining + 1e-6;

  function validate(): string | null {
    if (!date) return 'Please choose a date.';
    if (new Date(`${date}T00:00:00`).getDay() % 6 === 0) return ERRORS.weekend;
    if (!spaceId) return ERRORS['no-space'];
    return null;
  }

  async function bookFree() {
    const v = validate();
    if (v) return setError(v);
    if (PREVIEW) return setError('Booking connects on the live site — this is a preview.');
    setError(null);
    setBusy(true);
    const r = await roomMemberFree({ spaceId: spaceId!, date, pkg, people });
    setBusy(false);
    if (r.ok && r.data.ok) {
      setFreeDone(true);
      setStep('done');
      return;
    }
    if (r.data?.error === 'cap-exceeded') {
      setError(ERRORS['cap-exceeded']);
      return;
    }
    setError(ERRORS[r.data?.error ?? ''] ?? 'We couldn’t book that just now — please try again or enquire below.');
  }

  async function toPayment() {
    setError(null);
    const v = validate();
    if (v) return setError(v);
    if (!member && !company.trim()) return setError(ERRORS['missing-company']);
    if (!member && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError(ERRORS['bad-email']);
    if (PREVIEW) return setError('Online payment loads on the live site — this is a preview.');
    setBusy(true);
    const r = await roomIntent({
      spaceId: spaceId!,
      date,
      pkg,
      people,
      lunch,
      company: (company || (member ? 'Member booking' : '')).trim(),
      name: name.trim(),
      email: email.trim() || memberEmailOf(member),
    });
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      setError(ERRORS[r.data?.error ?? ''] ?? 'We couldn’t start the booking just now — please try again or enquire below.');
      return;
    }
    setServerLines(r.data.lines || null);
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

  async function pay() {
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
      <div className={styles.done}>
        <span className={styles.doneIcon}>
          <Icon name="check" size={26} color="var(--gold-700)" />
        </span>
        <h3 className={styles.doneTitle}>You’re booked in</h3>
        <p className={styles.doneText}>
          {roomName} is reserved for {date}
          {freeDone ? ' — free, on your membership.' : `. We’ve emailed your confirmation${email ? ` to ${email}` : ''}.`} See you then.
        </p>
      </div>
    );
  }

  const payTotal = serverLines ? serverLines.reduce((a, l) => a + l.amount, 0) : est.total;
  const lines: RoomQuoteLine[] =
    serverLines ??
    [
      { label: `${roomName} · ${pkgDef.label}`, amount: span === 'full' ? price.full : price.half },
      ...(est.quiet ? [{ label: 'Quiet-day discount (20%)', amount: -Math.round((span === 'full' ? price.full : price.half) * 0.2 * 100) / 100 }] : []),
      ...(lunch ? [{ label: `Lunch · ${Math.max(1, people)} × £${LUNCH_PER_HEAD}`, amount: est.lunchTotal }] : []),
    ];

  return (
    <div className={styles.wrap}>
      <div className={styles.formCol}>
        {member && status ? (
          <div className={styles.memberBanner}>
            <Icon name="sparkles" size={16} color="var(--gold-700)" />
            <span>
              Members book free — you have <strong>{Math.max(0, status.remaining)}h</strong> of {status.capHours}h left this month.
            </span>
          </div>
        ) : null}

        <label className={styles.field}>
          <span className={styles.label}>Date</span>
          <input type="date" className={styles.input} value={date} min={todayStr} onChange={(e) => setDate(e.target.value)} disabled={step === 'pay'} />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Package</span>
          <div className={styles.pkgRow}>
            {PACKAGES.map((p) => (
              <button key={p.id} type="button" className={`${styles.pkg} ${pkg === p.id ? styles.pkgOn : ''}`} onClick={() => setPkg(p.id)} disabled={step === 'pay'}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>How many people?</span>
          <input
            type="number"
            className={styles.input}
            min={1}
            max={50}
            value={people}
            onChange={(e) => setPeople(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            disabled={step === 'pay'}
          />
        </label>

        {!freeEligible ? (
          <label className={styles.checkRow}>
            <input type="checkbox" checked={lunch} onChange={() => setLunch((v) => !v)} disabled={step === 'pay'} />
            <span>
              Add lunch — baguettes &amp; cake from The Sandwich Bar
              <span className={styles.checkSub}>£{LUNCH_PER_HEAD} a head</span>
            </span>
          </label>
        ) : null}

        {!member ? (
          <div className={styles.contact}>
            <label className={styles.field}>
              <span className={styles.label}>Company / organisation</span>
              <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} disabled={step === 'pay'} placeholder="Who’s the booking for?" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Your name</span>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} disabled={step === 'pay'} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Email for confirmation</span>
              <input type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === 'pay'} />
            </label>
          </div>
        ) : null}
      </div>

      <aside className={styles.summary}>
        <h3 className={styles.sumTitle}>{roomName}</h3>

        {freeEligible ? (
          <>
            <div className={styles.total}>
              <span>Total</span>
              <span>Free <small>on your membership</small></span>
            </div>
            <p className={styles.quiet}>Uses {pkgDef.hours}h of your {status?.capHours}h monthly allowance.</p>
            <Button variant="accent" fullWidth onClick={bookFree} disabled={busy || resolving} iconAfter="arrow-right">
              {busy ? 'Booking…' : 'Book — free'}
            </Button>
          </>
        ) : (
          <>
            <div className={styles.lines}>
              {lines.map((l, i) => (
                <div key={i} className={styles.line}>
                  <span>{l.label}</span>
                  <span className={l.amount < 0 ? styles.discount : ''}>{l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}</span>
                </div>
              ))}
              <div className={styles.total}>
                <span>Total</span>
                <span>
                  {money(payTotal)} <small>inc. VAT</small>
                </span>
              </div>
            </div>
            {overCap ? <p className={styles.quiet}>You’ve used your free hours this month — this booking is paid.</p> : null}
            {est.quiet && !serverLines ? <p className={styles.quiet}>Quiet-day rate applied — 20% off room hire.</p> : null}

            {step === 'pay' ? (
              <div className={styles.payBox}>
                <span className={styles.label}>Payment</span>
                <div ref={mountRef} className={styles.payEl} />
                <Button variant="accent" fullWidth onClick={pay} disabled={busy} iconAfter="arrow-right">
                  {busy ? 'Taking payment…' : `Pay ${money(payTotal)}`}
                </Button>
                <button type="button" className={styles.back} onClick={() => setStep('form')} disabled={busy}>
                  ‹ Back
                </button>
                <p className={styles.secure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
              </div>
            ) : (
              <Button variant="accent" fullWidth onClick={toPayment} disabled={busy || resolving} iconAfter="arrow-right">
                {busy ? 'Checking…' : 'Continue to payment'}
              </Button>
            )}
          </>
        )}

        {error ? <p className={styles.err}>{error}</p> : null}
        <p className={styles.note}>
          Prefer to talk it through? <a href="#enquire">Chat to us</a> instead.
        </p>
      </aside>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function memberEmailOf(member: any): string {
  const cf = (member?.customFields || {}) as Record<string, unknown>;
  return String(member?.auth?.email || member?.email || cf['email'] || '') || '';
}
