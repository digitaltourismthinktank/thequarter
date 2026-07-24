'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember } from './useMember';
import {
  getSpaces,
  getAvailability,
  getMyBookings,
  createBooking,
  reserveDay,
  cancelBooking,
  amendBooking,
  sortBookings,
  roomMemberStatus,
  roomMemberQuote,
  roomIntent,
  roomSetSave,
  type Space,
  type MyBooking,
  type RoomMemberStatus,
  type RoomQuoteLine,
  type SavedCard,
} from '@/lib/booking';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { WeekStrip } from './WeekStrip';
import { DatePickerModal } from './DatePickerModal';
import { PLAN_ROOM_HOURS, MEMBER_ROOM_DISCOUNT, planSlugFromMemberstackId } from '@/lib/plans';
import { BuyPassSheet } from './BuyPassSheet';
import styles from './BookingClient.module.css';

const money = (n: number) => `£${n.toFixed(2)}`;
const prettyBrand = (b: string) => (b === 'amex' ? 'Amex' : b.charAt(0).toUpperCase() + b.slice(1));
/** Range → package span for pricing (13:00 split): wholly-AM/PM = half, crossing midday = full. */
function pkgForRange(startMin: number, endMin: number): 'am' | 'pm' | 'full' {
  if (endMin <= 13 * 60) return 'am';
  if (startMin >= 13 * 60) return 'pm';
  return 'full';
}

// Stripe.js loader (mirrors RoomBooking) — used for the inline "pay for extra room time" flow.
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
async function waitForNode(ref: { current: HTMLDivElement | null }): Promise<HTMLDivElement | null> {
  for (let i = 0; i < 40 && !ref.current; i++) await new Promise((r) => setTimeout(r, 16));
  return ref.current;
}

const SLOT = 30;

interface Avail {
  openMin: number;
  closeMin: number;
  slotMin: number;
  busy: { startMin: number; endMin: number }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fmtRange = (a: number, b: number) => `${minToHHMM(a)}–${minToHHMM(b)}`;
/** 08:00–18:00 in 30-minute steps, for the amend pickers (mirrors the server's window). */
const AMEND_TIMES: string[] = [];
for (let m = 8 * 60; m <= 18 * 60; m += SLOT) AMEND_TIMES.push(minToHHMM(m));

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nextWeekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < n) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) out.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}
function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

