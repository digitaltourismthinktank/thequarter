'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import {
  getSpaces,
  getAvailability,
  roomIntent,
  roomMemberStatus,
  roomMemberFree,
  type BusyRange,
  type RoomQuoteLine,
  type RoomMemberStatus,
} from '@/lib/booking';
import { useMember } from './useMember';
import { Confirmation, signupHref, type ConfirmationRow } from './Confirmation';
import { TalkToUs } from './TalkToUs';
import { DatePickerModal } from './DatePickerModal';
import { PREVIEW } from '@/lib/devMock';
import { cn } from '@/lib/cn';
import styles from './RoomBooking.module.css';

/**
 * Native meeting-room booking. A logged-in member books free up to their monthly
 * hours cap (the two main rooms); non-members — and members over their cap — pay by
 * card / Apple Pay via Stripe's Payment Element.
 *
 * Time is chosen with a click-scroll-click 30-minute range picker (mirroring the
 * member dashboard booker): first click sets the start, moving the pointer previews
 * the range, a second click sets the end; clicking again resets. The range maps to a
 * half-/full-day PACKAGE for pricing — the server (room-booking.mjs) is the sole £
 * authority; the client only displays estimates and sends {pkg, start, end}.
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

// Stripe.js can resolve before React has committed the 'pay'-step re-render (e.g. when
// Stripe.js is already cached), so the mount node may not exist yet. Wait briefly for it
// rather than throwing immediately on a null ref.
async function waitForNode(ref: { current: HTMLDivElement | null }): Promise<HTMLDivElement | null> {
  for (let i = 0; i < 40 && !ref.current; i++) await new Promise((r) => setTimeout(r, 16));
  return ref.current;
}

const QUIET_DAYS = [1, 3, 5];
const LUNCH_PER_HEAD = 12;

// The bookable meeting-room day, in minutes from midnight. 30-minute slots run
// 09:00–17:30 (the full-day package window); the last selectable END is 17:30.
const SLOT = 30;
const DAY_OPEN = 9 * 60; // 09:00
const DAY_CLOSE = 17 * 60 + 30; // 17:30 — max selectable end
const MIDDAY = 13 * 60; // 13:00 — the half-day split

const money = (n: number) => `£${n.toFixed(2)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();
const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fmtRange = (a: number, b: number) => `${minToHHMM(a)}–${minToHHMM(b)}`;

/** Range → package. Wholly-morning (end ≤ 13:00) → 'am'; wholly-afternoon
 *  (start ≥ 13:00) → 'pm'; anything that crosses midday → 'full'. So any ≤ half-day
 *  selection is charged the half-day price; a midday-crossing selection is full day. */
function pkgForRange(startMin: number, endMin: number): 'am' | 'pm' | 'full' {
  if (endMin <= MIDDAY) return 'am';
  if (startMin >= MIDDAY) return 'pm';
  return 'full';
}
const rateLabel = (p: 'am' | 'pm' | 'full') => (p === 'full' ? 'full-day rate' : 'half-day rate');

const PRESETS = [
  { label: 'Morning', sub: '09:00–13:00', start: DAY_OPEN, end: MIDDAY },
  { label: 'Afternoon', sub: '13:30–17:30', start: 13 * 60 + 30, end: DAY_CLOSE },
  { label: 'Full day', sub: '09:00–17:30', start: DAY_OPEN, end: DAY_CLOSE },
] as const;

