'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { getCarnet, carnetIntent, announceBalancesChanged } from '@/lib/booking';
import { DAY_PASS_PRICE } from '@/lib/rewards';
import { PREVIEW } from '@/lib/devMock';
import styles from './DaySheet.module.css';
import pay from './RoomBooking.module.css';

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
async function waitForNode(ref: { current: HTMLDivElement | null }): Promise<HTMLDivElement | null> {
  for (let i = 0; i < 40 && !ref.current; i++) await new Promise((r) => setTimeout(r, 16));
  return ref.current;
}
const gbp = (n: number) => `£${n.toFixed(2)}`;

/**
 * Buy ONE day pass without leaving the moment you're in. Opened straight from the "no days left"
 * prompts (check-in, room booking) so a member can pay the £21.60 and carry on booking — rather than
 * being sent to the Plan page to hunt for the passes pane and scroll. The Payment Element mounts the
 * instant the sheet opens. On success the wallet tops up (via the Stripe webhook) and the caller is
 * told, so it can re-read the balance and let the booking through.
 */
export function BuyPassSheet({ open, onClose, onPurchased }: { open: boolean; onClose: () => void; onPurchased?: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'pay' | 'done' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setBusy(false);
    setPhase('loading');
    let cancelled = false;
    (async () => {
      if (PREVIEW) {
        if (!cancelled) {
          setErr('Checkout runs on the live site — this is a preview.');
          setPhase('error');
        }
        return;
      }
      const r = await carnetIntent(1);
      if (cancelled) return;
      if (!r.ok || !r.data.clientSecret) {
        setErr('We couldn’t start checkout just now — please try again.');
        setPhase('error');
        return;
      }
      setPhase('pay');
      try {
        const stripe = await loadStripe();
        const node = await waitForNode(mountRef);
        if (!stripe || !node) throw new Error('stripe');
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret: r.data.clientSecret, appearance: { theme: 'flat' } });
        const el = elements.create('payment', { layout: 'tabs' });
        el.mount(node);
        elementsRef.current = elements;
      } catch {
        if (!cancelled) {
          setErr('Couldn’t load the secure payment form — please try again.');
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Escape + lock the page behind the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function payNow() {
    if (!stripeRef.current || !elementsRef.current) return;
    setBusy(true);
    setErr(null);
    const { error, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (error) {
      setErr(error.message || 'That payment didn’t go through — please try again.');
      setBusy(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      setPhase('done');
      setBusy(false);
      // The webhook top-up can lag a moment; nudge the dashboard + poll so the new pass shows.
      announceBalancesChanged();
      let n = 0;
      const t = setInterval(async () => {
        const r = await getCarnet();
        if (r.ok) announceBalancesChanged({ carnetRemaining: r.data.carnet.remaining });
        if ((n += 1) >= 4) clearInterval(t);
      }, 2500);
      onPurchased?.();
    } else {
      setErr('That payment didn’t complete — please try again.');
      setBusy(false);
    }
  }

  const sheet = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Buy a day pass" onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <span className={styles.grab} aria-hidden="true" />

        {phase === 'done' ? (
          <div className={styles.doneWrap}>
            <span className={styles.doneTick} aria-hidden="true">
              ✓
            </span>
            <h2 className={styles.title}>Day pass added</h2>
            <p className={styles.note}>It’s in your wallet — use it to check in or book today, or any day within the next year.</p>
            <button type="button" className={styles.cta} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>Buy a day pass</h2>
            <p className={styles.meta}>One day pass · {gbp(DAY_PASS_PRICE)} — covers a full co-working day, yours to use any time within a year.</p>

            <div className={pay.payBox}>
              <div ref={mountRef} className={pay.payEl} />
              {phase === 'loading' ? <p className={styles.meta}>Loading secure payment…</p> : null}
              {err ? <p className={styles.error}>{err}</p> : null}
              <button type="button" className={styles.cta} onClick={payNow} disabled={busy || phase !== 'pay'}>
                {busy ? 'Taking payment…' : `Pay ${gbp(DAY_PASS_PRICE)}`}
              </button>
              <button type="button" className={styles.linkDanger} onClick={onClose} disabled={busy}>
                Not now
              </button>
              <p className={pay.secure}>Paid securely with Stripe · Apple Pay &amp; cards.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : null;
}
