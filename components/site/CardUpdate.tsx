'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/commerce';
import { createSetupIntent, setDefaultCard } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import styles from './CardUpdate.module.css';

declare global {
  interface Window {
    Stripe?: (key: string) => unknown;
  }
}

let stripePromise: Promise<unknown> | null = null;
/** Load Stripe.js once and return a Stripe instance (client-only). */
function loadStripe(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Stripe) return Promise.resolve(window.Stripe(STRIPE_PUBLISHABLE_KEY));
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.async = true;
      s.onload = () => resolve(window.Stripe ? window.Stripe(STRIPE_PUBLISHABLE_KEY) : null);
      s.onerror = () => reject(new Error('stripe-load-failed'));
      document.head.appendChild(s);
    });
  }
  return stripePromise;
}

// Stripe.js can resolve before React has committed the re-render that mounts the card
// field (e.g. when Stripe.js is already cached), so the mount node may not exist yet.
// Wait briefly for it rather than bailing immediately on a null ref.
async function waitForNode(ref: { current: HTMLDivElement | null }): Promise<HTMLDivElement | null> {
  for (let i = 0; i < 40 && !ref.current; i++) await new Promise((r) => setTimeout(r, 16));
  return ref.current;
}

/**
 * Update the member's card without leaving the app. The card number is entered
 * only into Stripe's own iframe (Stripe Elements) — this app never sees it. We
 * create a SetupIntent server-side, confirm it here, then set the new card default.
 */
export function CardUpdate({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripeRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardRef = useRef<any>(null);

  useEffect(() => {
    if (!open || PREVIEW) return;
    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe: any = await loadStripe();
        const node = await waitForNode(mountRef);
        if (cancelled || !stripe || !node) return;
        stripeRef.current = stripe;
        const elements = stripe.elements();
        const card = elements.create('card', { hidePostalCode: false });
        card.mount(node);
        cardRef.current = card;
        setReady(true);
      } catch {
        setErr('Couldn’t load the secure card form — please try again.');
      }
    })();
    return () => {
      cancelled = true;
      try {
        cardRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      cardRef.current = null;
      setReady(false);
    };
  }, [open]);

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const si = await createSetupIntent();
      if (!si.ok || !si.data.clientSecret) {
        setErr('Couldn’t start the update — please try again.');
        setBusy(false);
        return;
      }
      const result = await stripeRef.current.confirmCardSetup(si.data.clientSecret, { payment_method: { card: cardRef.current } });
      if (result.error) {
        setErr(result.error.message || 'That card was declined — please check the details.');
        setBusy(false);
        return;
      }
      const pm = result.setupIntent?.payment_method;
      const r = await setDefaultCard(typeof pm === 'string' ? pm : pm?.id);
      if (!r.ok) {
        setErr('Card saved, but we couldn’t set it as default — please try again.');
        setBusy(false);
        return;
      }
      setMsg('Card updated — thank you.');
      setOpen(false);
      onDone?.();
    } catch {
      setErr('Something went wrong — please try again.');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <div className={styles.wrap}>
        <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
          Update card
        </button>
        {msg ? <span className={styles.msg}>{msg}</span> : null}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <span className={styles.label}>New card details</span>
      {PREVIEW ? <p className={styles.secure}>The secure card form loads on the live site.</p> : <div ref={mountRef} className={styles.cardEl} />}
      {err ? <p className={styles.err}>{err}</p> : null}
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={save} disabled={busy || (!ready && !PREVIEW)}>
          {busy ? 'Saving…' : 'Save card'}
        </Button>
        <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      <p className={styles.secure}>Entered securely with Stripe — we never see your card number.</p>
    </div>
  );
}
