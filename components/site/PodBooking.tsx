'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { getSpaces, roomMemberFree } from '@/lib/booking';
import { useMember } from './useMember';
import { DatePickerModal } from './DatePickerModal';
import { PREVIEW } from '@/lib/devMock';
import styles from './RoomBooking.module.css';

/**
 * Book a phone pod (The Bell Tower / The Scriptorium) for a single hour. Members
 * book free (uncapped); non-members use a Day Pass (£21.60) for the day, which
 * includes the pods. Deliberately simple — for a quick call or one meeting.
 */
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const norm = (s: string) => s.toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();

export function PodBooking() {
  const { member } = useMember();
  const [pods, setPods] = useState<{ id: string; name: string }[]>([]);
  const [podId, setPodId] = useState('');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('10:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getSpaces();
      if (cancelled || !r.ok) return;
      const p = r.data.spaces.filter((s) => /pod/.test(norm(s.type))).map((s) => ({ id: s.id, name: s.name }));
      setPods(p);
      if (p[0]) setPodId(p[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  async function book() {
    setError(null);
    if (!date) return setError('Please choose a date.');
    if (new Date(`${date}T00:00:00`).getDay() % 6 === 0) return setError('Pods are bookable Monday to Friday.');
    if (!podId) return setError('Please choose a pod.');
    if (PREVIEW) return setError('Booking connects on the live site — this is a preview.');
    setBusy(true);
    const r = await roomMemberFree({ spaceId: podId, date, pkg: hour, people: 1 });
    setBusy(false);
    if (r.ok && r.data.ok) return setDone(true);
    setError(r.data?.error === 'slot-taken' ? 'That hour’s just been taken — please pick another.' : 'We couldn’t book that just now — please try again.');
  }

  if (done) {
    const podName = pods.find((p) => p.id === podId)?.name || 'Your pod';
    return (
      <div className={styles.done}>
        <span className={styles.doneIcon}>
          <Icon name="check" size={26} color="var(--gold-700)" />
        </span>
        <h3 className={styles.doneTitle}>Pod booked</h3>
        <p className={styles.doneText}>
          {podName} is yours on {date} at {hour} — free, on your membership. See you then.
        </p>
      </div>
    );
  }

  // Guests: a pod comes with a Day Pass for the day.
  if (!member) {
    return (
      <div className={styles.summary} style={{ position: 'static', maxWidth: 460 }}>
        <h3 className={styles.sumTitle}>Just need a pod for a meeting?</h3>
        <p className={styles.note} style={{ fontSize: 'var(--text-base)' }}>
          A Day Pass (£21.60) gives you the day here — desk, breakfast, coffee and the phone pods for your calls. Members book pods free.
        </p>
        <Button variant="accent" fullWidth href="/day-pass" iconAfter="arrow-right">
          Buy a Day Pass · £21.60
        </Button>
        <p className={styles.note}>
          Already a member? <a href="/login">Sign in</a> to book free.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.formCol}>
        <div className={styles.memberBanner}>
          <Icon name="sparkles" size={16} color="var(--gold-700)" />
          <span>Members book the pods free — for a call or a quick meeting.</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Which pod?</span>
          <div className={styles.pkgRow}>
            {pods.map((p) => (
              <button key={p.id} type="button" className={`${styles.pkg} ${podId === p.id ? styles.pkgOn : ''}`} onClick={() => setPodId(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Date</span>
          <button type="button" className={styles.dateTrigger} onClick={() => setDateOpen(true)}>
            <Icon name="calendar" size={16} color="var(--gold-700)" />
            {date
              ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
              : 'Choose a day'}
          </button>
          <DatePickerModal open={dateOpen} onClose={() => setDateOpen(false)} onPick={(d) => setDate(d)} single />
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Time (one hour)</span>
          <select className={styles.input} value={hour} onChange={(e) => setHour(e.target.value)}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}–{String(Number(h.slice(0, 2)) + 1).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
      </div>
      <aside className={styles.summary}>
        <h3 className={styles.sumTitle}>Book a pod</h3>
        <div className={styles.total}>
          <span>Total</span>
          <span>
            Free <small>on your membership</small>
          </span>
        </div>
        <Button variant="accent" fullWidth onClick={book} disabled={busy} iconAfter="arrow-right">
          {busy ? 'Booking…' : 'Book — free'}
        </Button>
        {error ? <p className={styles.err}>{error}</p> : null}
      </aside>
    </div>
  );
}
