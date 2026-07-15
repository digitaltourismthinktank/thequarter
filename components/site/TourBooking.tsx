'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { getTourSlots, bookTour, type TourSlot } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import { DatePickerModal } from './DatePickerModal';
import styles from './TourBooking.module.css';
import pay from './RoomBooking.module.css';

/** Sample slots for local preview (no Functions) so the layout is visible. */
const PREVIEW_SLOTS: TourSlot[] = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '14:00', '15:00', '16:00', '16:30'].map((time, i) => ({
  time,
  available: i !== 3 && i !== 6,
}));

export function TourBooking() {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<TourSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [closed, setClosed] = useState(false);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);

  // Bring the confirmation into view — it can sit above the fold behind the header.
  useEffect(() => {
    if (done && typeof window !== 'undefined') doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [done]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isWeekend = useMemo(() => {
    if (!date) return false;
    const dow = new Date(`${date}T00:00:00`).getDay();
    return dow === 0 || dow === 6;
  }, [date]);

  useEffect(() => {
    setTime('');
    setSlots([]);
    setClosed(false);
    if (!date || isWeekend) return;
    if (PREVIEW) {
      setSlots(PREVIEW_SLOTS);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const r = await getTourSlots(date);
      if (cancelled) return;
      setLoading(false);
      if (r.ok) {
        setSlots(r.data.slots || []);
        setClosed(!!r.data.closed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, isWeekend]);

  async function submit() {
    setError(null);
    if (!date || isWeekend) return setError('Please choose a weekday.');
    if (!time) return setError('Please pick a time.');
    if (!name.trim()) return setError('Please add your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Please enter a valid email.');
    if (PREVIEW) return setError('Tour booking connects on the live site — this is a preview.');
    setBusy(true);
    const r = await bookTour({ date, time, name: name.trim(), email: email.trim(), phone: phone.trim(), notes: notes.trim() });
    setBusy(false);
    if (r.ok && r.data.ok) return setDone(true);
    setError(r.data?.error === 'slot-taken' ? 'That time’s just been taken — please pick another.' : 'We couldn’t book that just now — please try again.');
  }

  if (done) {
    const friendly = (() => {
      try {
        return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      } catch {
        return date;
      }
    })();
    return (
      <div className={styles.done} ref={doneRef}>
        <span className={styles.doneIcon}>
          <Icon name="check" size={26} color="var(--gold-700)" />
        </span>
        <h3 className={styles.doneTitle}>Your tour is booked</h3>
        <p className={styles.doneText}>
          We’re looking forward to showing you around on {friendly} at {time}. We’ve emailed the details to {email} — see you then.
        </p>
      </div>
    );
  }

  const hasSlots = slots.some((s) => s.available);

  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <div className={styles.field}>
          <span className={styles.label}>Pick a day</span>
          <button type="button" className={pay.dateTrigger} onClick={() => setDateOpen(true)}>
            <Icon name="calendar" size={16} color="var(--gold-700)" />
            {date
              ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
              : 'Choose a day'}
          </button>
          <DatePickerModal open={dateOpen} onClose={() => setDateOpen(false)} onPick={(d) => setDate(d)} single />
        </div>

        {date ? (
          <div className={styles.field}>
            <span className={styles.label}>Pick a time</span>
            {isWeekend ? (
              <p className={styles.hint}>We run tours Monday to Friday — please choose a weekday.</p>
            ) : loading ? (
              <p className={styles.hint}>Finding free times…</p>
            ) : closed || !hasSlots ? (
              <p className={styles.hint}>No tour times that day — please try another.</p>
            ) : (
              <div className={styles.slots}>
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!s.available}
                    className={`${styles.slot} ${time === s.time ? styles.slotOn : ''} ${!s.available ? styles.slotOff : ''}`}
                    onClick={() => setTime(s.time)}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className={styles.col}>
        <label className={styles.field}>
          <span className={styles.label}>Your name</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Phone <span className={styles.optional}>(optional)</span></span>
          <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Anything we should know? <span className={styles.optional}>(optional)</span></span>
          <textarea className={styles.textarea} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Team size, what you’re after…" />
        </label>
        <Button variant="accent" onClick={submit} disabled={busy} iconAfter="arrow-right">
          {busy ? 'Booking…' : 'Book my tour'}
        </Button>
        {error ? <p className={styles.err}>{error}</p> : null}
        <p className={styles.hint}>Free, no obligation — just come and have a look. We’ll email you the time and address.</p>
      </div>
    </div>
  );
}
