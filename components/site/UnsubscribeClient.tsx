'use client';

import { useEffect, useState } from 'react';
import { unsubLookup, unsubSet } from '@/lib/booking';
import styles from './EventInviteClient.module.css';

/**
 * /unsubscribe?t=… — one tap, no login.
 *
 * Someone here is mildly irritated at best. Anything that looks like a retention funnel
 * makes that worse, so it does the thing first and explains after, and the way back in is
 * offered plainly rather than hidden. It is also explicit that this does not touch booking
 * or membership email — the commonest fear is losing something they actually need.
 */
export function UnsubscribeClient() {
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'resubscribed' | 'manual' | 'bad'>('loading');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || '';
    setToken(t);
    if (!t) {
      setState('bad');
      return;
    }
    unsubLookup(t).then((r) => {
      if (r.ok) {
        setEmail(r.data.email);
        setState('ready');
      } else setState('bad');
    });
  }, []);

  async function set(resubscribe: boolean) {
    const r = await unsubSet(token, resubscribe);
    // The endpoint answers 200 with ok:false when there is no member record to store the
    // objection against. Telling someone they are unsubscribed when they are not is worse
    // than admitting we have to do it by hand.
    if (r.ok && r.data?.ok !== false) setState(resubscribe ? 'resubscribed' : 'done');
    else setState('manual');
  }

  if (state === 'loading') return <main className={styles.wrap}><p className={styles.meta}>One moment…</p></main>;

  if (state === 'bad') {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.h1}>That link didn&rsquo;t work</h1>
          <p className={styles.meta}>
            Email <a href="mailto:info@thequarter.work">info@thequarter.work</a> and we&rsquo;ll take you off the list by hand.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        {state === 'manual' ? (
          <>
            <h1 className={styles.h1}>We&rsquo;ll take you off by hand</h1>
            <p className={styles.meta}>
              We couldn&rsquo;t do it automatically for <strong>{email}</strong> — that address doesn&rsquo;t have an
              account with us. Email <a href="mailto:info@thequarter.work">info@thequarter.work</a> and we&rsquo;ll
              remove you today. We&rsquo;re sorry to make you ask twice.
            </p>
          </>
        ) : state === 'done' ? (
          <>
            <h1 className={styles.h1}>Done — no more of those</h1>
            <p className={styles.meta}>
              We won&rsquo;t send <strong>{email}</strong> any more event invitations or notes like that.
            </p>
            <p className={styles.meta}>
              You&rsquo;ll still get anything to do with your bookings, your membership and events you&rsquo;ve
              already said yes to — those aren&rsquo;t marketing, and you&rsquo;d miss things without them.
            </p>
            <button type="button" className={styles.cta} onClick={() => set(true)}>
              Actually, put me back on
            </button>
          </>
        ) : state === 'resubscribed' ? (
          <>
            <h1 className={styles.h1}>Welcome back</h1>
            <p className={styles.meta}>We&rsquo;ll let {email} know what&rsquo;s on again.</p>
          </>
        ) : (
          <>
            <h1 className={styles.h1}>Stop the occasional emails?</h1>
            <p className={styles.meta}>
              This turns off event invitations and the friendly notes we send to <strong>{email}</strong>.
            </p>
            <p className={styles.meta}>
              Anything to do with your bookings, your membership, or an event you&rsquo;ve already said yes to
              will still reach you.
            </p>
            <button type="button" className={styles.cta} onClick={() => set(false)}>
              Yes, unsubscribe me
            </button>
            <p className={styles.fine}>Changed your mind later? Just tell any of us and we&rsquo;ll switch it back on.</p>
          </>
        )}
      </div>
    </main>
  );
}
