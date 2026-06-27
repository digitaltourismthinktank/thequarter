'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { getHosts, signInGuest, getRoll, signOutGuest, type GuestHost, type RollGuest } from '@/lib/booking';
import styles from './GuestClient.module.css';

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Lobby kiosk: a warm guest sign-in (host lookup) + a live fire-safety roll-call. */
export function GuestClient() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [hostQuery, setHostQuery] = useState('');
  const [matches, setMatches] = useState<GuestHost[]>([]);
  const [host, setHost] = useState<GuestHost | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [roll, setRoll] = useState<{ membersIn: number; headcount: number; guests: RollGuest[] }>({ membersIn: 0, headcount: 0, guests: [] });

  const loadRoll = useCallback(async () => {
    const r = await getRoll();
    if (r.ok) setRoll(r.data);
  }, []);
  useEffect(() => {
    loadRoll();
    const t = setInterval(loadRoll, 30000);
    return () => clearInterval(t);
  }, [loadRoll]);

  useEffect(() => {
    if (host) return;
    const q = hostQuery.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await getHosts(q);
      if (r.ok) setMatches(r.data.hosts);
    }, 300);
    return () => clearTimeout(t);
  }, [hostQuery, host]);

  async function signIn() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await signInGuest({ name: name.trim(), company: company.trim(), hostId: host?.id, host: host?.name, reason: reason.trim() });
    setBusy(false);
    if (r.ok) {
      setDone(host?.name || '');
      setName('');
      setCompany('');
      setReason('');
      setHostQuery('');
      setHost(null);
      setMatches([]);
      loadRoll();
    }
  }
  async function out(id: string) {
    await signOutGuest(id);
    loadRoll();
  }

  return (
    <div className={styles.screen}>
      <div className={styles.grid}>
        <div className={styles.signin}>
          {done !== null ? (
            <div className={styles.confirm}>
              <span className={styles.confirmChip}>
                <Icon name="check" size={30} color="var(--gold-700)" />
              </span>
              <h1 className={styles.h1}>You&rsquo;re signed in</h1>
              <p className={styles.confirmBody}>
                {done ? `We've let ${done} know you're here. ` : ''}Make yourself at home — the coffee&rsquo;s on us, and the cathedral view is on
                your left.
              </p>
              <button className={styles.primary} onClick={() => setDone(null)}>
                Sign in another guest
              </button>
            </div>
          ) : (
            <>
              <span className={styles.eyebrow}>Welcome to The Quarter</span>
              <h1 className={styles.h1}>Sign in</h1>
              <label className={styles.field}>
                <span>Your name</span>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </label>
              <label className={styles.field}>
                <span>Company (optional)</span>
                <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
              </label>
              <div className={styles.field}>
                <span>Who are you here to see?</span>
                {host ? (
                  <div className={styles.hostLocked}>
                    <span>
                      {host.name}
                      {host.company ? ` · ${host.company}` : ''}
                    </span>
                    <button
                      className={styles.change}
                      onClick={() => {
                        setHost(null);
                        setHostQuery('');
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className={styles.input}
                      placeholder="Type a name or company"
                      value={hostQuery}
                      onChange={(e) => setHostQuery(e.target.value)}
                      autoComplete="off"
                    />
                    {matches.length ? (
                      <div className={styles.matches}>
                        {matches.map((m) => (
                          <button
                            key={m.id}
                            className={styles.match}
                            onClick={() => {
                              setHost(m);
                              setMatches([]);
                            }}
                          >
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
                <input className={styles.input} value={reason} onChange={(e) => setReason(e.target.value)} autoComplete="off" />
              </label>
              <button className={styles.primary} onClick={signIn} disabled={busy || !name.trim()}>
                {busy ? 'One moment…' : 'Sign in'}
              </button>
            </>
          )}
        </div>

        <aside className={styles.roll}>
          <span className={styles.rollEyebrow}>Who&rsquo;s in today</span>
          <div className={styles.headcount}>{roll.headcount}</div>
          <div className={styles.pills}>
            <span className={styles.pill}>{roll.membersIn} members</span>
            <span className={styles.pill}>{roll.guests.length} guests</span>
          </div>
          <div className={styles.rollList}>
            {roll.guests.length === 0 ? (
              <span className={styles.rollEmpty}>No guests signed in yet.</span>
            ) : (
              roll.guests.map((g) => (
                <div key={g.id} className={styles.rollRow}>
                  <div className={styles.rollText}>
                    <strong>{g.name}</strong>
                    <span>
                      {g.company || 'Individual guest'}
                      {g.host ? ` · seeing ${g.host}` : ''} · {fmtTime(g.arrivedAt)}
                    </span>
                  </div>
                  <button className={styles.signout} onClick={() => out(g.id)}>
                    Sign out
                  </button>
                </div>
              ))
            )}
          </div>
          <span className={styles.rollNote}>Today&rsquo;s fire-safety roll-call — clears each evening.</span>
        </aside>
      </div>
    </div>
  );
}
