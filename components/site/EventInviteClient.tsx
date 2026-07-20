'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { inviteLookup, inviteAccept, type CommsEvent } from '@/lib/booking';
import styles from './EventInviteClient.module.css';

type Ev = CommsEvent & { end: string | null; description: string };

function whenLabel(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })
      + ' · '
      + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });
  } catch {
    return '';
  }
}

/**
 * /invite?token=… — where a member's friend lands.
 *
 * Everything here is shaped by one fact: this person has no account, no reason to trust us
 * yet, and is deciding in about ten seconds. So there is no sign-up, no password, and only
 * two fields. The token carries the event and who invited them, read from the query string
 * rather than a dynamic route — which also keeps it working under a static export.
 */
export function EventInviteClient() {
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'gone'>('loading');
  const [ev, setEv] = useState<Ev | null>(null);
  const [invitedBy, setInvitedBy] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Read the token from location rather than useSearchParams: the latter forces a
    // Suspense boundary and fights the static export for no gain here.
    const t = new URLSearchParams(window.location.search).get('token') || '';
    setToken(t);
    if (!t) {
      setState('gone');
      return;
    }
    inviteLookup(t).then((r) => {
      if (r.ok) {
        setEv(r.data.event as Ev);
        setInvitedBy(r.data.invitedBy);
        setState('ready');
      } else {
        setState('gone');
      }
    });
  }, []);

  async function accept() {
    if (!name.trim() || !email.includes('@')) {
      setErr('We just need your name and an email so we know to expect you.');
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await inviteAccept(token, name.trim(), email.trim());
    setBusy(false);
    if (r.ok) setState('done');
    else setErr('Something went wrong there — try again, or just reply to the email.');
  }

  if (state === 'loading') return <main className={styles.wrap}><p className={styles.meta}>One moment…</p></main>;

  if (state === 'gone') {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.h1}>This invitation has expired</h1>
          <p className={styles.meta}>
            The event may have passed, or the link was incomplete. If you were expecting to come to something,
            email <a href="mailto:info@thequarter.work">info@thequarter.work</a> and we will sort it out.
          </p>
        </div>
      </main>
    );
  }

  if (state === 'done') {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <span className={styles.tick}><Icon name="check" size={26} color="var(--ink-900)" strokeWidth={2.6} /></span>
          <h1 className={styles.h1}>You&rsquo;re on the list</h1>
          <p className={styles.meta}>
            We&rsquo;ve let {invitedBy} know you&rsquo;re coming. See you at {ev?.title} — just come to the door on Burgate
            and someone will let you in.
          </p>
          <p className={styles.fine}>Food and drinks are on us. Nothing to bring, nothing to pay.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>You&rsquo;re invited</span>
        <h1 className={styles.h1}>{invitedBy} has invited you to The Quarter</h1>

        <div className={styles.event}>
          <strong>{ev?.title}</strong>
          <span>{whenLabel(ev?.start ?? null)}</span>
          {ev?.location ? <span>{ev.location}</span> : null}
        </div>

        {ev?.description ? <p className={styles.meta}>{ev.description}</p> : null}

        <p className={styles.meta}>
          You&rsquo;d be our guest — food and drinks are on us. It&rsquo;s a relaxed evening and a good way to meet
          people working nearby in Canterbury.
        </p>

        <label className={styles.field}>
          <span>Your name</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className={styles.field}>
          <span>Your email</span>
          <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>

        {err ? <p className={styles.err}>{err}</p> : null}

        <button type="button" className={styles.cta} onClick={accept} disabled={busy}>
          {busy ? 'Just a moment…' : 'Yes, I\u2019ll be there'}
        </button>

        <p className={styles.fine}>
          Guest places are offered as a courtesy and limited by space, so very occasionally we may have to say no —
          we&rsquo;d always let you know in good time.
        </p>
      </div>
    </main>
  );
}
