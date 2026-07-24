'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminActivity, adminGetMembers, type ActivityEvent, type AdminMember } from '@/lib/booking';
import styles from './AdminLedger.module.css';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000));
const daysAhead = (n: number) => iso(new Date(Date.now() + n * 86400000));

/** Turn the raw actor/source into something a person can read. Booking/check-in rows carry a Source
 *  ('Self'/'Web'/'Kiosk'/'Admin'); write-log rows carry "Admin: email". */
function actorLabel(raw: string, nameByEmail: Record<string, string>): string {
  const a = String(raw || '').trim();
  if (!a) return '';
  const m = a.match(/^admin:\s*(.+)$/i);
  if (m) {
    const who = nameByEmail[m[1].toLowerCase()] || m[1];
    return `Admin — ${who}`;
  }
  const lc = a.toLowerCase();
  if (lc === 'self' || lc === 'web') return 'the member';
  if (lc === 'kiosk' || lc === 'reception') return 'the reception screen';
  if (lc === 'admin') return 'staff';
  if (lc === 'system (cron)' || lc === 'cron' || lc === 'system') return 'the system (overnight)';
  return a;
}

/** A stylised, past-capable date field — a button showing the value, opening a branded month
 *  calendar. Replaces the raw <input type="date"> (whose native popup can't be themed). */
