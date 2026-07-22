'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { Qr } from '@/components/ds/Qr';
import { SITE } from '@/lib/site';
import {
  kioskMemberSearch, kioskCheckIn, getHosts, signInGuest,
  type MemberMatch, type GuestHost,
} from '@/lib/booking';
import styles from './ReceptionClient.module.css';

/** Walk-in day pass: the QR sends the guest to the normal Day Pass checkout on THEIR OWN phone
 *  (card / Apple Pay — never a card typed on the shared iPad). `walkin=1` pre-fills today, since
 *  they're standing here now. Paying writes a Paid check-in for today = they're in as a guest. */
const DAYPASS_URL = `${SITE.url.replace(/\/$/, '')}/day-pass?walkin=1`;

/**
 * The reception kiosk — one shared iPad by the door that checks ANYONE in without a login:
 * a member (found by name, then checked in on the spot) or a guest here for a meeting. It
 * merges what used to be two separate surfaces (/arrive needed the member's own phone + login;
 * /guest was guests only) so a member who'd rather not dig their phone out can just tap their
 * name. Between visitors it drifts back to the start on its own.
 *
 * No-login member check-in uses the same low-security lobby model as the room kiosks (a name
 * picked from a privacy-safe search); the server records these as Source 'Kiosk'.
 */

type Mode = 'landing' | 'member' | 'guest' | 'daypass';
const RESET_MS = 8000;

function firstName(n: string) {
  return (n || '').trim().split(/\s+/)[0] || '';
}

function memberCheckinError(code?: string): string {
  switch (code) {
    case 'needs-plan-or-pass':
      return 'We can’t see an active plan or day pass — please see the team and they’ll sort your visit.';
    case 'no-allowance':
      return 'That’s your days used up for this month — see the team about a day pass.';
    case 'weekend-request':
    case 'weekend-pending':
      return 'Weekend visits are arranged in advance — please see the team.';
    case 'closed-day':
      return 'The Quarter is closed today.';
    case 'unknown-member':
      return 'We couldn’t find your membership — please see the team.';
    default:
      return 'We couldn’t check you in just now — please see the team.';
  }
}

