'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ds/Icon';
import { useMember } from './useMember';
import { memberName, getMemberstack } from '@/lib/memberstack';
import { MemberShell } from './MemberShell';
import { CharacterPicker } from './CharacterPicker';
import { ProfileEditor } from './ProfileEditor';
import { NotificationToggle } from './NotificationToggle';
import { QuarterCharacter } from './QuarterCharacter';
import { characterById } from '@/lib/characters';
import { soundMuted, setSoundMuted, playChime, unlockSound } from '@/lib/feedback';
import { saveProfile } from '@/lib/booking';
import styles from './AccountClient.module.css';

/* Mirrors GeoCheckIn — the offer to use your location is dismissed permanently, and until
   now there was nowhere to change your mind. */
const DISMISS_KEY = 'q-geo-offer-dismissed';
const GRANTED_KEY = 'q-geo-granted';

/**
 * /account — everything about you in one place: your character, your details, and the
 * settings that previously had nowhere to live. The location prompt in particular was a
 * one-way door (dismiss it once and it never returned), and cookie preferences needed a
 * home after the floating badge was hidden inside the member app.
 */
export function AccountClient() {
  const { loading, member, refresh } = useMember();
  const [editing, setEditing] = useState(false);
  const [geoDismissed, setGeoDismissed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [savingPref, setSavingPref] = useState<'emailOptOut' | 'pushOptOut' | null>(null);

  useEffect(() => {
    try {
      setGeoDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      /* private mode — leave it as-is */
    }
    setMuted(soundMuted());
  }, []);

  function toggleSound() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
    // Turning them on should demonstrate what you've turned on. The tap itself is the
    // gesture the browser needs before it will let audio play at all.
    if (!next) {
      unlockSound();
      playChime('success');
    }
  }

  function restoreGeoOffer() {
    try {
      window.localStorage.removeItem(DISMISS_KEY);
      window.localStorage.removeItem(GRANTED_KEY);
    } catch {
      /* ignore */
    }
    setGeoDismissed(false);
  }

  /* Both toggles are opt-OUTs stored on metaData — flip the current value and save. The member
     object refreshes afterwards, so the button label reflects what actually persisted. */
  async function togglePref(key: 'emailOptOut' | 'pushOptOut') {
    if (savingPref) return;
    const current = (member?.metaData as Record<string, unknown> | undefined)?.[key] === true;
    setSavingPref(key);
    try {
      await saveProfile({ [key]: !current });
      await refresh();
    } finally {
      setSavingPref(null);
    }
  }

  async function logout() {
    const ms = await getMemberstack();
    await ms?.logout();
    window.location.assign('/');
  }

  if (loading) {
    return (
      <MemberShell>
        <p className={styles.meta}>Loading…</p>
      </MemberShell>
    );
  }

  const characterId = typeof member?.metaData?.character === 'string' ? member.metaData.character : null;
  const character = characterById(characterId);
  const meta = (member?.metaData || {}) as Record<string, unknown>;
  const detail = (k: string) => (typeof meta[k] === 'string' && meta[k] ? (meta[k] as string) : null);
  const emailOptOut = meta.emailOptOut === true;
  const pushOptOut = meta.pushOptOut === true;

  return (
    <MemberShell>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Your account</span>
        <h1 className={styles.h1}>{memberName(member) || 'Member'}</h1>
        <p className={styles.sub}>{member?.auth?.email}</p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.h2}>Your Quarter Character</h2>
        <p className={styles.note}>
          {character
            ? `You're ${character.name} — ${character.blurb.toLowerCase()}.`
            : 'One of the Canterbury pilgrims, to stand in for you around the app.'}
        </p>
        {character ? (
          <div className={styles.currently}>
            <QuarterCharacter id={character.id} size={64} />
            <span className={styles.currentName}>{character.name}</span>
          </div>
        ) : null}
        <CharacterPicker current={characterId} onSaved={refresh} />
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Your details</h2>
        <dl className={styles.details}>
          <div>
            <dt>Company</dt>
            <dd>{detail('company') || '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{detail('phone') || '—'}</dd>
          </div>
          <div>
            <dt>What you do</dt>
            <dd>{detail('role') || '—'}</dd>
          </div>
          <div>
            <dt>Birthday</dt>
            <dd>{detail('bday') ? 'Saved' : '—'}</dd>
          </div>
          <div>
            <dt>Dietary needs</dt>
            <dd>{detail('dietary') || '—'}</dd>
          </div>
          <div>
            <dt>Postal forwarding address</dt>
            <dd style={{ whiteSpace: 'pre-line' }}>{detail('forwardAddress') || '—'}</dd>
          </div>
        </dl>
        <button type="button" className={styles.btn} onClick={() => setEditing(true)}>
          Edit your details
        </button>
        <p className={styles.note}>
          Your email address is the one your membership is billed against — ask the team if it needs changing.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Notifications</h2>
        <p className={styles.note}>
          The essentials — receipts, booking confirmations, plan changes — always reach you. These are the friendly extras, and they’re yours to turn on or off by channel.
        </p>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>Email updates</strong>
            <span>{emailOptOut ? 'Off — you’ll still get essential emails.' : 'News, events and the occasional note from the team.'}</span>
          </div>
          <button type="button" className={styles.btnSm} onClick={() => togglePref('emailOptOut')} disabled={savingPref === 'emailOptOut'}>
            {savingPref === 'emailOptOut' ? '…' : emailOptOut ? 'Turn on' : 'Turn off'}
          </button>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>In-app notifications</strong>
            <span>Booking confirmations and reminders on this device — turn them on here.</span>
          </div>
          <NotificationToggle />
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>Space-wide announcements</strong>
            <span>{pushOptOut ? 'Off — you’ll still get your own booking alerts.' : 'Notes to everyone in that day — events, celebrations, the odd surprise.'}</span>
          </div>
          <button type="button" className={styles.btnSm} onClick={() => togglePref('pushOptOut')} disabled={savingPref === 'pushOptOut'}>
            {savingPref === 'pushOptOut' ? '…' : pushOptOut ? 'Turn on' : 'Turn off'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Settings</h2>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>Check in by location</strong>
            <span>{geoDismissed ? 'Turned off — we won’t offer it again until you turn it back on.' : 'We’ll offer a one-tap check-in when you’re at The Quarter.'}</span>
          </div>
          {geoDismissed ? (
            <button type="button" className={styles.btnSm} onClick={restoreGeoOffer}>
              Turn on
            </button>
          ) : (
            <span className={styles.on}>On</span>
          )}
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>Sounds</strong>
            <span>A quiet chime when something lands — checking in, a booking confirmed.</span>
          </div>
          <button type="button" className={styles.btnSm} onClick={toggleSound}>
            {muted ? 'Turn on' : 'Turn off'}
          </button>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>Cookie settings</strong>
            <span>Change what you’ve agreed to at any time.</span>
          </div>
          <button type="button" className={styles.btnSm} onClick={() => window.CookieScript?.instance?.show?.()}>
            Open
          </button>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>Your plan &amp; billing</strong>
            <span>Days, invoices, payment card and pausing.</span>
          </div>
          <Link href="/plan" className={styles.btnSm}>
            Open
          </Link>
        </div>
      </section>

      <button type="button" className={styles.logout} onClick={logout}>
        <Icon name="log-out" size={16} />
        Log out
      </button>

      {editing ? <ProfileEditor member={member} onClose={() => setEditing(false)} onSaved={refresh} /> : null}
    </MemberShell>
  );
}