function StyledDate({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState(() => value.slice(0, 7)); // YYYY-MM in view
  useEffect(() => {
    if (open) setView(value.slice(0, 7));
  }, [open, value]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const [vy, vm] = view.split('-').map(Number);
  const first = new Date(Date.UTC(vy, vm - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Mon=0
  const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${view}-${String(d).padStart(2, '0')}`);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(vy, vm - 1 + n, 1));
    setView(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const label2 = value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pick a date';
  const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className={styles.field} ref={wrap}>
      <span>{label}</span>
      <button type="button" className={styles.dateBtn} onClick={() => setOpen((v) => !v)}>
        {label2}
      </button>
      {open ? (
        <div className={styles.cal}>
          <div className={styles.calHead}>
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month">
              ‹
            </button>
            <span>{monthLabel}</span>
            <button type="button" onClick={() => shift(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className={styles.calDow}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className={styles.calGrid}>
            {cells.map((iso, i) =>
              iso === null ? (
                <span key={`x${i}`} />
              ) : (
                <button
                  key={iso}
                  type="button"
                  className={`${styles.calDay} ${iso === value ? styles.calDayOn : ''}`}
                  disabled={(min && iso < min) || (max && iso > max) || false}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {Number(iso.slice(-2))}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Human label + tone for each event type. Tone drives the little type chip's colour. */
const TYPE_META: Record<string, { label: string; tone: 'day' | 'money' | 'points' | 'admin' | 'post' | 'neutral' }> = {
  'check-in': { label: 'Check-in', tone: 'day' },
  'day-booked': { label: 'Day booked', tone: 'day' },
  'day-cancelled': { label: 'Day cancelled', tone: 'money' },
  'day-pass': { label: 'Day pass', tone: 'day' },
  'weekend-request': { label: 'Weekend request', tone: 'neutral' },
  'room-booking': { label: 'Room booking', tone: 'neutral' },
  'company-booking': { label: 'Company booking', tone: 'neutral' },
  'booking-cancelled': { label: 'Booking cancelled', tone: 'money' },
  block: { label: 'Block', tone: 'neutral' },
  points: { label: 'Points', tone: 'points' },
  redemption: { label: 'Redemption', tone: 'points' },
  post: { label: 'Post', tone: 'post' },
  'adjust-days': { label: 'Adjust days', tone: 'admin' },
  'adjust-rollover': { label: 'Adjust rollover', tone: 'admin' },
  'grant-passes': { label: 'Grant passes', tone: 'admin' },
  'adjust-points': { label: 'Adjust points', tone: 'admin' },
};
const typeMeta = (t: string) => TYPE_META[t] || { label: t, tone: 'neutral' as const };

const FILTERS: { id: string; label: string; types: string[] }[] = [
  { id: 'all', label: 'Everything', types: [] },
  { id: 'days', label: 'Days & check-ins', types: ['check-in', 'day-booked', 'day-cancelled', 'day-pass', 'weekend-request'] },
  { id: 'rooms', label: 'Room bookings', types: ['room-booking', 'company-booking', 'booking-cancelled', 'block'] },
  { id: 'points', label: 'Rewards', types: ['points', 'redemption'] },
  { id: 'adjust', label: 'Admin adjustments', types: ['adjust-days', 'adjust-rollover', 'grant-passes', 'adjust-points'] },
  { id: 'post', label: 'Post', types: ['post'] },
];

function fmtWhen(at: string): string {
  if (!at) return '—';
  const d = new Date(at.length <= 10 ? `${at}T00:00:00` : at);
  if (Number.isNaN(d.getTime())) return at;
  const hasTime = at.length > 10;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  });
}

/** A signed movement chip: "−1 day", "+25 pts", "+2 passes". Nothing for a zero/absent delta. */
function Delta({ value, unit }: { value: number | undefined; unit: string }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`${styles.delta} ${up ? styles.deltaUp : styles.deltaDown}`}>
      {up ? '+' : '−'}
      {Math.abs(value)} {unit}
      {Math.abs(value) === 1 ? '' : unit === 'day' ? 's' : ''}
    </span>
  );
}

function toCsv(events: ActivityEvent[], nameByEmail: Record<string, string>, idByEmail: Record<string, string>): string {
  const head = ['When', 'Type', 'Member', 'Email', 'Member ID', 'By', 'Summary', 'Days', 'Rollover', 'Passes', 'Points', 'Base'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = events.map((e) =>
    [fmtWhen(e.at), typeMeta(e.type).label, e.name || nameByEmail[e.email] || '', e.email, idByEmail[e.email] || '', e.actor, e.summary, e.days ?? '', e.roll ?? '', e.passes ?? '', e.points ?? '', e.base]
      .map(esc)
      .join(','),
  );
  return [head.map(esc).join(','), ...rows].join('\n');
}

/**
 * Admin audit ledger — every money/account action in one chronological feed, so staff can see that
 * a check-in took a day, a cancel gave it back, points reversed, and can trace anything to the base
 * it lives in. Filter by member (email) and date window; export the current view to CSV.
 */
export function AdminLedgerPane() {
  const today = iso(new Date());
  const [member, setMember] = useState(''); // the resolved email we query on
  const [from, setFrom] = useState(daysAgo(30));
  // The window reaches into the FUTURE by default: a booking made for next week (or a future booking
  // that's just been cancelled) is dated at ITS date, so a `to` of today would hide it.
  const [to, setTo] = useState(daysAhead(45));
  const [filter, setFilter] = useState('all');
  // Member typeahead — search by name (like the room-booking admin), resolve to their email.
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const pickWrap = useRef<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [meta, setMeta] = useState<{ total: number; truncated?: boolean; activityLive?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminActivity({ member: member.trim(), from, to });
    if (r.ok) {
      setEvents(r.data.events);
      setMeta({ total: r.data.total, truncated: r.data.truncated, activityLive: r.data.activityLive });
    }
    setLoading(false);
  }, [member, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Members for the lookup — fetched once.
  useEffect(() => {
    adminGetMembers().then((r) => {
      if (r.ok) setMembers(r.data.members);
    });
  }, []);
  // Close the lookup dropdown on an outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (pickWrap.current && !pickWrap.current.contains(e.target as Node)) setPickOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => `${m.name ?? ''} ${m.email ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, memberQuery]);

  // email → name / member id, so points & redemption rows (which only carry an email) can show the
  // member's NAME, and every row can carry a discreet unique id to tell two similar people apart.
  const { nameByEmail, idByEmail } = useMemo(() => {
    const n: Record<string, string> = {};
    const i: Record<string, string> = {};
    for (const m of members) {
      const e = (m.email ?? '').toLowerCase();
      if (!e) continue;
      if (m.name) n[e] = m.name;
      if (m.id) i[e] = m.id;
    }
    return { nameByEmail: n, idByEmail: i };
  }, [members]);

  function chooseMember(m: AdminMember) {
    setMember((m.email ?? '').toLowerCase());
    setMemberQuery(m.name || m.email || '');
    setPickOpen(false);
  }
  function clearMember() {
    setMember('');
    setMemberQuery('');
  }

  const shown = useMemo(() => {
    const types = FILTERS.find((f) => f.id === filter)?.types ?? [];
    const ql = q.trim().toLowerCase();
    return (events ?? []).filter((e) => {
      if (types.length && !types.includes(e.type)) return false;
      if (ql && !`${e.name} ${e.email} ${e.summary} ${e.actor}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [events, filter, q]);

  function downloadCsv() {
    const blob = new Blob([toCsv(shown, nameByEmail, idByEmail)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quarter-ledger-${member.trim() || 'all'}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.pane}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Audit ledger</h2>
          <p className={styles.sub}>Every check-in, booking, day, pass, point and adjustment — with the balance movement, traceable to its base.</p>
        </div>
        <button type="button" className={styles.csv} onClick={downloadCsv} disabled={!shown.length}>
          Export CSV
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.field} ref={pickWrap}>
          <span>Member</span>
          <div className={styles.lookup}>
            <input
              type="text"
              placeholder="Search by name — or leave blank for everyone"
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                setPickOpen(true);
                if (!e.target.value.trim()) setMember('');
              }}
              onFocus={() => setPickOpen(true)}
            />
            {member || memberQuery ? (
              <button type="button" className={styles.lookupClear} onClick={clearMember} aria-label="Clear member">
                ×
              </button>
            ) : null}
            {pickOpen && matches.length ? (
              <ul className={styles.lookupMenu}>
                {matches.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => chooseMember(m)}>
                      <span className={styles.lookupName}>{m.name || '—'}</span>
                      <span className={styles.lookupEmail}>{m.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <StyledDate label="From" value={from} max={to} onChange={setFrom} />
        <StyledDate label="To" value={to} min={from} onChange={setTo} />
        <button type="button" className={styles.apply} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      <div className={styles.presets}>
        {[
          { label: 'Last 7 days', from: daysAgo(7) },
          { label: 'Last 30 days', from: daysAgo(30) },
          { label: 'Last 90 days', from: daysAgo(90) },
          { label: 'This year', from: `${today.slice(0, 4)}-01-01` },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            className={styles.preset}
            onClick={() => {
              setFrom(p.from);
              setTo(daysAhead(45)); // always keep upcoming bookings in view
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`${styles.chip} ${filter === f.id ? styles.chipOn : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <input className={styles.search} type="search" placeholder="Search within results…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {meta && !meta.activityLive ? (
        <p className={styles.notice}>
          Showing everything recorded in the existing tables. Manual adjustments, plan changes, pauses and renewals will also appear here once the <strong>Activity</strong> table is connected (setup is a one-off).
        </p>
      ) : null}
      {meta?.truncated ? <p className={styles.notice}>Showing the most recent {shown.length} of {meta.total}+ — narrow the dates or filter by member for the full set.</p> : null}

      {events === null ? (
        <p className={styles.empty}>Loading…</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>Nothing in this window.</p>
      ) : (
        <ol className={styles.feed}>
          {shown.map((e) => {
            const m = typeMeta(e.type);
            // Points/redemption rows carry only an email — fill the name from the members list.
            const name = e.name || nameByEmail[e.email] || '';
            const mid = idByEmail[e.email] || '';
            const actor = actorLabel(e.actor, nameByEmail);
            return (
              <li key={e.id} className={styles.row}>
                <span className={styles.when}>{fmtWhen(e.at)}</span>
                <span className={`${styles.type} ${styles[`tone_${m.tone}`]}`}>{m.label}</span>
                <span className={styles.body}>
                  <span className={styles.rowMain}>
                    {name || e.email || '—'}
                    {name && e.email ? <span className={styles.rowEmail}> · {e.email}</span> : null}
                    {mid ? (
                      <span className={styles.rowId} title={`Member ID ${mid}`}>
                        #{mid.replace(/^mem_/, '').slice(-6)}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.rowSummary}>{e.summary}</span>
                  {actor ? <span className={styles.rowActor}>by {actor}</span> : null}
                </span>
                <span className={styles.deltas}>
                  <Delta value={e.days} unit="day" />
                  <Delta value={e.roll} unit="rollover" />
                  <Delta value={e.passes} unit="pass" />
                  <Delta value={e.points} unit="pts" />
                </span>
                <span className={styles.base} title={`Recorded in ${e.base}`}>{e.base}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
