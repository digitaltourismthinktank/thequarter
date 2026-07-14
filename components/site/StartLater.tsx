'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { PLANS } from '@/lib/plans';
import { joinWithStartDate } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import styles from './StartLater.module.css';

/** Join now but start on a future date — the first invoice lands on that date. */
export function StartLater() {
  const joinable = useMemo(() => PLANS.filter((p) => p.id !== 'day-pass'), []);
  const [plan, setPlan] = useState('citizen');
  const [term, setTerm] = useState<'monthly' | 'annual'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const annualOnly = plan === 'hybrid-office';
  const effectiveTerm = annualOnly ? 'annual' : term;

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  async function go() {
    setError(null);
    if (!startDate) return setError('Please choose a start date.');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Please enter a valid email, or leave it blank.');
    if (PREVIEW) return setError('Checkout opens on the live site — this is a preview.');
    setBusy(true);
    const r = await joinWithStartDate({ plan, term: effectiveTerm, startDate, email: email.trim() || undefined });
    setBusy(false);
    if (r.ok && r.data.url) {
      window.location.href = r.data.url;
      return;
    }
    setError('We couldn’t start that just now — please try again, or choose a plan above.');
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Plan</span>
          <select className={styles.input} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {joinable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {!annualOnly ? (
          <label className={styles.field}>
            <span className={styles.label}>Billing</span>
            <select className={styles.input} value={term} onChange={(e) => setTerm(e.target.value as 'monthly' | 'annual')}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </label>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>Start date</span>
          <input type="date" className={styles.input} value={startDate} min={todayStr} onChange={(e) => setStartDate(e.target.value)} />
        </label>
      </div>
      <div className={styles.row}>
        <label className={`${styles.field} ${styles.grow}`}>
          <span className={styles.label}>Email (optional)</span>
          <input type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </label>
        <Button variant="accent" onClick={go} disabled={busy} iconAfter="arrow-right">
          {busy ? 'Starting…' : 'Continue'}
        </Button>
      </div>
      {error ? <p className={styles.err}>{error}</p> : null}
    </div>
  );
}