export function BookingClient() {
  const { loading, member } = useMember();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(() => nextWeekdays(1)[0]);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [start, setStart] = useState<number | null>(null); // pending start tap
  const [hover, setHover] = useState<number | null>(null); // slot under the cursor (block preview)
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null); // committed range
  const [mine, setMine] = useState<MyBooking[]>([]);
  const [busyAction, setBusyAction] = useState(false);
  // Out of co-working days: a decision point (buy a pass / change plan), not just a red line.
  const [blocked, setBlocked] = useState<'no-allowance' | 'needs-plan-or-pass' | null>(null);
  const [buyPass, setBuyPass] = useState(false);
  // Inline amend (move a booking's date/time, same room) — parity with the dashboard,
  // which already allowed this while the Book tab only offered Cancel.
  const [editId, setEditId] = useState<string | null>(null);
  const [eDate, setEDate] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [amendErr, setAmendErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Sticky success: after a booking the confirm button reads "Booked ✓" and holds until the member
  // changes the room / date / time — instead of snapping straight back to a greyed "Confirm booking".
  const [justBooked, setJustBooked] = useState(false);
  // Booking a room means they'll be in that day, so we offer to mark them in (no separate check-in).
  const [offerInDate, setOfferInDate] = useState<string | null>(null);
  const [inNote, setInNote] = useState<string | null>(null);
  const offerRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Who's it for? Asked before the room list so the smallest space that fits is what you
  // see first — otherwise the instinct is to take the nicest room, and the six-seater gets
  // held for a call. Always escapable: "Choose another room" shows everything.
  const [party, setParty] = useState<number | null>(null);
  const [showAllRooms, setShowAllRooms] = useState(false);
  // Inline "pay for extra room time": member's monthly status, the server quote for the over-cap
  // booking, and the Stripe Elements pay step — all handled here so the member never leaves Book.
  const [roomStatus, setRoomStatus] = useState<RoomMemberStatus | null>(null);
  const [payLines, setPayLines] = useState<RoomQuoteLine[] | null>(null);
  const [payPence, setPayPence] = useState<number | null>(null);
  const [payStep, setPayStep] = useState<'none' | 'pay'>('none');
  const [payErr, setPayErr] = useState<string | null>(null);
  // Saved-card (one-tap) state: the member's card on file, a toggle to enter a different card,
  // and whether to save a newly-entered card for next time.
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [saveCardChecked, setSaveCardChecked] = useState(true);
  const [payIntentId, setPayIntentId] = useState<string | null>(null);
  const payMountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

  const loadMine = useCallback(async () => {
    const r = await getMyBookings();
    if (r.ok) setMine(sortBookings(r.data.bookings));
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSpaces();
      if (s.ok) {
        setSpaces(s.data.spaces);
        // Preselect a room only from ?room= (e.g. a kiosk QR). Otherwise no room is
        // chosen by default — members pick the room that fits before booking.
        const wanted = new URLSearchParams(window.location.search).get('room');
        const pre = wanted ? s.data.spaces.find((x) => x.id === wanted)?.id : null;
        if (pre) setSpaceId(pre);
      }
      await loadMine();
    })();
  }, [loadMine]);

  const reloadAvail = useCallback(async () => {
    if (!spaceId || !date) return;
    const r = await getAvailability(spaceId, date);
    if (r.ok) setAvail(r.data);
  }, [spaceId, date]);

  useEffect(() => {
    if (!spaceId || !date) return;
    let active = true;
    setLoadingAvail(true);
    setStart(null);
    setSel(null);
    (async () => {
      const r = await getAvailability(spaceId, date);
      if (!active) return;
      setAvail(r.ok ? r.data : null);
      setLoadingAvail(false);
    })();
    return () => {
      active = false;
    };
  }, [spaceId, date]);

  // Member's monthly meeting-room hours for the selected room + date (drives free-vs-pay). Pods and
  // non-plan members don't have a cap, so they never fetch.
  useEffect(() => {
    const sp = spaces.find((s) => s.id === spaceId);
    const isRoom = !!sp && sp.type !== 'Phone pod';
    const memberHasPlan = (member?.planConnections?.length ?? 0) > 0;
    if (!isRoom || !memberHasPlan || !date) {
      setRoomStatus(null);
      return;
    }
    let active = true;
    (async () => {
      const r = await roomMemberStatus(date);
      if (active && r.ok) setRoomStatus(r.data);
    })();
    return () => {
      active = false;
    };
  }, [spaceId, date, spaces, member]);

  // On any selection change: cancel a half-done payment, and — if this booking runs over the
  // member's included hours — fetch the tier-priced quote so they see the price before paying.
  useEffect(() => {
    setPayStep('none');
    setPayErr(null);
    setUseNewCard(false);
    const sp = spaces.find((s) => s.id === spaceId);
    const isRoom = !!sp && sp.type !== 'Phone pod';
    const hrs = sel ? (sel.end - sel.start) / 60 : 0;
    const over = isRoom && !!roomStatus && !!sel && hrs > (roomStatus.remaining ?? 0) + 1e-6;
    if (!over || !sel || !spaceId) {
      setPayLines(null);
      setPayPence(null);
      setSavedCard(null);
      return;
    }
    let active = true;
    (async () => {
      const r = await roomMemberQuote({
        spaceId,
        date,
        pkg: pkgForRange(sel.start, sel.end),
        start: minToHHMM(sel.start),
        end: minToHHMM(sel.end),
        people: Math.max(1, party ?? 1),
      });
      if (active && r.ok) {
        setPayLines(r.data.lines);
        setPayPence(r.data.amountPence);
        setSavedCard(r.data.savedCard ?? null);
      }
    })();
    return () => {
      active = false;
    };
  }, [sel, spaceId, date, roomStatus, spaces, party]);

  const slotBusy = (s: number) => (avail?.busy || []).some((b) => s < b.endMin && s + SLOT > b.startMin);
  const rangeFree = (lo: number, hi: number) => {
    for (let s = lo; s < hi; s += SLOT) if (slotBusy(s)) return false;
    return true;
  };

  // Two-tap selection: tap a start time, then an end time.
  function clickSlot(s: number) {
    setMsg(null);
    setJustBooked(false);
    if (slotBusy(s)) return;
    if (sel) {
      // already have a range -> start a fresh selection
      setSel(null);
      setStart(s);
      return;
    }
    if (start === null) {
      setStart(s); // first tap = start
      return;
    }
    const lo = Math.min(start, s);
    const hi = Math.max(start, s) + SLOT; // end tap is inclusive
    if (rangeFree(lo, hi)) {
      setSel({ start: lo, end: hi });
      setStart(null);
    } else {
      setStart(s); // crossed a busy slot -> restart here
    }
  }

  // Presets select the LARGEST FREE stretch within the block, clamped to the room's open/close and
  // (on today) to the next bookable slot. All-or-nothing was the bug: if any slot in the afternoon
  // was already booked, "Afternoon" and "Full day" did nothing. Now they grab whatever's free.
  function preset(loRaw: number, hiRaw: number) {
    setMsg(null);
    setJustBooked(false);
    const lo0 = Math.max(loRaw, open, firstSlot);
    const hi0 = Math.min(hiRaw, close);
    if (hi0 <= lo0) {
      setMsg('That block has already passed today — pick another time.');
      return;
    }
    let bestLo = -1;
    let bestHi = -1;
    let curLo = -1;
    for (let s = lo0; s < hi0; s += SLOT) {
      if (!slotBusy(s)) {
        if (curLo < 0) curLo = s;
        if (s + SLOT - curLo > bestHi - bestLo) {
          bestLo = curLo;
          bestHi = s + SLOT;
        }
      } else {
        curLo = -1;
      }
    }
    if (bestLo < 0) {
      setMsg('That block is fully booked — pick another time.');
      return;
    }
    setSel({ start: bestLo, end: bestHi });
    setStart(null);
  }

  function clearSel() {
    setStart(null);
    setSel(null);
    setMsg(null);
  }

  async function confirm() {
    if (!sel || !spaceId) return;
    setBusyAction(true);
    setMsg(null);
    setBlocked(null);
    const r = await createBooking({ spaceId, date, start: minToHHMM(sel.start), end: minToHHMM(sel.end) });
    if (r.ok) {
      setMsg('Booked ✓');
      setJustBooked(true);
      setOfferInDate(date);
      clearSel();
      await reloadAvail();
      await loadMine();
    } else {
      const code = r.data?.error ?? '';
      if (code === 'no-allowance' || code === 'needs-plan-or-pass') setBlocked(code);
      else setMsg(friendly(code));
    }
    setBusyAction(false);
  }

  // Clearing the sticky "Booked ✓" (member changed the room/date/time) also clears the check-in offer.
  useEffect(() => {
    if (!justBooked) {
      setOfferInDate(null);
      setInNote(null);
    }
  }, [justBooked]);

  // Nudge the "mark you in for the day?" prompt into view — otherwise it sits below the fold after a
  // booking and reads as unrelated, not as the follow-up question it is.
  useEffect(() => {
    if (offerInDate) offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [offerInDate]);

  // Booking a room = they'll be in that day. Offer to mark them in (a reservation the overnight
  // sweep will spend), so they needn't separately "book to be in" or check in on arrival.
  async function markInForDay(length: 'Full' | 'Half') {
    if (!offerInDate) return;
    setBusyAction(true);
    const r = await reserveDay(offerInDate, length, null);
    setBusyAction(false);
    setInNote(r.ok ? `You’re marked in for ${dayLabel(offerInDate)}${length === 'Half' ? ' · half day' : ''} — no need to check in on the day.` : 'Couldn’t mark you in — you can still check in on the day.');
  }

  // Shared success path: the booking itself is created by the Stripe webhook, so we just reset,
  // confirm to the member, and refresh what we can.
  async function bookedOk() {
    setBusyAction(false);
    setMsg('Booked & paid ✓ — it’ll appear in your bookings shortly.');
    setJustBooked(true);
    setOfferInDate(date);
    setPayStep('none');
    clearSel();
    await reloadAvail();
    await loadMine();
    const s = await roomMemberStatus(date);
    if (s.ok) setRoomStatus(s.data);
  }

  // One-tap: charge the member's saved card. The server confirms it; occasionally the bank wants
  // an extra step (handleCardAction), which we run here. Never stores or sees the card number.
  async function payWithSaved() {
    if (!sel || !spaceId || !savedCard) return;
    setBusyAction(true);
    setPayErr(null);
    setMsg(null);
    const r = await roomIntent({
      spaceId,
      date,
      pkg: pkgForRange(sel.start, sel.end),
      start: minToHHMM(sel.start),
      end: minToHHMM(sel.end),
      people: Math.max(1, party ?? 1),
      company: 'Member booking',
      savedPaymentMethod: savedCard.id,
    });
    if (r.ok && r.data.paid) return bookedOk();
    if (r.ok && r.data.requiresAction && r.data.clientSecret) {
      try {
        const stripe = await loadStripe();
        const { error, paymentIntent } = await stripe.handleCardAction(r.data.clientSecret);
        if (error) {
          setBusyAction(false);
          setPayErr(error.message || 'That payment didn’t go through — please try again.');
          return;
        }
        if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) return bookedOk();
        setBusyAction(false);
        setPayErr('Payment needs another step — please try again.');
      } catch {
        setBusyAction(false);
        setPayErr('Couldn’t complete the payment — please try again.');
      }
      return;
    }
    setBusyAction(false);
    setPayErr(friendly((r.data as { error?: string } | undefined)?.error) || 'That card was declined — try another.');
  }

  // New card (or "use a different card"): start the paid flow, then mount Stripe's Payment Element
  // inline. `saveCard` keeps it on file for next time, with the member's consent (the checkbox).
  async function toPayment() {
    if (!sel || !spaceId) return;
    setBusyAction(true);
    setPayErr(null);
    setMsg(null);
    const r = await roomIntent({
      spaceId,
      date,
      pkg: pkgForRange(sel.start, sel.end),
      start: minToHHMM(sel.start),
      end: minToHHMM(sel.end),
      people: Math.max(1, party ?? 1),
      company: 'Member booking',
      saveCard: saveCardChecked,
    });
    setBusyAction(false);
    if (!r.ok || !r.data.clientSecret) {
      setPayErr(friendly((r.data as { error?: string } | undefined)?.error));
      return;
    }
    setPayLines(r.data.lines || null);
    setPayPence(r.data.amountPence);
    setPayIntentId(r.data.clientSecret.split('_secret')[0]);
    setPayStep('pay');
    try {
      const stripe = await loadStripe();
      const node = await waitForNode(payMountRef);
      if (!stripe || !node) throw new Error('stripe');
      stripeRef.current = stripe;
      const elements = stripe.elements({ clientSecret: r.data.clientSecret, appearance: { theme: 'flat' } });
      const payEl = elements.create('payment', { layout: 'tabs' });
      payEl.mount(node);
      elementsRef.current = elements;
    } catch {
      setPayErr('Couldn’t load the secure payment form — please try again.');
      setPayStep('none');
    }
  }

  async function pay() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusyAction(true);
    setPayErr(null);
    // Sync the save-card choice (made beside the card) onto the PaymentIntent before confirming.
    if (payIntentId) await roomSetSave(payIntentId, saveCardChecked);
    const { error, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (error) {
      setBusyAction(false);
      setPayErr(error.message || 'That payment didn’t go through — please try again.');
      return;
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) return bookedOk();
    setBusyAction(false);
    setPayErr('Payment needs another step — please try again.');
  }

  async function cancel(id: string) {
    setBusyAction(true);
    await cancelBooking(id);
    await loadMine();
    await reloadAvail();
    setBusyAction(false);
  }

  function openEdit(b: MyBooking) {
    setEditId(b.id);
    setEDate(b.date);
    setEStart(minToHHMM(b.startMin));
    setEEnd(minToHHMM(b.endMin));
    setAmendErr(null);
  }

  async function saveAmend(id: string) {
    if (eEnd <= eStart) {
      setAmendErr('The end time must be after the start.');
      return;
    }
    setBusyAction(true);
    setAmendErr(null);
    const r = await amendBooking(id, eDate, eStart, eEnd);
    if (!r.ok) {
      setAmendErr(friendly((r.data as { error?: string } | undefined)?.error));
      setBusyAction(false);
      return;
    }
    setEditId(null);
    await loadMine();
    await reloadAvail();
    setBusyAction(false);
  }

  if (loading) return <p className={styles.state}>Loading…</p>;
  if (!member) return <p className={styles.state}>Please sign in — taking you to the login page…</p>;

  // A plan is what carries meeting-room hours; a day-pass visitor gets the pods.
  const hasPlan = (member?.planConnections?.length ?? 0) > 0;
  // This member's plan → included room hours + their extra-time discount, for the booking note.
  const memberSlug = (() => {
    const conns = (member?.planConnections || []) as { planId?: string; active?: boolean; status?: string }[];
    const active = conns.find((c) => c?.active || c?.status === 'ACTIVE') || conns[0];
    return active ? planSlugFromMemberstackId(active.planId) : null;
  })();
  const includedHours = memberSlug ? PLAN_ROOM_HOURS[memberSlug] ?? 0 : 0;
  const memberPct = memberSlug ? Math.round((MEMBER_ROOM_DISCOUNT[memberSlug] || 0) * 100) : 0;
  // Is the chosen booking over the member's included room hours? If so we show the inline pay flow.
  const selectedSpace = spaces.find((s) => s.id === spaceId);
  const selectedIsRoom = !!selectedSpace && selectedSpace.type !== 'Phone pod';
  const selHours = sel ? Math.round(((sel.end - sel.start) / 60) * 100) / 100 : 0;
  const overCap = selectedIsRoom && hasPlan && memberPct > 0 && !!roomStatus && !!sel && selHours > (roomStatus.remaining ?? 0) + 1e-6;
  const capOf = (sp: Space) => sp.capacity ?? 99;
  const fits = (sp: Space) => party === null || capOf(sp) >= party;
  // The best match is the smallest space that fits. Anything the same size is a fair
  // alternative (two pods), so show those too rather than picking one arbitrarily.
  const bestCap = party === null ? null : Math.min(...spaces.filter(fits).map(capOf), 99);
  const shortlist =
    party === null || showAllRooms ? spaces : spaces.filter((sp) => fits(sp) && capOf(sp) === bestCap);

  const open = avail?.openMin ?? 8 * 60;
  const close = avail?.closeMin ?? 18 * 60;
  // Times that have already passed are noise you have to read past — on today, start the
  // grid at the next bookable slot. Other days are unaffected.
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = date === toISO(new Date());
  const firstSlot = isToday ? Math.ceil(nowMinutes / SLOT) * SLOT : open;
  const slots: number[] = [];
  for (let s = Math.max(open, firstSlot); s < close; s += SLOT) slots.push(s);
  const spaceName = (id: string | null) => spaces.find((x) => x.id === id)?.name ?? 'Room';

  const hint = sel
    ? `Selected ${fmtRange(sel.start, sel.end)}`
    : start !== null
      ? `Start ${minToHHMM(start)} — now tap your end time`
      : 'Tap a start time, then an end time (or use a preset)';

  // While choosing an end time, preview the whole block from the start to the
  // hovered slot, so it's obvious you're booking the range (not a single slot).
  const previewRange =
    start !== null && !sel && hover !== null && hover !== start
      ? (() => {
          const lo = Math.min(start, hover);
          const hi = Math.max(start, hover) + SLOT;
          return rangeFree(lo, hi) ? { lo, hi } : null;
        })()
      : null;

  return (
    <div>
      <div className={styles.head}>
        <h1 className={styles.title}>Book a room or pod</h1>
        <a className={`${styles.back} ${styles.backDesktop}`} href="/dashboard">
          ← Dashboard
        </a>
      </div>

      {/* Asked before the rooms, because the room you see first is the room you take. */}
      <div className={styles.party} role="group" aria-label="How many people?">
        <span className={styles.partyLabel}>Who&rsquo;s it for?</span>
        <div className={styles.partyOpts}>
          {[
            { n: 1, label: 'Just me', hint: 'A call or some quiet' },
            { n: 4, label: 'Up to 4 people', hint: 'A small meeting' },
            { n: 5, label: '5 or more', hint: 'The big table' },
          ].map((o) => (
            <button
              key={o.n}
              type="button"
              className={`${styles.partyBtn} ${party === o.n ? styles.partyOn : ''}`}
              onClick={() => {
                setParty(o.n);
                setShowAllRooms(false);
                setSpaceId(null);
              }}
            >
              <strong>{o.label}</strong>
              <span>{o.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <h2 className={styles.pickTitle}>{party === null ? 'Choose a room or pod' : 'Choose a room'}</h2>
      <div className={styles.spaces}>
        {shortlist.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.space} ${spaceId === s.id ? styles.spaceOn : ''}`}
            onClick={() => { setSpaceId(s.id); setJustBooked(false); }}
          >
            <span className={styles.spaceName}>{s.name}</span>
            <span className={styles.spaceMeta}>
              {s.type === 'Phone pod' ? 'Phone pod' : `Up to ${s.capacityLabel ?? s.capacity ?? ''}`}
              {s.type !== 'Phone pod' && !hasPlan ? ' · plan needed' : ''}
            </span>
          </button>
        ))}
      </div>

      {party !== null && !showAllRooms && shortlist.length < spaces.length ? (
        <button type="button" className={styles.showAll} onClick={() => setShowAllRooms(true)}>
          Choose another room
        </button>
      ) : null}

      {party === 1 ? (
        <p className={styles.podNudge}>
          A phone pod is usually best for calls — it keeps the meeting rooms free for groups. Rooms are there if you need one.
        </p>
      ) : null}

      {spaceId && spaces.find((s) => s.id === spaceId)?.type !== 'Phone pod' && hasPlan && includedHours > 0 ? (
        <p className={styles.roomNote}>
          Your plan includes <strong>{includedHours}h</strong> of meeting-room time a month, free to book here. Beyond that,
          extra time is charged per hour{memberPct ? ` at ${memberPct}% off — your member rate` : ' at your member rate'} — once
          you&rsquo;ve picked a room and date below, you can pay for the extra time right here at checkout. Phone pods are always
          free, up to 2 hours at a time.
        </p>
      ) : null}

      {!spaceId ? (
        <p className={styles.state}>Choose a room or pod above to see its availability.</p>
      ) : (
        <>
          <div className={styles.bookDate}>
            <WeekStrip value={date} onSelect={(d) => { setDate(d); setJustBooked(false); }} />
            <button type="button" className={styles.dateBtn} onClick={() => setPickerOpen(true)}>
              + Pick a date
            </button>
          </div>

          {/* Presets are half-/full-day blocks — meaningless for a phone pod (2 hours max), so a pod
              just uses the time grid below. */}
          {spaces.find((s) => s.id === spaceId)?.type !== 'Phone pod' ? (
            <div className={styles.presets}>
              <button type="button" className={styles.preset} onClick={() => preset(8 * 60, 13 * 60)}>
                Morning · 08–13
              </button>
              <button type="button" className={styles.preset} onClick={() => preset(13 * 60, 18 * 60)}>
                Afternoon · 13–18
              </button>
              <button type="button" className={styles.preset} onClick={() => preset(8 * 60, 18 * 60)}>
                Full day
              </button>
            </div>
          ) : null}

          <div className={styles.hintRow}>
            <span className={styles.hint}>{hint}</span>
            {start !== null || sel ? (
              <button type="button" className={styles.clear} onClick={clearSel}>
                Clear
              </button>
            ) : null}
          </div>

          {/* Feedback sits HERE — right under the presets/grid where the tap happened — so a
              "that block's taken" notice is seen, not buried at the foot of a long page. */}
          {msg ? (
            <p className={styles.bookMsg} role="status">
              {msg}
            </p>
          ) : null}
          <BuyPassSheet
            open={buyPass}
            onClose={() => setBuyPass(false)}
            onPurchased={async () => {
              setBuyPass(false);
              setBlocked(null);
              setMsg('Day pass added — you can book now.');
            }}
          />
          {blocked ? (
            <div className={styles.noDays} role="status">
              <strong className={styles.noDaysTitle}>{blocked === 'needs-plan-or-pass' ? 'You’ll need a plan or a day pass' : 'You’ve no co-working days left'}</strong>
              <p className={styles.noDaysBody}>Booking a room or pod uses one of your co-working days for that day. Add a day pass for one-offs, or change plan if you’re here often — then book.</p>
              <div className={styles.noDaysActions}>
                <button type="button" className={styles.noDaysPrimary} onClick={() => setBuyPass(true)}>
                  Buy a day pass
                </button>
                <a className={styles.noDaysGhost} href="/plan/">
                  {blocked === 'needs-plan-or-pass' ? 'Choose a plan' : 'Change plan'}
                </a>
              </div>
            </div>
          ) : null}

          {loadingAvail ? (
            <p className={styles.state}>Checking availability…</p>
          ) : (
            <div className={styles.grid} onMouseLeave={() => setHover(null)}>
              {slots.map((s) => {
                const isBusy = slotBusy(s);
                const isSel = !!sel && s >= sel.start && s < sel.end;
                const isStart = start === s && !sel;
                const isPreview = !!previewRange && s >= previewRange.lo && s < previewRange.hi;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isBusy}
                    onClick={() => clickSlot(s)}
                    onMouseEnter={() => setHover(s)}
                    className={`${styles.slot} ${isBusy ? styles.slotBusy : ''} ${isSel ? styles.slotSel : ''} ${isStart ? styles.slotStart : ''} ${isPreview ? styles.slotPreview : ''}`}
                  >
                    {minToHHMM(s)}
                  </button>
                );
              })}
            </div>
          )}

          {isWeekendISO(date) ? (
            <p className={styles.weekendNote}>
              {dayLabel(date)} is a weekend — outside our regular Monday–Friday hours, but the space is yours to book as a
              member.
            </p>
          ) : null}

          {overCap ? (
            // Over the member's included hours → pay for the extra time, inline, at their tier rate.
            <div className={styles.payBox}>
              <span className={styles.selLabel}>
                {sel ? `${spaceName(spaceId)} · ${dayLabel(date)} · ${fmtRange(sel.start, sel.end)}` : ''}
              </span>
              <p className={styles.payNote}>
                You’ve used your {includedHours}h of included room time this month. Extra time is charged per hour
                {memberPct ? ` at ${memberPct}% off — your member rate` : ''}.
              </p>
              {payLines ? (
                <div className={styles.payLines}>
                  {payLines.map((l, i) => (
                    <div key={i} className={styles.payLine}>
                      <span>{l.label}</span>
                      <span>{money(l.amount)}</span>
                    </div>
                  ))}
                  <div className={styles.payLineTotal}>
                    <span>Total</span>
                    <span>{money((payPence ?? 0) / 100)} inc. VAT</span>
                  </div>
                </div>
              ) : null}
              {payStep === 'pay' ? (
                // Entering a new card via Stripe Elements, with the save-card choice right beside it.
                <>
                  <div ref={payMountRef} className={styles.payEl} />
                  <label className={styles.saveRow}>
                    <input type="checkbox" checked={saveCardChecked} onChange={() => setSaveCardChecked((v) => !v)} />
                    <span>Save this card for faster booking next time</span>
                  </label>
                  <Button variant="primary" fullWidth onClick={pay} disabled={busyAction} iconAfter="arrow-right">
                    {busyAction ? 'Taking payment…' : `Pay ${money((payPence ?? 0) / 100)}`}
                  </Button>
                  <p className={styles.paySecure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
                </>
              ) : savedCard && !useNewCard ? (
                // One-tap: pay with the card already on file (you always see which card).
                <>
                  <div className={styles.savedCardRow}>
                    <span>
                      Paying with {prettyBrand(savedCard.brand)} •••• {savedCard.last4}
                    </span>
                    <button type="button" className={styles.linkBtn} onClick={() => setUseNewCard(true)}>
                      Use a different card
                    </button>
                  </div>
                  <Button variant="primary" fullWidth onClick={payWithSaved} disabled={busyAction} iconAfter="arrow-right">
                    {busyAction ? 'Taking payment…' : `Pay ${money((payPence ?? 0) / 100)}`}
                  </Button>
                  <p className={styles.paySecure}>One tap — paid securely with Stripe.</p>
                </>
              ) : (
                // No saved card, or the member chose to enter a different one.
                <>
                  {savedCard && useNewCard ? (
                    <button type="button" className={styles.linkBtn} onClick={() => setUseNewCard(false)}>
                      ‹ Use {prettyBrand(savedCard.brand)} •••• {savedCard.last4} instead
                    </button>
                  ) : null}
                  <Button variant="primary" fullWidth onClick={toPayment} disabled={!sel || busyAction} iconAfter="arrow-right">
                    {busyAction ? 'Checking…' : 'Continue to payment'}
                  </Button>
                </>
              )}
              {payErr ? <p className={styles.msg}>{payErr}</p> : null}
            </div>
          ) : (
            <div className={styles.confirm}>
              <span className={styles.selLabel}>
                {justBooked
                  ? 'Booked ✓ — it’s in your bookings below.'
                  : sel
                    ? `${spaceName(spaceId)} · ${dayLabel(date)} · ${fmtRange(sel.start, sel.end)}`
                    : 'Choose a time above.'}
              </span>
              <Button variant={justBooked ? 'accent' : 'primary'} onClick={confirm} disabled={busyAction || !sel}>
                {busyAction ? 'Booking…' : justBooked ? 'Booked ✓' : isWeekendISO(date) ? 'Book the weekend' : 'Confirm booking'}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Booking a room = they'll be in that day, so offer to mark them in (no separate check-in). */}
      {justBooked && offerInDate ? (
        <div className={styles.inOffer} ref={offerRef}>
          {inNote ? (
            <span className={styles.inOfferDone}>✓ {inNote}</span>
          ) : (
            <>
              <span className={styles.inOfferText}>
                You’ll be in on {dayLabel(offerInDate)} for this — shall we mark you in for the day too? Then there’s nothing to
                check in on arrival.
              </span>
              <div className={styles.inOfferBtns}>
                <button type="button" className={styles.inOfferBtn} onClick={() => markInForDay('Full')} disabled={busyAction}>
                  Yes · full day
                </button>
                <button type="button" className={styles.inOfferBtn} onClick={() => markInForDay('Half')} disabled={busyAction}>
                  Half day
                </button>
                <button type="button" className={styles.inOfferSkip} onClick={() => setOfferInDate(null)} disabled={busyAction}>
                  No thanks
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {mine.length ? (
        <div className={styles.mine}>
          <h2 className={styles.mineTitle}>Your upcoming bookings</h2>
          {mine.map((b) => (
            <div key={b.id} className={styles.mineRow}>
              <span>
                {spaceName(b.space)} · {dayLabel(b.date)} · {fmtRange(b.startMin, b.endMin)}
              </span>
              <span className={styles.mineBtns}>
                {b.kind === 'Member' ? (
                  <button
                    type="button"
                    className={styles.amend}
                    onClick={() => (editId === b.id ? setEditId(null) : openEdit(b))}
                    disabled={busyAction && editId !== b.id}
                  >
                    {editId === b.id ? 'Close' : 'Amend'}
                  </button>
                ) : null}
                <button type="button" className={styles.cancel} onClick={() => cancel(b.id)} disabled={busyAction}>
                  Cancel
                </button>
              </span>
              {editId === b.id ? (
                <div className={styles.amendEditor}>
                  <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                  <select value={eStart} onChange={(e) => setEStart(e.target.value)}>
                    {AMEND_TIMES.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select value={eEnd} onChange={(e) => setEEnd(e.target.value)}>
                    {AMEND_TIMES.filter((t) => t > eStart).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="primary" onClick={() => saveAmend(b.id)} disabled={busyAction}>
                    Save
                  </Button>
                  {amendErr ? <p className={styles.amendErr}>{amendErr}</p> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <DatePickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={setDate} single allowWeekend planned={[date]} />
    </div>
  );
}

function friendly(code?: string): string {
  switch (code) {
    case 'slot-taken':
      return 'Sorry, that slot was just taken — pick another.';
    case 'double-book':
      return 'You already have a booking at that time — cancel it first to book another room.';
    case 'outside-hours':
      return 'Bookings are Monday–Friday, 08:00–18:00.';
    case 'closed-weekend':
      return 'The Quarter is open Monday to Friday.';
    case 'weekend':
      return 'Paid extra time is Monday–Friday. For a weekend booking, chat to the team.';
    case 'card-declined':
      return 'That card was declined — try a different card.';
    case 'closed-day':
      return 'The Quarter is closed that day (bank holiday or seasonal closure).';
    case 'bad-increment':
      return 'Please use 30-minute increments.';
    // Entitlement refusals. Each says what to do next rather than only what went wrong —
    // these are the messages someone hits when they're keen to book, not doing anything odd.
    case 'rooms-need-plan':
      return 'Meeting rooms come with a membership plan. Phone pods are open to you today — or talk to us about a plan.';
    case 'no-access-that-day':
      return 'You don’t have access on that day yet — buy a day pass for it first, then book the space.';
    case 'pod-too-long':
      return 'Phone pods are two hours at a time, so everyone gets a turn. Longer than that is possible — just ask the team.';
    case 'cap-exceeded':
      return 'That would use more meeting-room hours than your plan includes this month. Ask the team, or book and pay for the extra time.';
    // Booking a room/pod uses a co-working day for that date; this member has none left.
    case 'no-allowance':
    case 'needs-plan-or-pass':
      return 'Booking a room or pod uses one of your co-working days for that day, and you’ve none left. Add day passes or upgrade your plan on the Plan page, then book.';
    // A booking holds a co-working day for its date — move it by cancelling + re-booking.
    case 'date-move-unsupported':
      return 'To move a booking to another day, cancel it and book the new day — that keeps your co-working days right.';
    case 'network':
      return 'Network problem — please try again.';
    default:
      return 'Could not book — please try again.';
  }
}
