'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { Photo } from '@/components/site/primitives';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { PRIVATISATION_ROOMS, FREQUENCIES, WEEKDAYS, PRIVATISATION_MIN_MEMBERS, quarterlyAmount, type FrequencyId } from '@/lib/privatisation';
import { privatisationSubscribe, privatisationAvailability } from '@/lib/booking';
import { DatePickerModal } from './DatePickerModal';
import { PREVIEW } from '@/lib/devMock';
import styles from './Privatisation.module.css';
import pay from './RoomBooking.module.css';

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

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

const ERRORS: Record<string, string> = {
  'already-privatised': 'Our team rooms are fully booked out right now. Do get in touch and we’ll find you a date.',
  'min-members': `Privatisation is for teams of ${PRIVATISATION_MIN_MEMBERS} or more.`,
  'over-capacity': 'That’s more people than this room seats — pick the larger room or reduce the team size.',
  'days-mismatch': 'Please pick the number of days that matches your chosen frequency.',
  'weekday-taken': 'One of those days is already taken on this room — please pick another day or room.',
  'bad-email': 'Please enter a valid email address.',
  'missing-company': 'Please add your company name.',
  'bad-date': 'Please choose a start date.',
  'stripe': 'We couldn’t set up the payment — please try again or enquire below.',
  'stripe-price': 'We couldn’t set up the payment — please try again or enquire below.',
  'no-client-secret': 'We couldn’t set up the payment — please try again or enquire below.',
  'not-configured': 'Online setup is being finalised — please enquire and we’ll set you up.',
};

