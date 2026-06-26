'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember } from './useMember';
import { WeekStrip } from './WeekStrip';
import {
  adminGetMembers,
  adminGetSpaces,
  adminGetCalendar,
  adminBlock,
  adminExternal,
  adminCancel,
  adminAdjustDays,
  adminCheckinMember,
  type AdminMember,
  type AdminBooking,
  type AdminSpace,
} from '@/lib/booking';
import styles from './AdminClient.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function firstWeekday(): string {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return toISO(d);
}
const TIMES: string[] = (() => {
  const a: string[] = [];
  for (let m = 8 * 60; m <= 18 * 60; m += 30) a.push(minToHHMM(m));
  return a;
})();
const isAdminEmail = (e?: string) => !!e && e.toLowerCase().endsWith('@thinkdigital.travel');

export function AdminClient() {
  const { loading, member } = useMember();
  const [tab, setTab] = useState<'members' | 'rooms'>('members');

  useEffect(() => {
    if (loading || member) return;
    const t = setTimeout(() => window.location.assign('/login'), 2500);
    return () => clearTimeout(t);
  }, [loading, member]);

  if (loading) return <p className={styles.state}>Loading…</p>;
  if (!member) return <p className={styles.state}>Please sign in…</p>;
  if (!isAdminEmail(member.auth?.email)) {
    return (
      <p className={styles.state}>
        This area is for The Quarter team. <a href="/dashboard">Back to your dashboard</a>.
      </p>
    );
  }

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Admin</h1>
          <p className={styles.sub}>Members, rooms &amp; overrides</p>
        </div>
        <a className={styles.back} href="/dashboard">
          ← Dashboard
        </a>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === 'members' ? styles.tabOn : ''}`} onClick={() => setTab('members')}>
          Members
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'rooms' ? styles.tabOn : ''}`} onClick={() => setTab('rooms')}>
          Rooms &amp; bookings
        </button>
      </div>

      {tab === 'members' ? <MembersPane /> : <RoomsPane />}
    </div>
  );
}

function MembersPane() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await adminGetMembers();
    if (r.ok) setMembers(r.data.members);
    else setMsg(r.data?.error || 'Could not load members');
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveDays(m: AdminMember) {
    setBusyId(m.id);
    setMsg(null);
    const r = await adminAdjustDays(m.id, edits[m.id] ?? m.days ?? '');
    if (!r.ok) setMsg(r.data?.error || 'Save failed');
    await refresh();
    setBusyId(null);
  }
  async function checkIn(m: AdminMember) {
    setBusyId(m.id);
    setMsg(null);
    const r = await adminCheckinMember(m.id, 'Full');
    if (!r.ok) setMsg(r.data?.error || 'Check-in failed');
    await refresh();
    setBusyId(null);
  }

  if (loading) return <p className={styles.state}>Loading members…</p>;
  return (
    <div>
      <p className={styles.count}>{members.length} members</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Days</th>
              <th>Renewal</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className={styles.mName}>{m.name || '—'}</div>
                  <div className={styles.mEmail}>{m.email}</div>
                </td>
                <td>
                  {m.plan || '—'}
                  {m.paused ? <span className={styles.pausedTag}>Paused</span> : null}
                </td>
                <td>
                  <input
                    className={styles.dayInput}
                    value={edits[m.id] ?? m.days ?? ''}
                    onChange={(e) => setEdits({ ...edits, [m.id]: e.target.value })}
                    aria-label={`Days for ${m.name || m.email}`}
                  />
                  <button type="button" className={styles.smallBtn} onClick={() => saveDays(m)} disabled={busyId === m.id}>
                    Save
                  </button>
                </td>
                <td className={styles.muted}>{m.renewal || '—'}</td>
                <td>
                  <button type="button" className={styles.smallBtn} onClick={() => checkIn(m)} disabled={busyId === m.id}>
                    Check in
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}

function RoomsPane() {
  const [date, setDate] = useState<string>(() => firstWeekday());
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'block' | 'external'>('block');
  const [spaceId, setSpaceId] = useState<string>('');
  const [start, setStart] = useState<string>('09:00');
  const [end, setEnd] = useState<string>('17:00');
  const [label, setLabel] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await adminGetSpaces();
      if (s.ok) {
        setSpaces(s.data.spaces);
        if (s.data.spaces[0]) setSpaceId(s.data.spaces[0].id);
      }
    })();
  }, []);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    const r = await adminGetCalendar(date);
    if (r.ok) setBookings(r.data.bookings);
    setLoading(false);
  }, [date]);
  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const spaceName = (id: string | null) => spaces.find((s) => s.id === id)?.name ?? 'Space';

  async function add() {
    if (!spaceId) return;
    setBusy(true);
    setMsg(null);
    const payload = { spaceId, date, start, end, name: label };
    const r = kind === 'block' ? await adminBlock(payload) : await adminExternal(payload);
    if (r.ok) {
      setLabel('');
      await loadCalendar();
      setMsg('Added ✓');
    } else {
      setMsg(r.data?.error || 'Could not add');
    }
    setBusy(false);
  }
  async function cancel(id: string) {
    setBusy(true);
    await adminCancel(id);
    await loadCalendar();
    setBusy(false);
  }

  const sorted = [...bookings].sort((a, b) => a.startMin - b.startMin);

  return (
    <div>
      <WeekStrip value={date} onSelect={setDate} />

      <div className={styles.panel}>
        <span className={styles.panelTitle}>Add a block or external booking</span>
        <div className={styles.formRow}>
          <div className={styles.seg}>
            <button type="button" className={`${styles.segBtn} ${kind === 'block' ? styles.segOn : ''}`} onClick={() => setKind('block')}>
              Block
            </button>
            <button type="button" className={`${styles.segBtn} ${kind === 'external' ? styles.segOn : ''}`} onClick={() => setKind('external')}>
              External
            </button>
          </div>
          <select className={styles.select} value={spaceId} onChange={(e) => setSpaceId(e.target.value)} aria-label="Space">
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className={styles.select} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start">
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className={styles.to}>to</span>
          <select className={styles.select} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End">
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className={styles.label}
            placeholder={kind === 'block' ? 'Reason (optional)' : 'Who for'}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={add} disabled={busy}>
            Add
          </Button>
        </div>
      </div>

      {loading ? (
        <p className={styles.state}>Loading…</p>
      ) : sorted.length === 0 ? (
        <p className={styles.muted}>No bookings or blocks for this day.</p>
      ) : (
        <div className={styles.list}>
          {sorted.map((b) => (
            <div key={b.id} className={styles.bRow}>
              <span className={styles.bSpace}>{spaceName(b.space)}</span>
              <span className={styles.bTime}>
                {minToHHMM(b.startMin)}–{minToHHMM(b.endMin)}
              </span>
              <span className={`${styles.bKind} ${b.kind === 'Block' ? styles.kindBlock : ''}`}>{b.kind}</span>
              <span className={styles.bWho}>{b.name || b.email || ''}</span>
              <button type="button" className={styles.smallBtn} onClick={() => cancel(b.id)} disabled={busy}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
