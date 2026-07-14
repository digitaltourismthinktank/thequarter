'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { pushSubscribe } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import styles from './NotificationToggle.module.css';

/**
 * Lets a signed-in member turn on push notifications (booking confirmations, weekend
 * approvals, events, birthday treats…). Hidden unless the browser supports push AND
 * a VAPID public key is configured — so it's an invisible no-op until keys are set.
 */
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationToggle() {
  const [state, setState] = useState<'hidden' | 'idle' | 'busy' | 'on'>('hidden');

  useEffect(() => {
    if (PREVIEW || !VAPID) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    setState('idle');
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((s) => {
          if (s) setState('on');
        })
        .catch(() => {});
    }
  }, []);

  async function enable() {
    if (!VAPID) return;
    setState('busy');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState('idle');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
      const r = await pushSubscribe(sub.toJSON());
      setState(r.ok ? 'on' : 'idle');
    } catch {
      setState('idle');
    }
  }

  if (state === 'hidden') return null;

  return (
    <button type="button" className={styles.toggle} data-on={state === 'on' ? 'true' : 'false'} onClick={state === 'on' ? undefined : enable} disabled={state === 'busy' || state === 'on'}>
      <Icon name="bell" size={15} color={state === 'on' ? 'var(--gold-700)' : 'var(--stone-700)'} />
      {state === 'on' ? 'Notifications on' : state === 'busy' ? 'Turning on…' : 'Turn on notifications'}
    </button>
  );
}
