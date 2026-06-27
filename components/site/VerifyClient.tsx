'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { verifyToken, type VerifyResult } from '@/lib/booking';
import styles from './VerifyClient.module.css';

/** Deterministic short code from the token + a ~20s time window (high-trust display). */
function rotatingCode(token: string, win: number): string {
  let h = 0;
  const s = `${token}:${win}`;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

export function VerifyClient() {
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const path = window.location.pathname.replace(/^\/v\//, '').replace(/\/$/, '');
    setToken(path || null);
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const r = await verifyToken(token);
      if (active) {
        setResult(r.ok ? r.data : ({ ok: false, state: 'unknown', kind: 'perk' } as VerifyResult));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const clock = useMemo(
    () => new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [now],
  );

  if (loading) {
    return (
      <div className={styles.screen}>
        <p className={styles.dim}>Checking…</p>
      </div>
    );
  }

  if (!token || !result || result.state === 'unknown') {
    return (
      <div className={styles.screen}>
        <div className={`${styles.card} ${styles.muted}`}>
          <span className={styles.glyph}>
            <Icon name="search" size={28} color="var(--stone-500)" />
          </span>
          <h1 className={styles.h1}>Point your camera at a member&rsquo;s Quarter code</h1>
          <p className={styles.body}>This page confirms a Quarter member and shows how to honour their perk.</p>
        </div>
      </div>
    );
  }

  const m = result.member;
  const offer = result.reward?.title || result.perk?.offer || (result.wallet ? 'All current Quarter perks' : 'Quarter perk');
  const partner = result.partner || result.perk?.partner || result.reward?.partner || 'The Quarter';
  const pos = result.reward?.pos || result.perk?.pos || '';
  const icon = (result.reward?.icon || result.perk?.icon || 'badge-check') as IconName;
  const contact = result.perk?.contact || '';
  const auth = result.perk?.authorisedBy || '';

  // Expired — no member details; ask them to reopen + rescan.
  if (result.state === 'expired') {
    return (
      <div className={styles.screen}>
        <div className={`${styles.card} ${styles.muted}`}>
          <span className={styles.glyph}>
            <Icon name="clock" size={28} color="var(--stone-500)" />
          </span>
          <h1 className={styles.h1}>This pass has expired</h1>
          <div className={styles.notePanel}>Ask the member to reopen their Quarter pass and scan again — it refreshes instantly.</div>
        </div>
      </div>
    );
  }

  // Lapsed member — perks paused.
  if (result.state === 'lapsed') {
    return (
      <div className={styles.screen}>
        <div className={`${styles.card} ${styles.muted}`}>
          <span className={styles.glyph}>
            <Icon name="x" size={28} color="var(--stone-500)" />
          </span>
          <h1 className={styles.h1}>Membership not active</h1>
          <p className={styles.body}>{m?.name ? `${m.name}'s ` : 'This '}membership isn&rsquo;t active right now, so perks are paused.</p>
        </div>
      </div>
    );
  }

  const headerTone = result.state === 'inactive' ? styles.headSoft : styles.headGold;

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={`${styles.header} ${headerTone}`}>
          <span className={styles.tick}>
            <Icon name={result.state === 'inactive' ? icon : 'badge-check'} size={24} color="var(--gold-300)" />
          </span>
          <strong>{result.state === 'inactive' ? 'A Quarter member' : 'Verified Quarter member'}</strong>
          <span>{result.state === 'inactive' ? 'All good — just not this perk today.' : 'They are who they say they are.'}</span>
        </div>

        {m ? (
          <div className={styles.identity}>
            <span className={styles.avatar}>
              {m.name
                .split(' ')
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'Q'}
            </span>
            <div className={styles.idText}>
              <strong>{m.name}</strong>
              <span>
                {[m.planName, m.since ? `member since ${m.since}` : null].filter(Boolean).join(' · ') || 'Quarter member'}
              </span>
            </div>
            <span className={styles.activePill}>Active</span>
          </div>
        ) : null}

        <div className={styles.offer}>
          <span className={styles.offerChip}>
            <Icon name={icon} size={22} color="var(--gold-700)" />
          </span>
          <div>
            <span className={styles.partner}>{partner}</span>
            <h2 className={styles.offerTitle}>{offer}</h2>
          </div>
        </div>

        {result.state === 'inactive' ? (
          <div className={styles.notePanel}>
            Not running today{result.perk?.days ? ` — this one is ${result.perk.days}` : ''}. A friendly &ldquo;not today&rdquo; is
            absolutely fine.
          </div>
        ) : null}

        {result.state === 'rotating' ? (
          <div className={styles.rotate}>
            <span className={styles.rotateLabel}>Live code</span>
            <strong className={styles.rotateCode}>{rotatingCode(token, Math.floor(now / 20000))}</strong>
            <span className={styles.live} aria-hidden="true">
              <span className={styles.sweep} />
              <span className={styles.dot} />
            </span>
          </div>
        ) : null}

        {pos && result.state !== 'inactive' ? (
          <div className={styles.apply}>
            <span className={styles.applyLabel}>How to apply it</span>
            <p>{pos}</p>
          </div>
        ) : null}

        <div className={styles.foot}>
          <span className={styles.verified}>
            <span className={styles.live} aria-hidden="true">
              <span className={styles.sweep} />
              <span className={styles.dot} />
            </span>
            Verified just now · {clock}
          </span>
          <span className={styles.authLine}>
            {auth ? `Authorised by ${auth}. ` : ''}The Quarter is operated by SE1 Media Ltd (t/a Digital Tourism Think Tank).
            {contact ? ` Partner: ${contact}.` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