export function ReceptionClient() {
  const [mode, setMode] = useState<Mode>('landing');

  // Auto-return to the landing after a confirmation, so the next person starts fresh.
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => reset(), RESET_MS);
  };
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  // The day-pass QR has no on-screen confirmation (the guest pays on their phone), so give it its
  // own gentle idle timeout — an abandoned QR drifts back to the landing for the next person.
  useEffect(() => {
    if (mode !== 'daypass') return;
    const t = setTimeout(() => reset(), 45000);
    return () => clearTimeout(t);
  }, [mode]);

  // ---- Member path ----
  const [mq, setMq] = useState('');
  const [matches, setMatches] = useState<MemberMatch[]>([]);
  const [picked, setPicked] = useState<MemberMatch | null>(null);
  const [half, setHalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [memberDone, setMemberDone] = useState<{ name: string; already: boolean } | null>(null);
  const [memberErr, setMemberErr] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'member' || picked) return;
    const q = mq.trim();
    if (q.length < 3) { setMatches([]); return; }
    const t = setTimeout(async () => {
      const r = await kioskMemberSearch(q);
      if (r.ok) setMatches(r.data.members);
    }, 300);
    return () => clearTimeout(t);
  }, [mq, picked, mode]);

  async function doMemberCheckIn() {
    if (!picked) return;
    setBusy(true);
    setMemberErr(null);
    const r = await kioskCheckIn(picked.id, half ? 'Half' : 'Full');
    setBusy(false);
    if (r.ok && r.data?.ok !== false) {
      setMemberDone({ name: picked.name, already: !!(r.data?.alreadyCheckedIn || r.data?.alreadyCounted) });
      scheduleReset();
    } else {
      setMemberErr(memberCheckinError(r.data?.error));
    }
  }

  // ---- Guest path ----
  const [gName, setGName] = useState('');
  const [gCompany, setGCompany] = useState('');
  const [gReason, setGReason] = useState('');
  const [hostQuery, setHostQuery] = useState('');
  const [hostMatches, setHostMatches] = useState<GuestHost[]>([]);
  const [host, setHost] = useState<GuestHost | null>(null);
  const [guestDone, setGuestDone] = useState<{ host: string } | null>(null);

  useEffect(() => {
    if (mode !== 'guest' || host) return;
    const q = hostQuery.trim();
    if (q.length < 2) { setHostMatches([]); return; }
    const t = setTimeout(async () => {
      const r = await getHosts(q);
      if (r.ok) setHostMatches(r.data.hosts);
    }, 300);
    return () => clearTimeout(t);
  }, [hostQuery, host, mode]);

  async function doGuestSignIn() {
    if (!gName.trim()) return;
    setBusy(true);
    const r = await signInGuest({ name: gName.trim(), company: gCompany.trim(), hostId: host?.id, host: host?.name, reason: gReason.trim() });
    setBusy(false);
    if (r.ok) {
      setGuestDone({ host: host?.name || '' });
      scheduleReset();
    }
  }

  function reset() {
    if (resetTimer.current) { clearTimeout(resetTimer.current); resetTimer.current = null; }
    setMode('landing');
    setMq(''); setMatches([]); setPicked(null); setHalf(false); setMemberDone(null); setMemberErr(null);
    setGName(''); setGCompany(''); setGReason(''); setHostQuery(''); setHostMatches([]); setHost(null); setGuestDone(null);
    setBusy(false);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <img className={styles.logo} src="/brand/logo-wordmark-black.png" alt="The Quarter" />

        {/* ---------------------------------------------------------------- landing -- */}
        {mode === 'landing' ? (
          <>
            <span className={styles.eyebrow}>Welcome to The Quarter</span>
            <h1 className={styles.h1}>Checking in?</h1>
            <p className={styles.lead}>Tap whichever is you — no phone or password needed.</p>
            <div className={styles.choices}>
              <button type="button" className={`${styles.choice} ${styles.choiceMember}`} onClick={() => setMode('member')}>
                <span className={styles.choiceIcon}>
                  <Icon name="user" size={44} color="var(--gold-700)" />
                </span>
                <strong className={styles.choiceTitle}>I’m a member</strong>
                <span className={styles.choiceSub}>Check in for the day</span>
              </button>
              <button type="button" className={styles.choice} onClick={() => setMode('guest')}>
                <span className={styles.choiceIcon}>
                  <Icon name="users" size={44} color="var(--gold-700)" />
                </span>
                <strong className={styles.choiceTitle}>I’m a guest</strong>
                <span className={styles.choiceSub}>Here for a meeting or visit</span>
              </button>
              <button type="button" className={`${styles.choice} ${styles.choiceDaypass}`} onClick={() => setMode('daypass')}>
                <span className={styles.choiceIcon}>
                  <Icon name="ticket" size={44} color="var(--gold-700)" />
                </span>
                <strong className={styles.choiceTitle}>Buy a day pass</strong>
                <span className={styles.choiceSub}>Just turned up? Pay for today</span>
              </button>
            </div>
          </>
        ) : null}

        {/* ----------------------------------------------------------------- member -- */}
        {mode === 'member' && !memberDone ? (
          <>
            <button type="button" className={styles.back} onClick={reset}>
              <Icon name="arrow-left" size={16} /> Back
            </button>
            {!picked ? (
              <>
                <h1 className={styles.h1}>Find your name</h1>
                <p className={styles.lead}>Start typing and pick yourself from the list.</p>
                <input
                  className={styles.input}
                  placeholder="Your name"
                  value={mq}
                  onChange={(e) => setMq(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
                {matches.length ? (
                  <div className={styles.matches}>
                    {matches.map((m) => (
                      <button key={m.id} type="button" className={styles.match} onClick={() => { setPicked(m); setMatches([]); }}>
                        <span className={styles.matchAvatar}>{(m.name || '?')[0].toUpperCase()}</span>
                        <span className={styles.matchName}>{m.name}</span>
                      </button>
                    ))}
                  </div>
                ) : mq.trim().length >= 3 ? (
                  <p className={styles.muted}>No match yet — keep typing, or see the team.</p>
                ) : null}
              </>
            ) : (
              <>
                <h1 className={styles.h1}>Hello, {firstName(picked.name)}</h1>
                <p className={styles.lead}>How long are you in for?</p>
                <div className={styles.seg} role="tablist" aria-label="Day length">
                  <button type="button" role="tab" aria-selected={!half} className={`${styles.segBtn} ${!half ? styles.segOn : ''}`} onClick={() => setHalf(false)}>
                    Full day
                  </button>
                  <button type="button" role="tab" aria-selected={half} className={`${styles.segBtn} ${half ? styles.segOn : ''}`} onClick={() => setHalf(true)}>
                    Half day
                  </button>
                </div>
                <button type="button" className={styles.primary} onClick={doMemberCheckIn} disabled={busy}>
                  {busy ? 'Checking you in…' : 'Check in'}
                </button>
                <button type="button" className={styles.linkBtn} onClick={() => { setPicked(null); setMemberErr(null); }}>
                  Not you? Search again
                </button>
                {memberErr ? <p className={styles.error}>{memberErr}</p> : null}
              </>
            )}
          </>
        ) : null}

        {/* --------------------------------------------------------- member · done -- */}
        {mode === 'member' && memberDone ? (
          <div className={styles.confirm}>
            <span className={styles.tick}><Icon name="check" size={40} color="var(--gold-700)" /></span>
            <h1 className={styles.h1}>{memberDone.already ? 'Already in' : `You’re in, ${firstName(memberDone.name)}`}</h1>
            <p className={styles.lead}>{memberDone.already ? 'You checked in earlier — enjoy the day.' : 'Have a lovely day at The Quarter.'}</p>
            <button type="button" className={styles.linkBtn} onClick={reset}>Done</button>
          </div>
        ) : null}

        {/* ------------------------------------------------------------------ guest -- */}
        {mode === 'guest' && !guestDone ? (
          <>
            <button type="button" className={styles.back} onClick={reset}>
              <Icon name="arrow-left" size={16} /> Back
            </button>
            <h1 className={styles.h1}>Sign in</h1>
            <label className={styles.field}>
              <span>Your name</span>
              <input className={styles.input} value={gName} onChange={(e) => setGName(e.target.value)} autoComplete="off" autoFocus />
            </label>
            <label className={styles.field}>
              <span>Company (optional)</span>
              <input className={styles.input} value={gCompany} onChange={(e) => setGCompany(e.target.value)} autoComplete="off" />
            </label>
            <div className={styles.field}>
              <span>Who are you here to see?</span>
              {host ? (
                <div className={styles.hostLocked}>
                  <span>{host.name}{host.company ? ` · ${host.company}` : ''}</span>
                  <button type="button" className={styles.change} onClick={() => { setHost(null); setHostQuery(''); }}>Change</button>
                </div>
              ) : (
                <>
                  <input className={styles.input} placeholder="Type a name or company" value={hostQuery} onChange={(e) => setHostQuery(e.target.value)} autoComplete="off" />
                  {hostMatches.length ? (
                    <div className={styles.matches}>
                      {hostMatches.map((m) => (
                        <button key={m.id} type="button" className={styles.match} onClick={() => { setHost(m); setHostMatches([]); }}>
                          <span className={styles.matchAvatar}>{(m.name || '?')[0].toUpperCase()}</span>
                          <span className={styles.matchName}>{m.name}</span>
                          {m.company ? <span className={styles.matchCo}>{m.company}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <label className={styles.field}>
              <span>Anything we should know? (optional)</span>
              <input className={styles.input} value={gReason} onChange={(e) => setGReason(e.target.value)} autoComplete="off" />
            </label>
            <button type="button" className={styles.primary} onClick={doGuestSignIn} disabled={busy || !gName.trim()}>
              {busy ? 'One moment…' : 'Sign in'}
            </button>
          </>
        ) : null}

        {/* ---------------------------------------------------------- guest · done -- */}
        {mode === 'guest' && guestDone ? (
          <div className={styles.confirm}>
            <span className={styles.tick}><Icon name="check" size={40} color="var(--gold-700)" /></span>
            <h1 className={styles.h1}>You’re signed in</h1>
            <p className={styles.lead}>
              {guestDone.host ? `We’ve let ${guestDone.host} know you’re here. ` : ''}Make yourself at home — the coffee’s on us.
            </p>
            <button type="button" className={styles.linkBtn} onClick={reset}>Done</button>
          </div>
        ) : null}

        {/* -------------------------------------------------------------- day pass -- */}
        {mode === 'daypass' ? (
          <>
            <button type="button" className={styles.back} onClick={reset}>
              <Icon name="arrow-left" size={16} /> Back
            </button>
            <h1 className={styles.h1}>Buy a day pass</h1>
            <p className={styles.lead}>Point your phone camera at the code — you pay on your phone and you’re in for the day.</p>
            <div className={styles.qrWrap}>
              <Qr value={DAYPASS_URL} size={228} />
            </div>
            <span className={styles.qrUrl}>thequarter.work/day-pass</span>
            <p className={styles.daypassMeta}>
              <strong>£21.60</strong> for the full day — breakfast, bean-to-cup coffee, fast wifi and the phone pods. Pay by
              card or Apple&nbsp;Pay on your own phone. Want a private room or a pod for a call? You can add one after you pay.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
