'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { getPartnerBalance, type PartnerBalance } from '@/lib/booking';
import styles from './PartnerClient.module.css';

const gbp = (n: number) => `£${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;

function whenLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_TONE: Record<string, string> = {
  Healthy: styles.toneHealthy,
  'Running low': styles.toneLow,
  Spent: styles.toneSpent,
};

export function PartnerClient() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<PartnerBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const path = window.location.pathname.replace(/^\/partner\//, '').replace(/\/$/, '');
    setToken(path || '');
  }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      setLoading(false);
      setError(true);
      return;
    }
    let active = true;
    (async () => {
      const r = await getPartnerBalance(token);
      if (!active) return;
      if (r.ok && r.data && !r.data.error) setData(r.data);
      else setError(true);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const pct = useMemo(() => {
    if (!data || !(data.floatTotal > 0)) return null;
    return Math.max(0, Math.min(100, Math.round((data.balance / data.floatTotal) * 100)));
  }, [data]);

  if (loading) {
    return (
      <div className={styles.screen}>
        <p className={styles.dim}>Loading your balance…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <div className={styles.muted}>
            <span className={styles.glyph}>
              <Icon name="search" size={26} />
            </span>
            <h1 className={styles.h1}>We couldn&apos;t find that balance</h1>
            <p className={styles.body}>
              This link may be out of date. If you&apos;re a Quarter partner and need your balance link, drop us a note at{' '}
              <a href="mailto:info@thequarter.work">info@thequarter.work</a> and we&apos;ll sort it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tone = STATUS_TONE[data.status] || styles.toneHealthy;
  const hasFloat = data.floatTotal > 0;

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <span className={styles.brand}>The Quarter · Partner</span>
          <h1 className={styles.partner}>{data.partner}</h1>
          <span className={`${styles.statusPill} ${tone}`}>{data.status}</span>
        </header>

        {hasFloat ? (
          <section className={styles.balanceBlock}>
            <div className={styles.balanceRow}>
              <div>
                <span className={styles.balanceLabel}>Float remaining</span>
                <span className={styles.balanceValue}>{gbp(data.balance)}</span>
              </div>
              <span className={styles.balanceTotal}>of {gbp(data.floatTotal)}</span>
            </div>
            <div className={styles.bar} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${pct ?? 0}%` }} />
            </div>
            <div className={styles.metaRow}>
              <span>
                <Icon name="rotate-cw" size={13} /> {data.usesThisMonth} this month
              </span>
              {data.lastUsed ? (
                <span>
                  <Icon name="clock" size={13} /> Last used {whenLabel(data.lastUsed)}
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <section className={styles.balanceBlock}>
            <span className={styles.balanceLabel}>Redemptions to date</span>
            <span className={styles.balanceValue}>{data.usesThisMonth} this month</span>
            <p className={styles.body}>
              Your rewards are settled by The Quarter each month — there&apos;s no float to draw down here.
            </p>
          </section>
        )}

        <section className={styles.recent}>
          <h2 className={styles.recentTitle}>Recent redemptions</h2>
          {data.redemptions.length ? (
            <ul className={styles.list}>
              {data.redemptions.map((r, i) => (
                <li key={`${r.reward}-${r.at}-${i}`} className={styles.item}>
                  <span className={styles.itemIcon} aria-hidden="true">
                    <Icon name="gift" size={16} />
                  </span>
                  <span className={styles.itemText}>
                    <strong>{r.reward || 'Reward'}</strong>
                    <span className={styles.itemWhen}>{whenLabel(r.at) || '—'}</span>
                  </span>
                  <span className={styles.itemValue}>{gbp(r.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.body}>No redemptions yet — they&apos;ll appear here as members enjoy your reward.</p>
          )}
        </section>

        <div className={styles.note}>
          <Icon name="badge-check" size={16} />
          <p>
            The Quarter settles partner payouts monthly — you don&apos;t need to invoice; we reconcile and pay per our
            agreement. Bookmark this page to check your balance any time.
          </p>
        </div>

        <footer className={styles.foot}>
          Questions? <a href="mailto:info@thequarter.work">info@thequarter.work</a> · 01227 202 227
        </footer>
      </div>
    </div>
  );
}
