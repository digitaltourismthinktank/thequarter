'use client';

import { useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { saveProfile, type BirthdayState } from '@/lib/booking';
import styles from './BirthdayCard.module.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type BState = 'none' | 'due' | 'available' | 'redeemed' | 'expired';

function compute(bday: string | null, claimed: string | null): { state: BState; bdayDate?: Date; weekEnd?: Date } {
  if (!bday || !/^\d{2}-\d{2}$/.test(bday)) return { state: 'none' };
  const now = new Date();
  const year = now.getFullYear();
  const [mm, dd] = bday.split('-').map(Number);
  const bdayDate = new Date(year, mm - 1, dd);
  const weekEnd = new Date(year, mm - 1, dd + 6);
  const today = new Date(year, now.getMonth(), now.getDate());
  const claimedThisYear = claimed ? new Date(claimed).getFullYear() === year : false;
  if (claimedThisYear) return { state: 'redeemed', bdayDate, weekEnd };
  if (today < bdayDate) return { state: 'due', bdayDate, weekEnd };
  if (today <= weekEnd) return { state: 'available', bdayDate, weekEnd };
  return { state: 'expired', bdayDate, weekEnd };
}

const fmt = (d?: Date) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '');

export function BirthdayCard({ birthday, onSaved }: { birthday: BirthdayState; claimedAt?: string; onSaved: () => void }) {
  const { state, bdayDate, weekEnd } = compute(birthday.bday, birthday.claimed);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!day || !month) return;
    setBusy(true);
    const mm = String(MONTHS.indexOf(month) + 1).padStart(2, '0');
    const dd = String(Number(day)).padStart(2, '0');
    const r = await saveProfile({ bday: `${mm}-${dd}` });
    setBusy(false);
    if (r.ok) onSaved();
  }

  if (state === 'none') {
    return (
      <section className={`${styles.card} ${styles.soft}`}>
        <span className={styles.chipSoft}>
          <Icon name="cake" size={22} color="var(--gold-700)" />
        </span>
        <div className={styles.body}>
          <strong className={styles.title}>Tell us your birthday</strong>
          <span className={styles.sub}>So we can spoil you a little each year — a treat from The Kentish Pantry. (Day and month only.)</span>
          <div className={styles.form}>
            <select className={styles.select} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select className={styles.select} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              <option value="">Month</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button className={styles.save} onClick={save} disabled={busy || !day || !month}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (state === 'available') {
    return (
      <section className={`${styles.card} ${styles.gold}`}>
        <span className={styles.chipGold}>
          <Icon name="cake" size={22} color="var(--ink-900)" />
        </span>
        <div className={styles.body}>
          <strong className={styles.title}>Happy birthday week!</strong>
          <span className={styles.subDark}>
            A treat from The Kentish Pantry is yours — just mention it at the counter. No code, no scanning. Yours all week, until{' '}
            {fmt(weekEnd)}.
          </span>
        </div>
      </section>
    );
  }

  if (state === 'due') {
    return (
      <section className={`${styles.card} ${styles.soft}`}>
        <span className={styles.chipSoft}>
          <Icon name="gift" size={22} color="var(--gold-700)" />
        </span>
        <div className={styles.body}>
          <strong className={styles.title}>A birthday treat is on its way</strong>
          <span className={styles.sub}>Unlocks the week of {fmt(bdayDate)} — a little something from The Kentish Pantry.</span>
        </div>
      </section>
    );
  }

  if (state === 'redeemed') {
    return (
      <section className={`${styles.card} ${styles.muted}`}>
        <span className={styles.chipMuted}>
          <Icon name="check" size={22} color="var(--stone-500)" />
        </span>
        <div className={styles.body}>
          <strong className={styles.title}>Birthday treat — enjoyed</strong>
          <span className={styles.sub}>
            Claimed {birthday.claimed ? new Date(birthday.claimed).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : 'this year'}. See you next year.
          </span>
        </div>
      </section>
    );
  }

  // expired
  return (
    <section className={`${styles.card} ${styles.muted}`}>
      <span className={styles.chipMuted}>
        <Icon name="cake" size={22} color="var(--stone-500)" />
      </span>
      <div className={styles.body}>
        <strong className={styles.title}>This year&rsquo;s treat has passed</strong>
        <span className={styles.sub}>We&rsquo;ll have another one waiting for you next year.</span>
      </div>
    </section>
  );
}
