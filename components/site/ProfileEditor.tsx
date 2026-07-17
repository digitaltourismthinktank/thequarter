'use client';

import { useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { saveProfile } from '@/lib/booking';
import { memberName } from '@/lib/memberstack';
import styles from './ProfileEditor.module.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Member self-service profile editor (opened from the avatar in the top bar). Edits the
 * free-form Memberstack metaData fields — company, phone, birthday (month/day), what-you-do
 * and dietary needs — via member-profile.mjs. Birthday feeds the birthday treat; dietary +
 * role help with events and community intros.
 */
export function ProfileEditor({ member, onClose, onSaved }: { member: any; onClose: () => void; onSaved?: () => void }) {
  const meta = member?.metaData || {};
  const [company, setCompany] = useState<string>(meta.company || '');
  const [phone, setPhone] = useState<string>(meta.phone || '');
  const [role, setRole] = useState<string>(meta.role || '');
  const [dietary, setDietary] = useState<string>(meta.dietary || '');
  const bday: string = typeof meta.bday === 'string' && /^\d{2}-\d{2}$/.test(meta.bday) ? meta.bday : '';
  const [month, setMonth] = useState<string>(bday ? String(Number(bday.slice(0, 2))) : '');
  const [day, setDay] = useState<string>(bday ? String(Number(bday.slice(3, 5))) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const bdayVal = month && day ? `${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}` : month || day ? undefined : null;
    const r = await saveProfile({
      company,
      phone,
      role,
      dietary,
      ...(bdayVal !== undefined ? { bday: bdayVal } : {}),
    });
    setBusy(false);
    if (r.ok) {
      setMsg('Saved');
      onSaved?.();
      setTimeout(onClose, 700);
    } else {
      setMsg('Could not save — try again.');
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Your details" onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <Icon name="x" size={20} />
        </button>
        <span className={styles.eyebrow}>Your details</span>
        <h2 className={styles.h2}>{memberName(member) || 'Your profile'}</h2>
        <p className={styles.note}>Keep these current — your birthday earns you a little treat, and dietary needs help us cater events.</p>

        <label className={styles.field}>
          <span className={styles.label}>Company</span>
          <input className={styles.input} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Where you work (optional)" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Telephone</span>
          <input className={styles.input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile or work number" />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Birthday (day &amp; month)</span>
          <div className={styles.bdayRow}>
            <select className={styles.input} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select className={styles.input} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>What you do</span>
          <input className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Freelance designer (helps intros)" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Dietary needs</span>
          <input className={styles.input} value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="Allergies / preferences for events" />
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.save} onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </button>
          {msg ? <span className={styles.msg}>{msg}</span> : null}
        </div>
      </div>
    </div>
  );
}
