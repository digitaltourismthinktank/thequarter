'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import styles from './InstallPrompt.module.css';

/**
 * "Add The Quarter to your phone" — an installable-PWA prompt shown to signed-in
 * members. On Android/Chrome it captures beforeinstallprompt and offers a one-tap
 * install; on iOS Safari (which has no such event) it shows the Add-to-Home-Screen
 * steps. Hidden once installed (standalone) or dismissed. Sells the member benefits.
 */
export function InstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferred, setDeferred] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nav = window.navigator as unknown as { standalone?: boolean; userAgent: string };
    const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    if (standalone) return; // already installed — nothing to prompt
    try {
      if (localStorage.getItem('q-install-dismissed') === '1') return;
    } catch {
      /* ignore */
    }
    const ua = nav.userAgent || '';
    // iOS "Add to Home Screen" is Safari-only (not Chrome/Firefox on iOS).
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (ios) {
      setIsIOS(true);
      setShow(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem('q-install-dismissed', '1');
    } catch {
      /* ignore */
    }
  }
  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div className={styles.card}>
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss">
        <Icon name="x" size={16} />
      </button>
      <div className={styles.head}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className={styles.icon} />
        <div>
          <h3 className={styles.title}>Add The Quarter to your phone</h3>
          <p className={styles.sub}>Your card, check-in and bookings — one tap from your home screen.</p>
        </div>
      </div>
      <ul className={styles.benefits}>
        <li>One-tap check-in when you arrive</li>
        <li>Your Quarter Card always in your pocket</li>
        <li>Book a room or a pod in seconds</li>
        <li>Opens full-screen, like an app — no browser bars</li>
      </ul>
      {isIOS ? (
        <p className={styles.ios}>
          In Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <Button variant="accent" size="sm" onClick={install} iconAfter="arrow-right">
          Add to home screen
        </Button>
      )}
    </div>
  );
}