export function Privatisation() {
  const [done, setDone] = useState(false);
  const [roomSlug, setRoomSlug] = useState(PRIVATISATION_ROOMS[0].slug);
  const [frequency, setFrequency] = useState<FrequencyId>('one');
  const [days, setDays] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState(PRIVATISATION_MIN_MEMBERS);
  const [step, setStep] = useState<'form' | 'pay'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Real-time per-weekday availability on the chosen room/cadence/start-date.
  const [avail, setAvail] = useState<Record<number, 'free' | 'taken'>>({});
  const [checking, setChecking] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('done') === '1') setDone(true);
  }, []);

  const room = useMemo(() => PRIVATISATION_ROOMS.find((r) => r.slug === roomSlug)!, [roomSlug]);
  const freq = useMemo(() => FREQUENCIES.find((f) => f.id === frequency)!, [frequency]);
  const monthly = room.monthly[frequency];
  const quarterly = quarterlyAmount(monthly);
  const wholeWeek = frequency === 'all';

  function toggleDay(id: number) {
    setDays((cur) => {
      if (cur.includes(id)) return cur.filter((d) => d !== id);
      if (cur.length >= freq.days) return [...cur.slice(1), id]; // keep to the frequency limit
      return [...cur, id];
    });
  }

  // Check which weekdays are already taken on this room whenever the room, cadence or start
  // date changes. Debounced; resilient — on any error we leave the map empty (nothing greyed,
  // submit not blocked) and let the server re-check with 'weekday-taken'.
  useEffect(() => {
    if (PREVIEW || !startDate) {
      setAvail({});
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      const r = await privatisationAvailability({ roomSlug, frequency, weekdays: WEEKDAYS.map((d) => d.id), startDate });
      if (cancelled) return;
      setChecking(false);
      setAvail(r.ok && r.data.weekdays ? r.data.weekdays : {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [roomSlug, frequency, startDate]);

  // Drop any selected weekday that has become taken (e.g. after switching room/date).
  useEffect(() => {
    setDays((cur) => cur.filter((d) => avail[d] !== 'taken'));
  }, [avail]);

  async function toPayment() {
    setError(null);
    if (!company.trim()) return setError(ERRORS['missing-company']);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError(ERRORS['bad-email']);
    if (members < PRIVATISATION_MIN_MEMBERS) return setError(ERRORS['min-members']);
    if (members > room.capacity) {
      const other = PRIVATISATION_ROOMS.find((r) => r.slug !== roomSlug);
      return setError(`${room.name} seats ${room.capacity} — reduce your team size${other ? ` or choose ${other.name}` : ''}.`);
    }
    if (!startDate) return setError(ERRORS['bad-date']);
    if (!wholeWeek && days.length !== freq.days) return setError(ERRORS['days-mismatch']);
    if (days.some((d) => avail[d] === 'taken')) return setError(ERRORS['weekday-taken']);
    if (PREVIEW) {
      setError('Checkout opens on the live site — this is a preview.');
      return;
    }
    setBusy(true);
    const r = await privatisationSubscribe({
      roomSlug,
      frequency,
      days: wholeWeek ? WEEKDAYS.map((d) => d.id) : days,
      startDate,
      company: company.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      jobTitle: jobTitle.trim(),
      phone: phone.trim(),
      email: email.trim(),
      members,
    });
    setBusy(false);
    if (!r.ok || !r.data.clientSecret) {
      setError(ERRORS[r.data?.error ?? ''] ?? 'We couldn’t start checkout just now — please try again or enquire below.');
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
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) setDone(true);
    else setError('Payment needs another step — please try again.');
  }

  if (done) {
    return (
      <div className={styles.done}>
        <span className={styles.doneIcon}>
          <Icon name="check" size={26} color="var(--gold-700)" />
        </span>
        <h3 className={styles.doneTitle}>Welcome to The Quarter</h3>
        <p className={styles.doneText}>
          Your team room is reserved and your subscription is set up — invoiced quarterly. We’ve emailed your confirmation, and
          we’ll be in touch to get everyone’s accounts ready.
        </p>
      </div>
    );
  }

  const disabled = step === 'pay';

  return (
    <div className={styles.wrap}>
      <div className={styles.formCol}>
        <div className={styles.field}>
          <span className={styles.label}>Which room?</span>
          <div className={styles.roomRow}>
            {PRIVATISATION_ROOMS.map((r) => (
              <button key={r.slug} type="button" className={`${styles.room} ${roomSlug === r.slug ? styles.roomOn : ''}`} onClick={() => setRoomSlug(r.slug)} disabled={disabled}>
                <strong>{r.name}</strong>
                <span>Seats {r.capacity}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>How often?</span>
          <div className={styles.freqRow}>
            {FREQUENCIES.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`${styles.freq} ${frequency === f.id ? styles.freqOn : ''}`}
                onClick={() => {
                  setFrequency(f.id);
                  setDays([]);
                }}
                disabled={disabled}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!wholeWeek ? (
          <div className={styles.field}>
            <span className={styles.label}>
              Which day{freq.days > 1 ? 's' : ''}? <span className={styles.hint}>pick {freq.days}</span>
              {checking ? (
                <span className={styles.hint}> · checking availability…</span>
              ) : Object.values(avail).includes('taken') ? (
                <span className={styles.hint}> · greyed days are taken on this room</span>
              ) : null}
            </span>
            <div className={styles.dayRow}>
              {WEEKDAYS.map((d) => {
                const taken = avail[d.id] === 'taken';
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`${styles.day} ${days.includes(d.id) ? styles.dayOn : ''}`}
                    onClick={() => toggleDay(d.id)}
                    disabled={disabled || taken}
                    title={taken ? 'That day’s taken on this room' : undefined}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={styles.grid2}>
          <div className={styles.field}>
            <span className={styles.label}>Start date</span>
            <button type="button" className={pay.dateTrigger} onClick={() => setDateOpen(true)} disabled={disabled}>
              <Icon name="calendar" size={16} color="var(--gold-700)" />
              {startDate
                ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
                : 'Choose a start date'}
            </button>
            <DatePickerModal open={dateOpen} onClose={() => setDateOpen(false)} onPick={(d) => setStartDate(d)} single />
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Team size</span>
            <input type="number" className={styles.input} min={PRIVATISATION_MIN_MEMBERS} max={room.capacity} value={members} onChange={(e) => setMembers(Math.max(1, Number(e.target.value) || 0))} disabled={disabled} />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Company</span>
          <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} disabled={disabled} />
        </label>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>First name</span>
            <input className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" disabled={disabled} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Last name</span>
            <input className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" disabled={disabled} />
          </label>
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>Job title</span>
            <input className={styles.input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} autoComplete="organization-title" disabled={disabled} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Phone</span>
            <input type="tel" className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={disabled} />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} />
        </label>
      </div>

      <aside className={styles.summary}>
        <div style={{ marginBottom: 4 }}>
          <Photo src={room.photo.src} alt={room.photo.alt} ratio="16 / 10" radius="var(--radius-lg)" sizes="(max-width: 820px) 100vw, 380px" />
        </div>
        <h3 className={styles.sumTitle}>{room.name}</h3>
        <p className={styles.sumSub}>
          {freq.label} · {wholeWeek ? 'full week' : days.length ? WEEKDAYS.filter((d) => days.includes(d.id)).map((d) => d.short).join(', ') : 'pick your days'}
        </p>
        <div className={styles.priceBlock}>
          <div className={styles.priceMain}>
            {money(monthly)} <small>/ month</small>
          </div>
          <div className={styles.priceQuarter}>Billed quarterly · {money(quarterly)} every 3 months</div>
        </div>
        <ul className={styles.perks}>
          <li>The whole room, yours on your days</li>
          <li>Every seat included — your team keep their own accounts &amp; check in</li>
          <li>All the usual: breakfast, coffee, fibre, pods &amp; perks</li>
          <li>Minimum {PRIVATISATION_MIN_MEMBERS} members · invoiced quarterly</li>
        </ul>

        {step === 'pay' ? (
          <div className={pay.payBox}>
            <div ref={mountRef} className={pay.payEl} />
            <Button variant="accent" fullWidth onClick={payNow} disabled={busy} iconAfter="arrow-right">
              {busy ? 'Taking payment…' : `Pay ${money(quarterly)}`}
            </Button>
            <button type="button" className={styles.note} onClick={() => setStep('form')} disabled={busy} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
              ‹ Back
            </button>
            <p className={pay.secure}>First quarter now, then billed quarterly · Apple Pay &amp; cards.</p>
          </div>
        ) : (
          <Button variant="accent" fullWidth onClick={toPayment} disabled={busy} iconAfter="arrow-right">
            {busy ? 'Starting…' : 'Set up & pay'}
          </Button>
        )}
        {error ? <p className={styles.err}>{error}</p> : null}
        <p className={styles.note}>
          Rather talk first? <a href="/location#contact">Get in touch</a> and we’ll walk you through it.
        </p>
      </aside>
    </div>
  );
}
