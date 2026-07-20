'use client';

import { useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { inviteFriend } from '@/lib/booking';
import styles from './InviteFriend.module.css';

/**
 * "Bring someone" — on an event a member is already coming to.
 *
 * Placed here rather than on a page of its own because the moment someone decides to come
 * is the moment they think of who else might enjoy it. It stays folded away until asked
 * for: a permanently open form on every event card reads as a demand to recruit.
 *
 * One field. A friend's email is all we need, and every extra box is a reason to stop.
 */
export function InviteFriend({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const addr = email.trim();
    if (!addr.includes('@')) {
      setErr('That doesn’t look like an email address.');
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await inviteFriend(eventId, addr);
    setBusy(false);
    if (r.ok) {
      setSent((s) => [...s, addr]);
      setEmail('');
    } else {
      const code = (r.data as { error?: string } | undefined)?.error;
      setErr(
        code === 'thats-you'
          ? 'That’s your own address — try your friend’s.'
          : code === 'bad-email'
            ? 'That doesn’t look like an email address.'
            : 'We couldn’t send that just now — try again in a moment.',
      );
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.opener} onClick={() => setOpen(true)}>
        <Icon name="users" size={15} color="var(--gold-700)" /> Bring a friend
      </button>
    );
  }

  return (
    <div className={styles.box}>
      <p className={styles.lead}>
        Invite someone along — they come as our guest, free, food and drinks included.
      </p>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="their@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && send()}
          aria-label="Your friend’s email address"
        />
        <button type="button" className={styles.send} onClick={send} disabled={busy}>
          {busy ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {err ? <p className={styles.err}>{err}</p> : null}
      {sent.length ? (
        <p className={styles.sent}>
          Invited {sent.join(', ')}. We&rsquo;ll let you know when they say yes.
        </p>
      ) : null}
      <p className={styles.fine}>They don&rsquo;t need an account — one tap and they&rsquo;re on the list.</p>
    </div>
  );
}