function nextWeekdayISO(): string {
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) break;
    d.setDate(d.getDate() + 1);
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

  const [date, setDate] = useState<string>(() => nextWeekdayISO());
  const [people, setPeople] = useState(4);
  const [lunch, setLunch] = useState(false);
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOpen, setDateOpen] = useState(false);

  // Range picker (mirrors BookingClient): pending start tap, hovered slot, committed range.
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);

  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form');
  const [freeDone, setFreeDone] = useState(false);
  const [working, setWorking] = useState(false);
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

  // Live availability for the chosen room + date. Slow enough to warrant a spinner.
  useEffect(() => {
    if (!spaceId || !date) {
      setBusy([]);
      return;
    }
    let active = true;
    setLoadingAvail(true);
    setStart(null);
    setSel(null);
    (async () => {
      const r = await getAvailability(spaceId, date);
      if (!active) return;
      setBusy(r.ok ? r.data.busy || [] : []);
      setLoadingAvail(false);
    })();
    return () => {
      active = false;
    };
  }, [spaceId, date]);

  // A fetched quote (serverLines) is priced for one exact date / selection / party only.
  // Invalidate it whenever any pricing input changes so the summary falls back to est —
  // recomputed from the CURRENT date — instead of leaving a stale quiet-day discount on
  // screen after the date moves back to a standard (non-quiet) day. Continuing to payment
  // sets serverLines without touching these deps, so the quote survives into the pay step.
  useEffect(() => {
    setServerLines(null);
  }, [date, sel, people, lunch]);

  const slots = useMemo(() => {
    const out: number[] = [];
    for (let s = DAY_OPEN; s < DAY_CLOSE; s += SLOT) out.push(s);
    return out;
  }, []);

  const slotBusy = (s: number) => busy.some((b) => s < b.endMin && s + SLOT > b.startMin);
  const rangeFree = (lo: number, hi: number) => {
    for (let s = lo; s < hi; s += SLOT) if (slotBusy(s)) return false;
    return true;
  };

  // Two-tap selection: tap a start time, then an end time (end tap is inclusive).
  function clickSlot(s: number) {
    if (step === 'pay') return;
    setError(null);
    if (slotBusy(s)) return;
    if (sel) {
      setSel(null);
      setStart(s);
      return;
    }
    if (start === null) {
      setStart(s);
      return;
    }
    const lo = Math.min(start, s);
    const hi = Math.max(start, s) + SLOT;
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setStart(null);
    } else {
      setStart(s); // crossed a busy slot → restart here
    }
  }

  function preset(lo: number, hi: number) {
    if (step === 'pay') return;
    setError(null);
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setStart(null);
    } else {
      setError('That block isn’t free — please pick another.');
    }
  }

  function clearSel() {
    setStart(null);
    setSel(null);
    setError(null);
  }

  const pkg = sel ? pkgForRange(sel.start, sel.end) : null;
  const span: 'half' | 'full' = pkg === 'full' ? 'full' : 'half';
  const selHours = sel ? round2((sel.end - sel.start) / 60) : 0;

  const est = useMemo(() => {
    if (!sel) return null;
    let hire = span === 'full' ? price.full : price.half;
    const dow = date ? new Date(`${date}T00:00:00`).getDay() : -1;
    const quiet = QUIET_DAYS.includes(dow);
    if (quiet) hire = round2(hire * 0.8);
    const lunchTotal = lunch ? Math.max(1, people) * LUNCH_PER_HEAD : 0;
    return { hire, quiet, lunchTotal, total: round2(hire + lunchTotal) };
  }, [sel, span, price, date, lunch, people]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // A member books free when the selected range fits inside their remaining free hours.
  const freeEligible = !!member && !!status && !!sel && selHours <= status.remaining + 1e-6;
  const overCap = !!member && !!status && !!sel && selHours > status.remaining + 1e-6;

  function validate(): string | null {
    if (!date) return 'Please choose a date.';
    if (new Date(`${date}T00:00:00`).getDay() % 6 === 0) return ERRORS.weekend;
    if (!sel) return 'Please choose a time on the grid.';
    if (!spaceId) return ERRORS['no-space'];
    return null;
  }

  async function bookFree() {
    const v = validate();
    if (v) return setError(v);
    if (PREVIEW) return setError('Booking connects on the live site — this is a preview.');
    setError(null);
    setWorking(true);
    const r = await roomMemberFree({
      spaceId: spaceId!,
      date,
      pkg: pkg!,
      start: minToHHMM(sel!.start),
      end: minToHHMM(sel!.end),
      people,
    });
    setWorking(false);
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
    setWorking(true);
    const r = await roomIntent({
      spaceId: spaceId!,
      date,
      pkg: pkg!,
      start: minToHHMM(sel!.start),
      end: minToHHMM(sel!.end),
      people,
      lunch,
      company: (company || (member ? 'Member booking' : '')).trim(),
      name: name.trim(),
      jobTitle: jobTitle.trim(),
      phone: phone.trim(),
      email: email.trim() || memberEmailOf(member),
    });
    setWorking(false);
    if (!r.ok || !r.data.clientSecret) {
      setError(ERRORS[r.data?.error ?? ''] ?? 'We couldn’t start the booking just now — please try again or enquire below.');
      return;
    }
    setServerLines(r.data.lines || null);
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

  async function pay() {
    if (!stripeRef.current || !elementsRef.current) return;
    setWorking(true);
    setError(null);
    const { error: payErr, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setWorking(false);
    if (payErr) return setError(payErr.message || 'That payment didn’t go through — please try again.');
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) setStep('done');
    else setError('Payment needs another step — please try again.');
  }

  if (step === 'done') {
    const prettyDate = date
      ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const paidTotal = serverLines ? serverLines.reduce((a, l) => a + l.amount, 0) : est?.total ?? 0;
    const guestEmail = member ? '' : email.trim();
    const shownEmail = member ? memberEmailOf(member) : guestEmail;
    const doneRows: ConfirmationRow[] = [{ icon: 'calendar', label: 'Date', value: prettyDate || '—' }];
    if (sel) doneRows.push({ icon: 'clock', label: 'Time', value: fmtRange(sel.start, sel.end) });
    doneRows.push({ icon: 'users', label: 'People', value: `${people} ${people === 1 ? 'person' : 'people'}` });
    return (
      <Confirmation
        eyebrow={`${roomName} booked`}
        title="You’re booked in"
        intro={
          freeDone ? (
            <>{roomName} is reserved for you — free on your membership. It’s saved to your dashboard.</>
          ) : (
            <>{roomName} is reserved and paid. We look forward to seeing you.</>
          )
        }
        rows={doneRows}
        amount={freeDone ? undefined : money(paidTotal)}
        email={shownEmail || undefined}
        emailNote={freeDone ? <>A confirmation is on its way to <strong>{shownEmail}</strong>.</> : undefined}
        account={
          member
            ? null
            : {
                heading: 'Create your account',
                body: (
                  <>
                    Save this booking to your profile. Create an account with <strong>{guestEmail}</strong> to manage or cancel it, book more
                    rooms, and start earning Quarter Rewards.
                  </>
                ),
                cta: 'Create your account',
                href: signupHref(guestEmail, {
                  firstName: name.trim().split(/\s+/)[0],
                  lastName: name.trim().split(/\s+/).slice(1).join(' '),
                  phone,
                }),
              }
        }
        footnote={member ? undefined : <>Booked for {company.trim() || 'your company'}.</>}
      />
    );
  }

  // Hover preview of the whole block from the start tap to the hovered slot.
  const previewRange =
    start !== null && !sel && hover !== null && hover !== start
      ? (() => {
          const lo = Math.min(start, hover);
          const hi = Math.max(start, hover) + SLOT;
          return rangeFree(lo, hi) ? { lo, hi } : null;
        })()
      : null;

  const hint = sel
    ? `Selected ${fmtRange(sel.start, sel.end)} · ${rateLabel(pkg!)}`
    : start !== null
      ? `Start ${minToHHMM(start)} — now tap your end time`
      : 'Tap a start time, then an end time — or use a preset above.';

  const payTotal = serverLines ? serverLines.reduce((a, l) => a + l.amount, 0) : est?.total ?? 0;
  const lines: RoomQuoteLine[] =
    serverLines ??
    (sel
      ? [
          { label: `${roomName} · ${fmtRange(sel.start, sel.end)}`, amount: span === 'full' ? price.full : price.half },
          ...(est?.quiet ? [{ label: 'Quiet-day discount (20%)', amount: -round2((span === 'full' ? price.full : price.half) * 0.2) }] : []),
          ...(lunch ? [{ label: `Lunch · ${Math.max(1, people)} × £${LUNCH_PER_HEAD}`, amount: est?.lunchTotal ?? 0 }] : []),
        ]
      : []);

  return (
    <div className={cn(styles.wrap, step === 'pay' && styles.paying)}>
      <div className={styles.formCol}>
        {member && status ? (
          <div className={styles.memberBanner}>
            <Icon name="sparkles" size={16} color="var(--gold-700)" />
            <span>
              Members book free — you have <strong>{Math.max(0, status.remaining)}h</strong> of {status.capHours}h left this month.
            </span>
          </div>
        ) : null}

        <div className={styles.field}>
          <span className={styles.label}>Date</span>
          <button type="button" className={styles.dateTrigger} onClick={() => setDateOpen(true)} disabled={step === 'pay'}>
            <Icon name="calendar" size={16} color="var(--gold-700)" />
            {date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' }) : 'Choose a date'}
          </button>
        </div>
        <DatePickerModal open={dateOpen} onClose={() => setDateOpen(false)} onPick={(d) => setDate(d)} single />

        <div className={styles.field}>
          <span className={styles.label}>Choose your time</span>
          <div className={styles.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={styles.preset}
                onClick={() => preset(p.start, p.end)}
                disabled={step === 'pay' || loadingAvail || !spaceId}
              >
                <span className={styles.presetLabel}>{p.label}</span>
                <span className={styles.presetSub}>{p.sub}</span>
              </button>
            ))}
          </div>

          <div className={styles.hintRow}>
            <span className={styles.hint}>{hint}</span>
            {(start !== null || sel) && step !== 'pay' ? (
              <button type="button" className={styles.clear} onClick={clearSel}>
                Clear
              </button>
            ) : null}
          </div>

          {loadingAvail || resolving ? (
            <div className={styles.pickerState}>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Checking availability…</span>
            </div>
          ) : !spaceId ? (
            <p className={styles.pickerNote}>Online booking is being set up for this room — please chat to us below to reserve.</p>
          ) : (
            <div className={styles.slotGrid} onMouseLeave={() => setHover(null)}>
              {slots.map((s) => {
                const isBusy = slotBusy(s);
                const isSel = !!sel && s >= sel.start && s < sel.end;
                const isStart = start === s && !sel;
                const isPreview = !!previewRange && s >= previewRange.lo && s < previewRange.hi;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isBusy || step === 'pay'}
                    onClick={() => clickSlot(s)}
                    onMouseEnter={() => setHover(s)}
                    className={cn(styles.slot, isBusy && styles.slotBusy, isSel && styles.slotSel, isStart && styles.slotStart, isPreview && styles.slotPreview)}
                  >
                    {minToHHMM(s)}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.outOfHours}>
            <span>Need a time outside 09:00–17:30?</span>
            <TalkToUs variant="ghost" label="Chat to us" prefill={`I’d like to book ${roomName} outside 09:00–17:30: `} />
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
              <span className={styles.label}>Company</span>
              <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} disabled={step === 'pay'} placeholder="Who’s the booking for?" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Your name</span>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} disabled={step === 'pay'} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Job title</span>
              <input className={styles.input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={step === 'pay'} placeholder="e.g. Operations Manager" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} disabled={step === 'pay'} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Contact number</span>
              <input type="tel" className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={step === 'pay'} placeholder="Optional — in case we need to reach you" />
            </label>
          </div>
        ) : null}
      </div>

      <aside className={styles.summary}>
        <h3 className={styles.sumTitle}>{roomName}</h3>

        {!sel ? (
          <p className={styles.pickPrompt}>Pick a date and time on the left to see your price.</p>
        ) : freeEligible ? (
          <>
            <div className={styles.total}>
              <span>Total</span>
              <span>
                Free <small>on your membership</small>
              </span>
            </div>
            <p className={styles.quiet}>
              Uses {selHours}h of your {status?.capHours}h monthly allowance.
            </p>
            <Button variant="accent" fullWidth onClick={bookFree} disabled={working || resolving} iconAfter="arrow-right">
              {working ? 'Booking…' : 'Book — free'}
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
            {est?.quiet && !serverLines ? <p className={styles.quiet}>Quiet-day rate applied — 20% off room hire.</p> : null}

            {step === 'pay' ? (
              <div className={styles.payBox}>
                <span className={styles.label}>Payment</span>
                <div ref={mountRef} className={styles.payEl} />
                <Button variant="accent" fullWidth onClick={pay} disabled={working} iconAfter="arrow-right">
                  {working ? 'Taking payment…' : `Pay ${money(payTotal)}`}
                </Button>
                <button type="button" className={styles.back} onClick={() => setStep('form')} disabled={working}>
                  ‹ Back
                </button>
                <p className={styles.secure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
              </div>
            ) : (
              <Button variant="accent" fullWidth onClick={toPayment} disabled={working || resolving} iconAfter="arrow-right">
                {working ? 'Checking…' : 'Continue to payment'}
              </Button>
            )}
          </>
        )}

        {error ? <p className={styles.err}>{error}</p> : null}
        <p className={styles.note}>
          Questions about your booking? <a href="#enquire">Chat to us</a>.
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
