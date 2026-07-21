'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember } from './useMember';
import { WeekStrip } from './WeekStrip';
import { DatePickerModal } from './DatePickerModal';
import { CompanyInput } from './CompanyInput';
import { Checkbox } from '@/components/ds/Checkbox';
import { Icon, type IconName } from '@/components/ds/Icon';
import { Qr } from '@/components/ds/Qr';
import { EVENT_THEMES } from '@/lib/eventThemes';
import { busyness } from '@/lib/busyness';
import { PLANS, PLAN_MEMBERSTACK_ID, PLAN_DAY_ALLOWANCE } from '@/lib/plans';
import { POINTS_PER_POUND_VALUE, POINTS_PER_GBP, LEVELS } from '@/lib/rewards';
import {
  adminGetMembers,
  adminGetSpaces,
  adminGetCalendar,
  adminBlock,
  adminExternal,
  adminCompanyBooking,
  adminCancel,
  amendBooking,
  adminGetTourBlocks,
  adminBlockTours,
  type TourBlock,
  adminGetWeekendRequests,
  adminApproveWeekend,
  adminDeclineWeekend,
  type WeekendRequest,
  adminAdjustDays,
  adminGrantPasses,
  adminSetDoorCode,
  adminClearVat,
  adminCheckinMember,
  adminGetEvents,
  getUpcomingEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
  adminGetRsvps,
  type EventAttendee,
  adminClaimBirthday,
  adminGetRewards,
  adminSaveReward,
  adminDeleteReward,
  adminGetPerksAll,
  adminSavePerk,
  adminDeletePerk,
  adminGetFloats,
  adminTopUpFloat,
  adminCreatePartner,
  adminGetPayouts,
  adminMarkPaid,
  adminPartnerStatement,
  type PartnerStatement,
  type PayoutPartner,
  adminGetToday,
  adminGetWeek,
  type WeekDay,
  adminRemoveCheckin,
  getRoll,
  signOutGuest,
  adminGetMemberProfile,
  adminAdjustPoints,
  adminRedeemForMember,
  adminUpdateMembership,
  adminRenewNow,
  adminUpdateMember,
  type AdminMember,
  type AdminBooking,
  type AdminSpace,
  type AdminReward,
  type AdminFloat,
  type AdminCheckin,
  type RollGuest,
  type MemberProfile,
  type PerkItem,
  type QuarterEvent,
} from '@/lib/booking';
import { isAdminEmail } from '@/lib/admin';
import { unlockSound } from '@/lib/feedback';
import { CommsPane } from './CommsPane';
import { useAlertChime } from './useAlertChime';
import styles from './AdminClient.module.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.work';
/** Curated glyphs for the content icon picker (all exist in components/ds/Icon). */
const ICON_CHOICES: IconName[] = [
  'gift', 'coffee', 'cake', 'wine', 'utensils', 'ticket', 'landmark', 'shopping-bag',
  'music', 'film', 'book-open', 'mic', 'heart', 'sun', 'snowflake', 'party-popper',
  'star', 'sparkles', 'award', 'percent', 'tag', 'leaf', 'camera', 'palette',
  'activity', 'scissors', 'building', 'map-pin',
];
/** Where events happen — a dropdown so venues stay consistent. */
const EVENT_LOCATIONS = ['The Kentish Pantry', 'The Knight’s Tale', 'The Chapter House', 'The Hop Yard', 'The Vineyard', 'The whole Quarter', 'Off-site'];
/** Content categories for rewards + perks — a picker to avoid typos. */
const CONTENT_CATEGORIES = ['Food & drink', 'Coffee & cake', 'Culture', 'Wellbeing', 'Getting here', 'Shopping', 'Services', 'Treats', 'Experiences'];

const pad = (n: number) => String(n).padStart(2, '0');
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const hhmmToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
}
/** Do two [start,end) minute ranges overlap? */
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart;

/** Serialise rows to CSV (quotes values containing commas/quotes/newlines). */
function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
}
/** Trigger a client-side CSV download (admin's own data — no server round-trip). */
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
/** Shift a 'YYYY-MM' by whole months, and format one as "July 2026". */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function firstWeekday(): string {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return toISO(d);
}
/** The Monday (YYYY-MM-DD) of the week containing an ISO date — parsed as a LOCAL date. */
function mondayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = Monday
  return toISO(new Date(y, m - 1, d - dow));
}
const TIMES: string[] = (() => {
  const a: string[] = [];
  for (let m = 8 * 60; m <= 18 * 60; m += 30) a.push(minToHHMM(m));
  return a;
})();
// Events run into the evening — a wider, finer list than the room-booking TIMES.
const EVENT_TIMES: string[] = (() => {
  const a: string[] = [];
  for (let m = 7 * 60; m <= 22 * 60; m += 15) a.push(minToHHMM(m));
  return a;
})();
/** Whole days until a member's next birthday (from an 'MM-DD'), or null. */
function daysToBirthday(bday: string | null): number | null {
  if (!bday || !/^\d{2}-\d{2}$/.test(bday)) return null;
  const [mm, dd] = bday.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), mm - 1, dd);
  if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, mm - 1, dd);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

const ADMIN_TABS = ['today', 'members', 'comms', 'rooms', 'events', 'content', 'partners', 'birthdays', 'screens'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];
const tabFromHash = (): AdminTab => {
  if (typeof window === 'undefined') return 'today';
  const h = window.location.hash.replace(/^#/, '');
  return (ADMIN_TABS as readonly string[]).includes(h) ? (h as AdminTab) : 'today';
};

export function AdminClient() {
  const { loading, member } = useMember();
  // Browsers refuse to start audio until the user has interacted with the page, so the
  // first chime after a page load would otherwise be dropped in silence. Spend the admin's
  // first click on unlocking it, once.
  useEffect(() => {
    const go = () => unlockSound();
    window.addEventListener('pointerdown', go, { once: true });
    return () => window.removeEventListener('pointerdown', go);
  }, []);
  const [tab, setTabState] = useState<AdminTab>('today');
  // Deep-linkable tabs: admin notification emails link to /admin/#rooms, #members, #partners etc.
  const setTab = useCallback((t: AdminTab) => {
    setTabState(t);
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState(null, '', `#${t}`);
      } catch {
        window.location.hash = t;
      }
    }
  }, []);
  useEffect(() => {
    setTabState(tabFromHash());
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === 'today' ? styles.tabOn : ''}`} onClick={() => setTab('today')}>
          Today
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'members' ? styles.tabOn : ''}`} onClick={() => setTab('members')}>
          Members
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'comms' ? styles.tabOn : ''}`} onClick={() => setTab('comms')}>
          Comms
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'rooms' ? styles.tabOn : ''}`} onClick={() => setTab('rooms')}>
          Rooms &amp; bookings
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'events' ? styles.tabOn : ''}`} onClick={() => setTab('events')}>
          Events
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'content' ? styles.tabOn : ''}`} onClick={() => setTab('content')}>
          Perks &amp; Rewards
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'partners' ? styles.tabOn : ''}`} onClick={() => setTab('partners')}>
          Partners &amp; float
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'birthdays' ? styles.tabOn : ''}`} onClick={() => setTab('birthdays')}>
          Birthdays
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'screens' ? styles.tabOn : ''}`} onClick={() => setTab('screens')}>
          Screens &amp; resources
        </button>
      </div>

      {tab === 'today' ? (
        <AdminTodayPane onAllBirthdays={() => setTab('birthdays')} />
      ) : tab === 'members' ? (
        <MembersPane />
      ) : tab === 'comms' ? (
        <CommsPane />
      ) : tab === 'rooms' ? (
        <RoomsPane />
      ) : tab === 'events' ? (
        <EventsPane />
      ) : tab === 'content' ? (
        <ContentPane />
      ) : tab === 'partners' ? (
        <PartnersPane />
      ) : tab === 'screens' ? (
        <ScreensPane />
      ) : (
        <BirthdaysPane />
      )}
    </div>
  );
}

function MembersPane() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [passEdits, setPassEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState('All');
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('q-attn-dismissed') || '[]'));
    } catch {
      return new Set();
    }
  });
  function dismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem('q-attn-dismissed', JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  const [profileId, setProfileId] = useState<string | null>(null);

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
  async function savePasses(m: AdminMember) {
    // Passes are additive server-side (adminGrantPasses) — send the DELTA from the
    // current balance so the input reads as an absolute value, like the days field.
    const target = Math.round(Number(passEdits[m.id] ?? m.carnet ?? 0) || 0);
    const delta = target - (Number(m.carnet) || 0);
    if (delta === 0) return; // no-op guard
    setBusyId(m.id);
    setMsg(null);
    const r = await adminGrantPasses(m.id, delta);
    if (!r.ok) setMsg(r.data?.error || 'Save failed');
    await refresh();
    setBusyId(null);
  }
  async function checkIn(m: AdminMember, length: 'Full' | 'Half') {
    setBusyId(m.id);
    setMsg(null);
    const who = m.name || m.email || 'Member';
    const r = await adminCheckinMember(m.id, length);
    if (r.ok) {
      // Success was previously silent (setMsg only fired on error) and the row didn't change,
      // so a working check-in looked dead. Confirm it and mark the row.
      setCheckedInIds((s) => new Set(s).add(m.id));
      setMsg(r.data?.alreadyCheckedIn ? `${who} was already checked in today.` : `Checked in ${who}${length === 'Half' ? ' · ½ day' : ''}.`);
    } else {
      setMsg(r.data?.error === 'no-allowance' ? `${who} has no day allowance left.` : r.data?.error || 'Check-in failed');
    }
    await refresh();
    setBusyId(null);
  }

  if (loading) return <p className={styles.state}>Loading members…</p>;

  const FILTERS = ['All', 'Unassigned', 'Day Pass', 'Visitor', 'Resident', 'Citizen', 'Hybrid Office', 'Paused'];
  const companyCount = (c: string) => members.filter((x) => x.company === c).length;
  const unassignedCount = members.filter((m) => m.unassigned).length;
  const filtered = members.filter((m) => {
    const matchesPlan =
      planFilter === 'All'
        ? true
        : planFilter === 'Unassigned'
          ? m.unassigned
          : planFilter === 'Paused'
            ? m.paused
            : m.plan === planFilter && !m.paused;
    if (!matchesPlan) return false;
    if (!q) return true;
    return `${m.name || ''} ${m.email || ''} ${m.company || ''}`.toLowerCase().includes(q.toLowerCase());
  });

  // Members needing a look: card issue, VAT request pending, or a birthday within a week.
  const attention = members
    .flatMap((m) => {
      const items: { m: AdminMember; key: string; label: string; danger?: boolean }[] = [];
      if (m.paymentIssue) items.push({ m, key: `${m.id}:card`, label: 'Card issue', danger: true });
      if (m.vatRequested) items.push({ m, key: `${m.id}:vat`, label: 'VAT invoice requested' });
      const dtb = daysToBirthday(m.bday);
      if (dtb != null && dtb <= 7) items.push({ m, key: `${m.id}:bday`, label: dtb === 0 ? 'Birthday today' : `Birthday in ${dtb}d` });
      return items;
    })
    .filter((it) => !dismissed.has(it.key));

  return (
    <div>
      <div className={styles.mFilters}>
        <input className={styles.mSearch} placeholder="Search name, email or company" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={styles.mChips}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`${styles.mChip} ${planFilter === f ? styles.mChipOn : ''}`} onClick={() => setPlanFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {attention.length > 0 ? (
        <div style={{ border: '1px solid var(--gold-300)', background: 'var(--gold-100)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--gold-700)', marginBottom: 10 }}>
            Needs attention · {attention.length}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {attention.map((it) => (
              <span
                key={it.key}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '5px 6px 5px 12px', fontSize: 'var(--text-sm)' }}
              >
                <button type="button" onClick={() => setProfileId(it.m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--ink-900)', fontWeight: 600 }}>
                  {it.m.name || it.m.email}
                </button>
                <span style={{ color: it.danger ? 'var(--danger)' : 'var(--gold-700)', fontSize: 'var(--text-xs)' }}>{it.label}</span>
                <button type="button" onClick={() => dismiss(it.key)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {unassignedCount > 0 && planFilter !== 'Unassigned' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: '1px solid var(--gold-300)', background: 'var(--gold-100)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--ink-900)' }}>
            <Icon name="user" size={16} color="var(--gold-700)" />
            <strong>{unassignedCount}</strong> {unassignedCount === 1 ? 'member is' : 'members are'} awaiting a plan — set them up from their profile.
          </span>
          <button type="button" className={styles.smallBtn} onClick={() => setPlanFilter('Unassigned')}>
            View
          </button>
        </div>
      ) : null}

      <p className={styles.count}>
        {filtered.length} {planFilter === 'All' ? 'members' : planFilter}
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Plan</th>
              <th>Days</th>
              <th>Passes</th>
              <th>Points</th>
              <th>Renewal</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className={styles.mName}>{m.name || '—'}</div>
                  <div className={styles.mEmail}>{m.email}</div>
                  {m.phone ? <div className={styles.mEmail}>{m.phone}</div> : null}
                  {m.company ? (
                    <div className={styles.mCompany}>
                      <Icon name="building" size={12} color="var(--text-muted)" /> {m.company}
                      {companyCount(m.company) > 1 ? <span className={styles.teamBadge}>+{companyCount(m.company) - 1} here</span> : null}
                    </div>
                  ) : null}
                </td>
                <td>
                  {m.plan || '—'}
                  {m.paused ? <span className={styles.pausedTag}>Paused</span> : null}
                  {m.paymentIssue ? <span className={styles.issueTag}>Card issue</span> : null}
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
                <td>
                  <input
                    className={styles.dayInput}
                    value={passEdits[m.id] ?? (m.carnet ? String(m.carnet) : '')}
                    onChange={(e) => setPassEdits({ ...passEdits, [m.id]: e.target.value })}
                    aria-label={`Day passes for ${m.name || m.email}`}
                  />
                  <button type="button" className={styles.smallBtn} onClick={() => savePasses(m)} disabled={busyId === m.id}>
                    Save
                  </button>
                </td>
                <td className={styles.muted}>{m.points.toLocaleString('en-GB')}</td>
                <td className={styles.muted}>{m.renewal || '—'}</td>
                <td>
                  <button type="button" className={styles.smallBtn} onClick={() => setProfileId(m.id)}>
                    Profile
                  </button>{' '}
                  {checkedInIds.has(m.id) ? (
                    <span className={styles.checkedTag}>✓ Checked in</span>
                  ) : (
                    <span className={styles.seg}>
                      <button type="button" className={styles.segBtn} onClick={() => checkIn(m, 'Full')} disabled={busyId === m.id}>
                        {busyId === m.id ? '…' : 'Check in'}
                      </button>
                      <button type="button" className={styles.segBtn} onClick={() => checkIn(m, 'Half')} disabled={busyId === m.id} title="Half day (½ day cost)">
                        ½
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
      <MemberProfileModal
        id={profileId}
        bday={members.find((m) => m.id === profileId)?.bday ?? null}
        doorCode={members.find((m) => m.id === profileId)?.doorCode ?? null}
        onClose={() => setProfileId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function MemberProfileModal({
  id,
  bday,
  doorCode,
  onClose,
  onChanged,
}: {
  id: string | null;
  bday?: string | null;
  doorCode?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [p, setP] = useState<MemberProfile | null>(null);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [rewardId, setRewardId] = useState('');
  const [planSel, setPlanSel] = useState('');
  const [allowanceEdit, setAllowanceEdit] = useState('');
  const [daysEdit, setDaysEdit] = useState('');
  const [renewalPickerOpen, setRenewalPickerOpen] = useState(false);
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [passes, setPasses] = useState('');
  const [door, setDoor] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [capOverride, setCapOverride] = useState('');
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDoor(doorCode ?? '');
  }, [doorCode]);
  useEffect(() => {
    const parts = (p?.name || '').trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' '));
    setCapOverride(p?.roomHoursCap != null ? String(p.roomHoursCap) : '');
    // Membership section — seed from the loaded profile.
    const curPlan = PLANS.find((x) => x.name.toLowerCase() === (p?.plan || '').toLowerCase());
    setPlanSel(curPlan ? PLAN_MEMBERSTACK_ID[curPlan.id] : '');
    setAllowanceEdit(p?.allowanceOverride != null ? String(p.allowanceOverride) : '');
    setDaysEdit(p?.days != null ? String(p.days) : '');
    setConfirmRenew(false);
  }, [p]);

  const load = useCallback(async () => {
    if (!id) return;
    const [pr, rw] = await Promise.all([adminGetMemberProfile(id), adminGetRewards()]);
    if (pr.ok) setP(pr.data);
    if (rw.ok) setRewards(rw.data.rewards.filter((r) => r.status === 'live'));
  }, [id]);
  useEffect(() => {
    if (!id) return;
    setP(null);
    setMsg(null);
    setDelta('');
    setReason('');
    setRewardId('');
    setConfirmAdjust(false);
    setPlanSel('');
    load();
  }, [id, load]);

  if (!id) return null;

  async function adjust() {
    const d = Math.round(Number(delta) || 0);
    if (!d || !id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminAdjustPoints(id, d, reason || 'admin adjust');
    setBusy(false);
    if (r.ok) {
      setDelta('');
      setReason('');
      setConfirmAdjust(false);
      setMsg(`Balance is now ${r.data.balance.toLocaleString('en-GB')}.`);
      await load();
      onChanged();
    } else setMsg('Could not adjust points.');
  }
  async function grant() {
    const n = Math.round(Number(passes) || 0);
    if (!n || !id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminGrantPasses(id, n);
    setBusy(false);
    if (r.ok) {
      setPasses('');
      setMsg(`Day passes updated — ${r.data.carnet.remaining} left.`);
      onChanged();
    } else setMsg('Could not update passes.');
  }
  async function saveDoor() {
    if (!id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminSetDoorCode(id, door.trim());
    setBusy(false);
    if (r.ok) {
      setMsg('Door code updated.');
      onChanged();
    } else setMsg('Could not update the door code.');
  }
  async function saveDetails() {
    if (!id) return;
    setBusy(true);
    setMsg(null);
    const cap = capOverride.trim() === '' ? null : Math.max(0, Number(capOverride) || 0);
    const r = await adminUpdateMember(id, { firstName: firstName.trim(), lastName: lastName.trim(), meetingRoomHoursCap: cap });
    setBusy(false);
    if (r.ok) {
      setMsg('Details updated.');
      await load();
      onChanged();
    } else setMsg('Could not update details.');
  }
  async function redeem() {
    if (!rewardId || !id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminRedeemForMember(id, rewardId);
    setBusy(false);
    if (r.ok) {
      setRewardId('');
      setMsg(`Redeemed ${r.data.reward}`);
      await load();
      onChanged();
    } else {
      setMsg(r.data?.error === 'insufficient' ? 'Not enough points.' : r.data?.error === 'back-soon' ? 'That reward is back soon.' : 'Could not redeem.');
    }
  }

  // ---- Membership (manually-managed / admin-set) ----
  async function saveMembershipPlan() {
    if (!planSel || !id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminUpdateMembership({ memberId: id, planId: planSel });
    setBusy(false);
    if (r.ok) {
      setMsg('Plan updated.');
      await load();
      onChanged();
    } else setMsg('Could not update the plan.');
  }
  async function saveRenewal(isoDate: string) {
    if (!id) return;
    // DatePickerModal yields YYYY-MM-DD; the backend stores renewal-date as DD/MM/YYYY.
    const [y, mo, d] = isoDate.split('-');
    const renewalDate = `${d}/${mo}/${y}`;
    setBusy(true);
    setMsg(null);
    const r = await adminUpdateMembership({ memberId: id, renewalDate });
    setBusy(false);
    if (r.ok) {
      setMsg(`Renewal date set to ${renewalDate}.`);
      await load();
      onChanged();
    } else setMsg('Could not set the renewal date.');
  }
  async function saveAllowance() {
    if (!id) return;
    const raw = allowanceEdit.trim();
    const allowance: number | '' = raw === '' ? '' : Math.max(0, Math.round(Number(raw) || 0));
    setBusy(true);
    setMsg(null);
    const r = await adminUpdateMembership({ memberId: id, allowance });
    setBusy(false);
    if (r.ok) {
      setMsg(raw === '' ? 'Custom days cleared — back to the plan default.' : `Custom monthly days set to ${allowance}.`);
      await load();
      onChanged();
    } else setMsg('Could not update the day allowance.');
  }
  async function saveDaysBalance() {
    if (!id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminAdjustDays(id, daysEdit.trim());
    setBusy(false);
    if (r.ok) {
      setMsg('Days remaining updated.');
      await load();
      onChanged();
    } else setMsg('Could not update days remaining.');
  }
  async function renewNow() {
    if (!id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminRenewNow(id);
    setBusy(false);
    if (r.ok) {
      setConfirmRenew(false);
      setMsg('Renewed — days reset and the renewal date rolled forward a month.');
      await load();
      onChanged();
    } else setMsg('Could not renew.');
  }

  const since = p?.since ? new Date(p.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—';
  const bdayLabel =
    bday && /^\d{2}-\d{2}$/.test(bday)
      ? (() => {
          const [mm, dd] = bday.split('-').map(Number);
          return new Date(2000, mm - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
        })()
      : null;
  const d = Math.round(Number(delta) || 0);
  // Plan default day allowance (for the "overrides plan" hint): null = unlimited.
  const curPlanId = PLANS.find((x) => x.name.toLowerCase() === (p?.plan || '').toLowerCase())?.id;
  const planDefaultDays = curPlanId ? PLAN_DAY_ALLOWANCE[curPlanId] : undefined;
  const planDefaultLabel = planDefaultDays === null ? 'unlimited' : typeof planDefaultDays === 'number' ? `${planDefaultDays}/mo` : null;

  return (
    <div className={styles.profOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.profCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.profHead}>
          <div>
            <h3 className={styles.profName}>{p?.name || 'Member'}</h3>
            <span className={styles.profSub}>
              {p?.email}
              {p?.phone ? ` · ${p.phone}` : ''}
              {p?.company ? ` · ${p.company}` : ''}
              {p?.plan ? ` · ${p.plan}` : ''}
              {bdayLabel ? ` · Birthday ${bdayLabel}` : ''}
              {p?.paused ? ' · Paused' : ''}
            </span>
          </div>
          <button className={styles.profClose} onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        {!p ? (
          <p className={styles.state}>Loading…</p>
        ) : (
          <>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <strong>{p.points.toLocaleString('en-GB')}</strong>
                <span>points</span>
              </div>
              <div className={styles.stat}>
                <strong>{p.daysIn}</strong>
                <span>days in</span>
              </div>
              <div className={styles.stat}>
                <strong>{p.days ?? '—'}</strong>
                <span>days left</span>
              </div>
              <div className={styles.stat}>
                <strong>{p.rewardsRedeemed}</strong>
                <span>rewards redeemed</span>
              </div>
              <div className={styles.stat}>
                <strong>{p.pointsRedeemed.toLocaleString('en-GB')}</strong>
                <span>pts redeemed</span>
              </div>
              <div className={styles.stat}>
                <strong>{since}</strong>
                <span>member since</span>
              </div>
            </div>

            <div className={styles.profSection}>
              <span className={styles.profSectionTitle}>Edit details</span>
              <div className={styles.formRow}>
                <input className={styles.label} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-label="First name" />
                <input className={styles.label} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} aria-label="Last name" />
                <input
                  className={styles.dayInput}
                  type="number"
                  min={0}
                  placeholder="4h"
                  value={capOverride}
                  onChange={(e) => setCapOverride(e.target.value)}
                  aria-label="Free meeting-room hours per month"
                  title="Free meeting-room hours per month (blank = default 4)"
                />
                <button type="button" className={styles.smallBtn} onClick={saveDetails} disabled={busy}>
                  Save
                </button>
              </div>
              <span className={styles.muted}>Fixes a wrong name; the number is their free meeting-room hours/month (blank = 4).</span>
            </div>

            <div className={styles.profSection}>
              <span className={styles.profSectionTitle}>
                Membership
                <span className={p.manualBilling ? styles.pausedTag : styles.billTag}>{p.manualBilling ? 'Manual billing' : 'Stripe'}</span>
              </span>

              {/* Plan */}
              <div className={styles.formRow}>
                <select className={styles.select} value={planSel} onChange={(e) => setPlanSel(e.target.value)} aria-label="Plan">
                  <option value="">Choose a plan…</option>
              {/* Removes the plan — day-pass / carnet only. Non-empty, so the button enables. */}
              <option value="none">No plan · day pass only</option>
                  {PLANS.filter((pl) => pl.id !== 'day-pass').map((pl) => (
                    <option key={pl.id} value={PLAN_MEMBERSTACK_ID[pl.id]}>
                      {pl.name}
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.smallBtn} onClick={saveMembershipPlan} disabled={busy || !planSel}>
                  Assign / change plan
                </button>
              </div>
              <span className={styles.muted}>Current plan: {p.plan || 'None yet'}.</span>

              {/* Renewal / reset date */}
              <div className={styles.formRow} style={{ marginTop: 12 }}>
                <button type="button" className={styles.dateTrigger} onClick={() => setRenewalPickerOpen(true)} aria-label="Renewal date">
                  <Icon name="calendar" size={15} color="var(--gold-700)" />
                  {p.renewal ? `Renews ${p.renewal}` : 'Set renewal date'}
                </button>
                <span className={styles.muted}>Resets their days on this date (manual members).</span>
              </div>

              {/* Custom monthly days (overrides the plan) */}
              <div className={styles.formRow} style={{ marginTop: 12 }}>
                <input
                  className={styles.dayInput}
                  type="number"
                  min={0}
                  placeholder="—"
                  value={allowanceEdit}
                  onChange={(e) => setAllowanceEdit(e.target.value)}
                  aria-label="Custom monthly days"
                />
                <button type="button" className={styles.smallBtn} onClick={saveAllowance} disabled={busy}>
                  Save days/mo
                </button>
                <span className={styles.muted}>
                  Custom monthly days (overrides plan).{' '}
                  {p.allowanceOverride != null ? `Currently ${p.allowanceOverride}` : 'Using plan default'}
                  {planDefaultLabel ? ` · plan default ${planDefaultLabel}` : ''}. Empty clears the override.
                </span>
              </div>

              {/* Days remaining this cycle */}
              <div className={styles.formRow} style={{ marginTop: 12 }}>
                <input
                  className={styles.dayInput}
                  type="number"
                  placeholder="days"
                  value={daysEdit}
                  onChange={(e) => setDaysEdit(e.target.value)}
                  aria-label="Days remaining"
                />
                <button type="button" className={styles.smallBtn} onClick={saveDaysBalance} disabled={busy}>
                  Save balance
                </button>
                <span className={styles.muted}>Days remaining this cycle.</span>
              </div>

              {/* Renew now */}
              <div className={styles.formRow} style={{ marginTop: 12 }}>
                {confirmRenew ? (
                  <>
                    <span className={styles.caution}>Reset days &amp; roll the renewal date forward a month?</span>
                    <button type="button" className={styles.smallBtn} onClick={renewNow} disabled={busy}>
                      Confirm renew
                    </button>
                    <button type="button" className={styles.smallBtn} onClick={() => setConfirmRenew(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className={styles.smallBtn} onClick={() => setConfirmRenew(true)} disabled={busy}>
                    Renew now
                  </button>
                )}
              </div>
            </div>

            <div className={styles.profSection}>
              <span className={styles.profSectionTitle}>Redeem a reward (deducts points)</span>
              <div className={styles.formRow}>
                <select className={styles.select} value={rewardId} onChange={(e) => setRewardId(e.target.value)} aria-label="Reward">
                  <option value="">Choose a reward…</option>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} — {r.cost} pts
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.smallBtn} onClick={redeem} disabled={busy || !rewardId}>
                  Deduct
                </button>
              </div>
            </div>

            <div className={styles.profSection}>
              <span className={styles.profSectionTitle}>Adjust points</span>
              <div className={styles.formRow}>
                <input
                  className={styles.dayInput}
                  type="number"
                  placeholder="+/−"
                  value={delta}
                  onChange={(e) => {
                    setDelta(e.target.value);
                    setConfirmAdjust(false);
                  }}
                />
                <input className={styles.label} placeholder="Reason (recorded)" value={reason} onChange={(e) => setReason(e.target.value)} />
                {confirmAdjust ? (
                  <>
                    <span className={styles.caution}>
                      Apply {d > 0 ? '+' : ''}
                      {d} to {p.name}?
                    </span>
                    <button type="button" className={styles.smallBtn} onClick={adjust} disabled={busy}>
                      Confirm
                    </button>
                    <button type="button" className={styles.smallBtn} onClick={() => setConfirmAdjust(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className={styles.smallBtn} onClick={() => d && setConfirmAdjust(true)} disabled={!d}>
                    Adjust
                  </button>
                )}
              </div>
            </div>

            <div className={styles.profSection}>
              <span className={styles.profSectionTitle}>Day passes</span>
              <div className={styles.formRow}>
                <input
                  className={styles.dayInput}
                  type="number"
                  placeholder="+/−"
                  value={passes}
                  onChange={(e) => setPasses(e.target.value)}
                />
                <button type="button" className={styles.smallBtn} onClick={grant} disabled={busy || !passes}>
                  Grant passes
                </button>
                <span className={styles.muted}>For comps or to test a purchase.</span>
              </div>
            </div>

            <div className={styles.profSection}>
              <span className={styles.profSectionTitle}>Door code</span>
              <div className={styles.formRow}>
                <input className={styles.dayInput} value={door} onChange={(e) => setDoor(e.target.value)} placeholder="e.g. 1324#" aria-label="Door code" />
                <button type="button" className={styles.smallBtn} onClick={saveDoor} disabled={busy}>
                  Save code
                </button>
              </div>
            </div>

            {p.recentLedger.length ? (
              <div className={styles.profSection}>
                <span className={styles.profSectionTitle}>Recent points</span>
                <div className={styles.profHist}>
                  {p.recentLedger.map((l, i) => (
                    <div key={i} className={styles.profHistRow}>
                      <span>{l.reason}</span>
                      <span className={l.delta < 0 ? styles.histNeg : styles.histPos}>
                        {l.delta > 0 ? '+' : ''}
                        {l.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {msg ? <p className={styles.msg}>{msg}</p> : null}
          </>
        )}
      </div>
      <DatePickerModal
        open={renewalPickerOpen}
        onClose={() => setRenewalPickerOpen(false)}
        onPick={(picked) => {
          setRenewalPickerOpen(false);
          saveRenewal(picked);
        }}
        single
        allowWeekend
        note="Pick the date this membership next renews."
        planned={[]}
      />
    </div>
  );
}

const TOUR_TIMES = (() => {
  const out: string[] = [];
  for (let m = 570; m <= 1020; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out;
})();

/** Close public tours for a whole day or a set of hours — independent of room blocks. */
function TourClosePanel() {
  const [blocks, setBlocks] = useState<TourBlock[]>([]);
  const [date, setDate] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('09:30');
  const [end, setEnd] = useState('17:00');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await adminGetTourBlocks();
    if (r.ok) setBlocks(r.data.blocks);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!date) return setMsg('Pick a date.');
    if (!allDay && hhmmToMin(start) >= hhmmToMin(end)) return setMsg('End must be after start.');
    setBusy(true);
    setMsg(null);
    const r = await adminBlockTours(allDay ? { date } : { date, start, end });
    setBusy(false);
    if (r.ok) {
      setMsg('Tours closed for that time.');
      setDate('');
      await load();
    } else setMsg('Could not close tours.');
  }
  async function reopen(id: string) {
    setBusy(true);
    await adminCancel(id);
    setBusy(false);
    await load();
  }

  return (
    <div className={styles.panel}>
      <span className={styles.panelTitle}>Close tours (independent of room blocks)</span>
      <div className={styles.formRow}>
        <button type="button" className={styles.dateTrigger} onClick={() => setPickerOpen(true)} aria-label="Date">
          <Icon name="calendar" size={15} color="var(--gold-700)" />
          {date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Pick a date'}
        </button>
        <Checkbox label="All day" checked={allDay} onChange={() => setAllDay((v) => !v)} />
        {!allDay ? (
          <>
            <select className={styles.select} value={start} onChange={(e) => setStart(e.target.value)} aria-label="From">
              {TOUR_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className={styles.to}>to</span>
            <select className={styles.select} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="To">
              {TOUR_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <button type="button" className={styles.smallBtn} onClick={add} disabled={busy}>
          Close tours
        </button>
      </div>
      {msg ? <p className={styles.muted}>{msg}</p> : null}
      {blocks.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {blocks.map((b) => (
            <span
              key={b.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '5px 6px 5px 12px', fontSize: 'var(--text-sm)' }}
            >
              {b.date} · {b.title}
              <button type="button" onClick={() => reopen(b.id)} aria-label="Reopen tours" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}>
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>Tours are open on all upcoming weekdays.</p>
      )}
      <DatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(d) => {
          setDate(d);
          setPickerOpen(false);
        }}
        single
        planned={date ? [date] : []}
      />
    </div>
  );
}

function RoomsPane() {
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [loading, setLoading] = useState(true);
  // Week VIEW: the strip navigates whole weeks; we fetch all five weekdays and show them side by
  // side. Entirely decoupled from the add-form (which carries its own date). `focusDay` only tints
  // the day column you last tapped in the strip.
  const [weekStart, setWeekStart] = useState<string>(() => mondayISO(firstWeekday()));
  const [focusDay, setFocusDay] = useState<string>(() => firstWeekday());
  const [weekBookings, setWeekBookings] = useState<Record<string, AdminBooking[]>>({});

  const [kind, setKind] = useState<'block' | 'external' | 'company'>('block');
  const [spaceId, setSpaceId] = useState<string>('');
  // The booking's OWN date — chosen right in the form via its stylised picker. This is the ONLY
  // thing that decides which day a new booking lands on; the week strip above never touches it.
  const [formDate, setFormDate] = useState<string>(() => firstWeekday());
  const [formDateOpen, setFormDateOpen] = useState(false);
  const [start, setStart] = useState<string>('09:00');
  const [end, setEnd] = useState<string>('17:00');
  const [label, setLabel] = useState<string>('');
  const [holdOn, setHoldOn] = useState(true);
  const [holdUntil, setHoldUntil] = useState<string>('11:00');
  const [releasable, setReleasable] = useState(true);
  const [repeat, setRepeat] = useState<'none' | 'weekly'>('none');
  // How a weekly repeat ends: on a fixed date (dated rows) or never (one indefinite RULE row).
  const [ends, setEnds] = useState<'date' | 'never'>('date');
  const [until, setUntil] = useState<string>('');
  const [untilOpen, setUntilOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Cancelling a recurring-rule occurrence: pick "this week only" vs "the whole series".
  const [cancelChoice, setCancelChoice] = useState<{ realId: string; date: string; room: string } | null>(null);
  // Inline amend (move a booking's date/time, same room) — one booking at a time.
  const [amendId, setAmendId] = useState<string | null>(null);
  const [aDate, setADate] = useState('');
  const [aStart, setAStart] = useState('');
  const [aEnd, setAEnd] = useState('');
  const [amendErr, setAmendErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await adminGetSpaces();
      if (s.ok) {
        setSpaces(s.data.spaces);
        if (s.data.spaces[0]) setSpaceId(s.data.spaces[0].id);
      }
    })();
  }, []);

  const weekDays = Array.from({ length: 5 }, (_, i) => addDaysISO(weekStart, i)); // Mon–Fri ISO

  // Fetch the whole visible week — one calendar call per weekday, in parallel. Each response
  // already carries expanded recurring-rule occurrences + privatisations, so the week view and the
  // clash-check both see everything.
  const loadWeek = useCallback(async () => {
    setLoading(true);
    const days = Array.from({ length: 5 }, (_, i) => addDaysISO(weekStart, i));
    const results = await Promise.all(days.map((d) => adminGetCalendar(d)));
    const map: Record<string, AdminBooking[]> = {};
    days.forEach((d, i) => {
      map[d] = results[i].ok ? results[i].data.bookings : [];
    });
    setWeekBookings(map);
    setLoading(false);
  }, [weekStart]);
  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // Stable callback so the strip's week-change effect fires only when the week actually moves.
  const handleWeekChange = useCallback((mondayIso: string) => setWeekStart(mondayIso), []);

  const spaceName = (id: string | null) => spaces.find((s) => s.id === id)?.name ?? 'Space';

  // Weekly + no end date = ONE indefinite RULE row the calendar expands (Block, External AND
  // Company all support this now).
  const indefinite = repeat === 'weekly' && ends === 'never';

  async function createOne(dateStr: string) {
    const recurring = repeat === 'weekly';
    if (kind === 'company') {
      return adminCompanyBooking({
        spaceId,
        date: dateStr,
        start,
        end,
        company: label,
        // Hold toggle OFF → firm booking: send no holdUntil (never auto-released).
        ...(holdOn ? { holdUntil, releasable } : {}),
        recurring,
        indefinite,
      });
    }
    const payload = { spaceId, date: dateStr, start, end, name: label, recurring, indefinite };
    return kind === 'block' ? adminBlock(payload) : adminExternal(payload);
  }

  async function add() {
    if (!spaceId) return;
    const sMin = hhmmToMin(start);
    const eMin = hhmmToMin(end);
    if (eMin <= sMin) {
      setMsg('End time must be after the start time.');
      return;
    }
    setBusy(true);
    setMsg(null);

    // The dates to create. An indefinite rule is a SINGLE row (no series). Otherwise: just the
    // form's day, or — for a dated weekly repeat — a series up to the "until" date.
    const dates: string[] = [formDate];
    if (repeat === 'weekly' && ends === 'date' && !indefinite && until && until >= formDate) {
      let d = addDaysISO(formDate, 7);
      while (d <= until && dates.length < 60) {
        dates.push(d);
        d = addDaysISO(d, 7);
      }
    }

    let added = 0;
    const skipped: string[] = []; // client-detected clashes (room already booked)
    const failed: string[] = []; // genuine server save failures (Airtable rejected the write)
    let firstError = '';
    for (const dt of dates) {
      // Conflict detection — never double-book a room. Re-use the visible week's data when the
      // date is on screen; otherwise fetch that date's calendar. Expanded recurring blocks +
      // privatisations come back in this list, so they block correctly.
      const dayBookings = weekBookings[dt] ?? (await adminGetCalendar(dt)).data?.bookings ?? [];
      // Ignore all-day / privatisation rows (no real Start/End window) — they'd otherwise
      // falsely clash with every timed booking and silently skip a legitimate add.
      const clash = dayBookings.some(
        (b) => b.space === spaceId && !(b.allDay || b.endMin <= b.startMin) && overlaps(sMin, eMin, b.startMin, b.endMin),
      );
      if (clash) {
        skipped.push(dt);
        continue;
      }
      const r = await createOne(dt);
      if (r.ok) {
        added += 1;
      } else {
        // A non-ok here is a SERVER SAVE FAILURE, not a clash (clashes are caught above). Capture
        // the real Airtable reason so we can show it instead of a misleading "already booked".
        failed.push(dt);
        if (!firstError) firstError = r.data?.detail || r.data?.error || '';
      }
    }

    // Reset the form on any success so it's clear the add landed…
    if (added > 0) {
      setLabel('');
      setStart('09:00');
      setEnd('17:00');
      setHoldUntil('11:00');
    }
    // …and ALWAYS refresh the week view, so it can't go stale even in edge cases.
    await loadWeek();
    if (dates.length === 1) {
      if (added) {
        setMsg(indefinite ? 'Recurring block added — repeats every week with no end date.' : 'Added');
      } else if (skipped.length) {
        setMsg(`That room is already booked ${start}–${end} that day — cancel the existing booking first.`);
      } else {
        setMsg(`Couldn't save the booking — ${firstError || 'please try again'}.`);
      }
    } else {
      const parts = [`Added ${added} of ${dates.length} weekly bookings`];
      if (skipped.length) parts.push(`${skipped.length} skipped (already booked)`);
      if (failed.length) parts.push(`${failed.length} failed${firstError ? ` — ${firstError}` : ''}`);
      setMsg(`${parts.join(' · ')}.`);
    }
    setBusy(false);
  }
  async function cancel(id: string, day: string, room: string) {
    // Recurring-block occurrences carry a synthetic `rblock-<recordId>` id — cancelling maps back
    // to the single RULE row. Offer a choice: drop just THIS week (record a skip date on the rule)
    // or the WHOLE series (cancel the rule row). One-off bookings cancel straight away.
    if (id.startsWith('rblock-')) {
      setCancelChoice({ realId: id.slice('rblock-'.length), date: day, room });
      return;
    }
    setBusy(true);
    await adminCancel(id);
    await loadWeek();
    setBusy(false);
  }
  async function runCancel(scope: 'occurrence' | 'series') {
    if (!cancelChoice) return;
    setBusy(true);
    await adminCancel(cancelChoice.realId, scope === 'occurrence' ? { scope: 'occurrence', date: cancelChoice.date } : { scope: 'series' });
    setCancelChoice(null);
    await loadWeek();
    setBusy(false);
  }
  function openAmend(b: AdminBooking, day: string) {
    setAmendId(b.id);
    setADate(day);
    setAStart(minToHHMM(b.startMin));
    setAEnd(minToHHMM(b.endMin));
    setAmendErr(null);
  }
  async function saveAmend(id: string) {
    if (aEnd <= aStart) {
      setAmendErr('End must be after start.');
      return;
    }
    setBusy(true);
    setAmendErr(null);
    const r = await amendBooking(id, aDate, aStart, aEnd);
    if (!r.ok) {
      const code = (r.data as { error?: string })?.error;
      setAmendErr(code === 'slot-taken' ? 'That slot is taken.' : code === 'double-book' ? 'Clashes with another booking.' : code === 'closed-day' ? 'Closed that day.' : 'Couldn’t move it.');
      setBusy(false);
      return;
    }
    setAmendId(null);
    await loadWeek();
    setBusy(false);
  }
  // 08:00–18:00 in 30-min steps for the amend selects.
  const AMEND_TIMES: string[] = [];
  for (let mm = 8 * 60; mm <= 18 * 60; mm += 30) AMEND_TIMES.push(minToHHMM(mm));

  const weekdayName = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });

  /** One booking/block/company/privatisation, with ALL its info + the Cancel action. */
  function BookingCard({ b, day }: { b: AdminBooking; day: string }) {
    const isRule = b.id.startsWith('rblock-');
    const kindLabel = b.allDay ? 'Privatised' : b.company ? 'Company' : b.kind;
    const who = b.company || b.name || b.email || '';
    const recurrence = b.allDay ? null : isRule ? `Every ${weekdayName(day)}` : b.recurring ? 'Repeats weekly' : null;
    const status = b.allDay
      ? null
      : b.released
        ? 'Released'
        : b.checkedIn
          ? 'Checked in'
          : b.holdUntil
            ? `Held to ${b.holdUntil}`
            : null;
    return (
      <div className={styles.bCard}>
        <div className={styles.bCardTop}>
          <span className={styles.bCardTime}>{b.allDay ? 'All day' : `${minToHHMM(b.startMin)}–${minToHHMM(b.endMin)}`}</span>
          <span className={`${styles.bKind} ${b.kind === 'Block' ? styles.kindBlock : ''}`}>{kindLabel}</span>
        </div>
        <span className={styles.bCardRoom}>{spaceName(b.space)}</span>
        {who ? <span className={styles.bCardWho}>{who}</span> : null}
        {recurrence ? (
          <span className={styles.bCardMeta}>
            <Icon name="rotate-cw" size={12} color="var(--gold-700)" /> {recurrence}
            {isRule ? ' · no end' : ''}
          </span>
        ) : null}
        {status ? <span className={styles.statusTag}>{status}</span> : null}
        {b.allDay ? null : (
          <div className={styles.bActions}>
            {!isRule ? (
              <button type="button" className={styles.bAmend} onClick={() => (amendId === b.id ? setAmendId(null) : openAmend(b, day))} disabled={busy && amendId !== b.id}>
                {amendId === b.id ? 'Close' : 'Amend'}
              </button>
            ) : null}
            <button type="button" className={styles.bCancel} onClick={() => cancel(b.id, day, spaceName(b.space))} disabled={busy}>
              Cancel
            </button>
          </div>
        )}
        {amendId === b.id ? (
          <div className={styles.bAmendEditor}>
            <input type="date" value={aDate} onChange={(e) => setADate(e.target.value)} />
            <select value={aStart} onChange={(e) => setAStart(e.target.value)}>
              {AMEND_TIMES.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={aEnd} onChange={(e) => setAEnd(e.target.value)}>
              {AMEND_TIMES.filter((t) => t > aStart).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button type="button" className={styles.bAmendSave} onClick={() => saveAmend(b.id)} disabled={busy}>
              Save
            </button>
            {amendErr ? <span className={styles.bAmendErr}>{amendErr}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.weekSection}>
        <span className={styles.panelTitle}>This week’s bookings</span>
        <WeekStrip value={focusDay} onSelect={setFocusDay} onWeekChange={handleWeekChange} />
        {loading ? (
          <p className={styles.state}>Loading…</p>
        ) : (
          <div className={styles.weekGrid}>
            {weekDays.map((d) => {
              const list = [...(weekBookings[d] || [])].sort(
                (a, b) => (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || a.startMin - b.startMin,
              );
              const dObj = new Date(`${d}T12:00:00`);
              return (
                <div key={d} className={`${styles.weekCol} ${d === focusDay ? styles.weekColOn : ''}`}>
                  <div className={styles.weekColHead}>
                    <span className={styles.weekColDow}>{dObj.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                    <span className={styles.weekColDate}>{dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className={styles.weekEmpty}>Nothing booked</p>
                  ) : (
                    list.map((b) => <BookingCard key={b.id} b={b} day={d} />)
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TourClosePanel />

      <div className={styles.panel}>
        <span className={styles.panelTitle}>Add a booking</span>
        <div className={styles.bookForm}>
          {/* Row 1 — Type · Date · Room · Time */}
          <div className={styles.formLine}>
            <label className={`${styles.field} ${styles.fType}`}>
              <span>Type</span>
              <div className={styles.seg}>
                <button type="button" className={`${styles.segBtn} ${kind === 'block' ? styles.segOn : ''}`} onClick={() => setKind('block')}>
                  Block
                </button>
                <button type="button" className={`${styles.segBtn} ${kind === 'external' ? styles.segOn : ''}`} onClick={() => setKind('external')}>
                  External
                </button>
                <button type="button" className={`${styles.segBtn} ${kind === 'company' ? styles.segOn : ''}`} onClick={() => setKind('company')}>
                  Company
                </button>
              </div>
            </label>
            <label className={`${styles.field} ${styles.fDate}`}>
              <span>Date</span>
              <button type="button" className={styles.dateTrigger} onClick={() => setFormDateOpen(true)} aria-label="Booking date">
                <Icon name="calendar" size={15} color="var(--gold-700)" />
                {formDate ? new Date(`${formDate}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Pick a date'}
              </button>
            </label>
            <label className={`${styles.field} ${styles.fRoom}`}>
              <span>Room</span>
              <select className={styles.select} value={spaceId} onChange={(e) => setSpaceId(e.target.value)} aria-label="Room">
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.field} ${styles.fTime}`}>
              <span>Time</span>
              <div className={styles.timeRange}>
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
              </div>
            </label>
          </div>

          {/* Row 2 — Who/Company · Repeat · Ends · End date */}
          <div className={styles.formLine}>
            <label className={`${styles.field} ${styles.fWho}`}>
              <span>{kind === 'company' ? 'Company' : kind === 'block' ? 'Reason' : 'Who for'}</span>
              {kind === 'company' ? (
                <CompanyInput className={styles.input} value={label} onChange={setLabel} placeholder="Company name" />
              ) : (
                <input
                  className={styles.input}
                  placeholder={kind === 'block' ? 'Optional' : 'Guest / booking name'}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              )}
            </label>
            <label className={`${styles.field} ${styles.fRepeat}`}>
              <span>Repeat</span>
              <select className={styles.select} value={repeat} onChange={(e) => setRepeat(e.target.value as 'none' | 'weekly')} aria-label="Repeat">
                <option value="none">Doesn’t repeat</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            {repeat === 'weekly' ? (
              <label className={`${styles.field} ${styles.fEnds}`}>
                <span>Ends</span>
                <select className={styles.select} value={ends} onChange={(e) => setEnds(e.target.value as 'date' | 'never')} aria-label="Ends">
                  <option value="date">On a date</option>
                  <option value="never">Indefinitely (no end date)</option>
                </select>
              </label>
            ) : null}
            {repeat === 'weekly' && ends === 'date' ? (
              <label className={`${styles.field} ${styles.fEndDate}`}>
                <span>End date</span>
                <button type="button" className={styles.dateTrigger} onClick={() => setUntilOpen(true)} aria-label="Repeat until">
                  <Icon name="calendar" size={15} color="var(--gold-700)" />
                  {until ? new Date(`${until}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Pick an end date'}
                </button>
              </label>
            ) : null}
          </div>

          {/* Hold row — company only */}
          {kind === 'company' ? (
            <div className={styles.formLine}>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <span>Hold</span>
                <div className={styles.holdRow}>
                  <Checkbox label="Hold this room" checked={holdOn} onChange={(e) => setHoldOn(e.target.checked)} />
                  {holdOn ? (
                    <>
                      <label className={styles.checkInline}>
                        <span className={styles.to}>until</span>
                        <select className={styles.select} value={holdUntil} onChange={(e) => setHoldUntil(e.target.value)} aria-label="Hold until">
                          {TIMES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Checkbox label="Release if no-show" checked={releasable} onChange={(e) => setReleasable(e.target.checked)} />
                    </>
                  ) : (
                    <span className={styles.muted}>Firm booking — held all day, never auto-released.</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.formActions}>
          <Button variant="primary" size="sm" onClick={add} disabled={busy}>
            Add
          </Button>
          {repeat === 'weekly' ? (
            <span className={styles.muted}>
              {indefinite
                ? 'One recurring booking on this weekday — repeats every week with no end date.'
                : 'Creates a weekly booking on this weekday up to the end date, skipping any clashes.'}
            </span>
          ) : null}
        </div>
        {msg ? <p className={styles.msg}>{msg}</p> : null}
      </div>

      <DatePickerModal
        open={formDateOpen}
        onClose={() => setFormDateOpen(false)}
        onPick={(d) => {
          setFormDate(d);
          setFormDateOpen(false);
        }}
        single
        allowWeekend
        planned={formDate ? [formDate] : []}
      />
      <DatePickerModal
        open={untilOpen}
        onClose={() => setUntilOpen(false)}
        onPick={(d) => {
          setUntil(d);
          setUntilOpen(false);
        }}
        single
        allowWeekend
        planned={until ? [until] : []}
      />

      {cancelChoice ? (
        <div className={styles.profOverlay} role="dialog" aria-modal="true" onClick={() => !busy && setCancelChoice(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Cancel recurring block</h3>
            <p className={styles.confirmText}>
              {cancelChoice.room} on{' '}
              {new Date(`${cancelChoice.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}. Cancel just this
              week, or the whole repeating series?
            </p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" size="sm" onClick={() => runCancel('occurrence')} disabled={busy}>
                This week only
              </Button>
              <Button variant="primary" size="sm" onClick={() => runCancel('series')} disabled={busy}>
                Whole series
              </Button>
            </div>
            <button type="button" className={styles.smallBtn} onClick={() => setCancelChoice(null)} disabled={busy} style={{ marginTop: 4 }}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Today (admin home)
/** Pending weekend-access requests — approve/decline (emails the member). Hidden when none. */
function WeekendRequestsPanel() {
  const [reqs, setReqs] = useState<WeekendRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await adminGetWeekendRequests();
    if (r.ok) setReqs(r.data.requests);
  }, []);
  useEffect(() => {
    load();
    // Without a poll this panel only ever showed what was pending when the tab opened, so
    // a request arriving mid-morning sat unseen until someone reloaded. A minute is often
    // enough for a member waiting on a weekend answer, and it's one small read.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  // Chime only when the count rises — see useAlertChime for why not on first load.
  useAlertChime(reqs.length);
  async function act(id: string, approve: boolean) {
    setBusy(true);
    await (approve ? adminApproveWeekend(id) : adminDeclineWeekend(id));
    setBusy(false);
    await load();
  }
  if (!reqs.length) return null;
  const fmt = (iso: string) => {
    try {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    } catch {
      return iso;
    }
  };
  return (
    <div className={styles.panel} style={{ borderColor: 'var(--gold-300)', background: 'var(--gold-100)' }}>
      <span className={styles.panelTitle}>Weekend access requests · {reqs.length}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reqs.map((q) => (
          <div key={q.id} className={styles.formRow} style={{ alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{q.name || q.email}</span>
            <span className={styles.muted}>
              {fmt(q.date)}
              {q.length === 'Half' ? (q.period ? ` · ½ ${q.period.toUpperCase()}` : ' · ½') : ''}
            </span>
            <button type="button" className={styles.smallBtn} onClick={() => act(q.id, true)} disabled={busy}>
              Approve
            </button>
            <button type="button" className={styles.smallBtn} onClick={() => act(q.id, false)} disabled={busy}>
              Decline
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Day schedule: an 08:00–18:00 timeline of every bookable room, grouped into meeting rooms /
// phone pods / privatisable team rooms, with each booking drawn as a band in its slot.
const DAY_START_MIN = 480; // 08:00
const DAY_END_MIN = 1080; // 18:00
const DAY_SPAN_MIN = DAY_END_MIN - DAY_START_MIN;
function DaySchedule({ spaces, bookings }: { spaces: AdminSpace[]; bookings: AdminBooking[] }) {
  const pods = spaces.filter((s) => s.bookable && s.type === 'Phone pod');
  const team = spaces.filter((s) => s.bookable && s.type === 'Workspace'); // Hop Yard / Vineyard
  const rooms = spaces.filter((s) => s.bookable && s.type !== 'Phone pod' && s.type !== 'Workspace');
  const groups = [
    { label: 'Meeting rooms', list: rooms },
    { label: 'Phone pods', list: pods },
    { label: 'Privatisable rooms', list: team },
  ].filter((g) => g.list.length);
  if (!groups.length) return null;

  const segClass = (b: AdminBooking) =>
    b.allDay ? styles.segPriv : b.kind === 'Block' ? styles.segBlock : b.company ? styles.segCompany : b.kind === 'External' ? styles.segExt : styles.segMember;
  const segLabel = (b: AdminBooking) =>
    b.allDay ? 'Privatised' : b.kind === 'Block' ? 'Blocked' : b.company || b.name || b.kind;

  return (
    <div className={styles.panel} style={{ marginTop: 18 }}>
      <span className={styles.panelTitle}>Day schedule</span>
      <div className={styles.schedScroll}>
        <div className={styles.schedInner}>
          <div className={styles.schedScaleRow}>
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
              <span key={h} className={styles.schedTick} style={{ left: `${((h * 60 - DAY_START_MIN) / DAY_SPAN_MIN) * 100}%` }}>
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
          {groups.map((g) => (
            <div key={g.label} className={styles.schedGroup}>
              <div className={styles.schedGroupLabel}>{g.label}</div>
              {g.list.map((s) => {
                const bs = bookings.filter((x) => x.space === s.id);
                return (
                  <div key={s.id} className={styles.schedLane}>
                    <div className={styles.schedRoom}>{s.name}</div>
                    <div className={styles.schedTrack}>
                      {bs.length === 0 ? (
                        <span className={styles.schedFree}>Free all day</span>
                      ) : (
                        bs.map((b, i) => {
                          const start = b.allDay ? DAY_START_MIN : Math.max(DAY_START_MIN, b.startMin);
                          const end = b.allDay ? DAY_END_MIN : Math.min(DAY_END_MIN, b.endMin);
                          const left = ((start - DAY_START_MIN) / DAY_SPAN_MIN) * 100;
                          const width = Math.min(Math.max(3, ((end - start) / DAY_SPAN_MIN) * 100), 100 - left);
                          return (
                            <span
                              key={i}
                              className={`${styles.schedSeg} ${segClass(b)}`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                              title={`${segLabel(b)} · ${b.allDay ? 'all day' : `${minToHHMM(b.startMin)}–${minToHHMM(b.endMin)}`}`}
                            >
                              {width > 14 ? segLabel(b) : ''}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Today-home card: the next upcoming event + its live RSVP headcount + a few names.
 *  (Replaces the old "rooms & pods booked" count, now that the Day schedule below covers rooms.) */
function NextEventCard() {
  const [ev, setEv] = useState<QuarterEvent | null>(null);
  const [rsvps, setRsvps] = useState<EventAttendee[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await getUpcomingEvents();
      const next = r.ok ? r.data.events[0] || null : null;
      if (!live) return;
      setEv(next);
      if (next) {
        const rr = await adminGetRsvps(next.id);
        if (live) setRsvps(rr.ok ? rr.data.rsvps : []);
      }
      if (live) setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, []);
  const going = (rsvps || []).filter((a) => a.status === 'Going');
  return (
    <div className={styles.todayCard}>
      <span className={styles.todayCardLabel}>Next event</span>
      {!loaded ? (
        <span className={styles.todayCardSub}>Loading…</span>
      ) : !ev ? (
        <span className={styles.todayCardSub}>Nothing scheduled — add one in Events.</span>
      ) : (
        <>
          <strong style={{ fontSize: 'var(--text-lg)', fontWeight: 700, lineHeight: 1.2, margin: '2px 0' }}>{ev.title}</strong>
          <span className={styles.todayCardSub}>
            {ev.start ? new Date(ev.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''} · {going.length} going
          </span>
          {going.length ? (
            <span className={styles.todayCardSub}>
              {going.slice(0, 6).map((a) => a.name || a.email).join(', ')}
              {going.length > 6 ? ` +${going.length - 6}` : ''}
            </span>
          ) : null}
          <button type="button" className={styles.allBdays} onClick={() => (window.location.hash = 'events')}>
            All events &amp; RSVPs ›
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Who's in across the working week — the glance the team asked for, so they can see the
 * shape of the week rather than only today. Five day-columns, each a list of the people in;
 * members, expected members, day guests and tours are colour-separated exactly as they are
 * in the day view, so a chip means the same thing in both. Read-only by design: managing a
 * check-in (undo, sign-out) stays in the focused day view; this is for seeing.
 */
function WeekWhosIn({
  week,
  loading,
  onPrev,
  onNext,
  onThisWeek,
}: {
  week: { monday: string; days: WeekDay[] } | null;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onThisWeek: () => void;
}) {
  const todayISO = toISO(new Date());
  const label = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return { dow: d.toLocaleDateString('en-GB', { weekday: 'short' }), day: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) };
  };
  const rangeLabel = week
    ? `${new Date(`${week.monday}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(`${addDaysISO(week.monday, 4)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : '';

  return (
    <div className={styles.week}>
      <div className={styles.weekNav}>
        <button type="button" className={styles.weekArrow} onClick={onPrev} aria-label="Previous week">
          <Icon name="arrow-left" size={16} />
        </button>
        <span className={styles.weekRange}>{rangeLabel}</span>
        <button type="button" className={styles.weekArrow} onClick={onNext} aria-label="Next week">
          <Icon name="arrow-right" size={16} />
        </button>
        <button type="button" className={styles.weekToday} onClick={onThisWeek}>
          This week
        </button>
      </div>

      {loading || !week ? (
        <p className={styles.state}>Loading…</p>
      ) : (
        <div className={styles.weekGrid}>
          {week.days.map((d) => {
            const total = d.checkins.length + d.tours.length;
            return (
              <div key={d.date} className={`${styles.weekCol} ${d.date === todayISO ? styles.weekColToday : ''}`}>
                <div className={styles.weekColHead}>
                  <span className={styles.weekColDow}>{label(d.date).dow}</span>
                  <span className={styles.weekColDay}>{label(d.date).day}</span>
                  <span className={styles.weekColCount}>{total || '—'}</span>
                </div>
                <div className={styles.weekColBody}>
                  {d.checkins.map((c, i) => (
                    <span
                      key={`${c.email}-${i}`}
                      className={`${styles.weekWho} ${c.dayPass ? styles.whoDayPass : ''} ${!c.dayPass && c.status !== 'Checked-in' ? styles.whoExpected : ''}`}
                      title={c.dayPass ? `Day Pass${c.company ? ` · ${c.company}` : ''}` : c.status === 'Checked-in' ? 'Here' : 'Expected'}
                    >
                      {c.name}
                      {c.length === 'Half' ? <em className={styles.weekHalf}>{c.period ? `½${c.period.toUpperCase()}` : '½'}</em> : null}
                    </span>
                  ))}
                  {d.tours.map((t) => (
                    <span key={t.id} className={`${styles.weekWho} ${styles.whoTour}`} title={`Tour · ${minToHHMM(t.startMin)}`}>
                      {t.name}
                      <em className={styles.weekTourTag}>Tour {minToHHMM(t.startMin)}</em>
                    </span>
                  ))}
                  {total === 0 ? <span className={styles.weekEmpty}>Nobody yet</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminTodayPane({ onAllBirthdays }: { onAllBirthdays: () => void }) {
  const [offset, setOffset] = useState(0); // 0 = today, 1 = next open day
  const [custom, setCustom] = useState<string>(''); // a hand-picked day (overrides offset)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [date, setDate] = useState('');
  const [checkins, setCheckins] = useState<AdminCheckin[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [roll, setRoll] = useState<{ membersIn: number; headcount: number; guests: RollGuest[] }>({ membersIn: 0, headcount: 0, guests: [] });
  const [loading, setLoading] = useState(true);
  // Day view is the daily-driver; week view is the "what does the week look like" glance the
  // team asked for. weekFrom is any date in the shown week — the server snaps it to Monday.
  const [view, setView] = useState<'day' | 'week'>('day');
  const [weekFrom, setWeekFrom] = useState(() => toISO(new Date()));
  const [week, setWeek] = useState<{ monday: string; days: WeekDay[] } | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);

  useEffect(() => {
    if (custom) {
      setDate(custom);
      return;
    }
    const d = new Date();
    if (offset === 1) {
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    }
    setDate(toISO(d));
  }, [offset, custom]);

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([adminGetSpaces(), adminGetMembers()]);
      if (s.ok) setSpaces(s.data.spaces);
      if (m.ok) setMembers(m.data.members);
    })();
  }, []);

  const loadRoll = useCallback(async () => {
    const r = await getRoll();
    if (r.ok) setRoll(r.data);
  }, []);
  useEffect(() => {
    loadRoll();
  }, [loadRoll]);
  async function signOut(id: string) {
    await signOutGuest(id);
    loadRoll();
  }
  async function clearVat(id: string) {
    await adminClearVat(id);
    setMembers((ms) => ms.filter((m) => m.id !== id));
  }

  const loadToday = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    const r = await adminGetToday(date);
    if (r.ok) {
      setCheckins(r.data.checkins);
      setBookings(r.data.bookings);
    }
    setLoading(false);
  }, [date]);
  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const loadWeek = useCallback(async () => {
    if (view !== 'week' || !weekFrom) return;
    setWeekLoading(true);
    const r = await adminGetWeek(weekFrom);
    if (r.ok) setWeek(r.data);
    setWeekLoading(false);
  }, [view, weekFrom]);
  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  async function undoCheckin(c: AdminCheckin) {
    if (!c.id) return;
    if (!window.confirm(`Undo check-in for ${c.name}? Any day it cost is refunded.`)) return;
    await adminRemoveCheckin(c.id);
    await loadToday();
  }

  // Tours are Kind='Tour' bookings rather than check-ins, so they never reached the who's-in
  // pane and a booked tour was easy to overlook entirely.
  const tours = bookings.filter((b) => b.kind === 'Tour').sort((a, b) => a.startMin - b.startMin);

  const dObj = date ? new Date(`${date}T12:00:00`) : new Date();
  const b = busyness(dObj);
  // The live headcount roll only means anything for the actual current day.
  const isLiveToday = !custom && offset === 0;
  const birthdaysThisWeek = members
    .filter((m) => m.bday)
    .map((m) => ({ m, s: bdayStatus(m) }))
    .filter((x) => (x.s.rank === 0 || x.s.rank === 1) && x.s.days <= 30)
    .sort((a, c) => a.s.rank - c.s.rank)
    .slice(0, 5);
  const dateLabel = dObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  // Second "day" button: literal Tomorrow on Mon–Thu, else the next open weekday.
  const todayDow = new Date().getDay();
  const nextDayLabel =
    todayDow === 5 || todayDow === 6 || todayDow === 0
      ? (() => {
          const n = new Date();
          n.setDate(n.getDate() + 1);
          while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1);
          return n.toLocaleDateString('en-GB', { weekday: 'long' });
        })()
      : 'Tomorrow';

  return (
    <div>
      <WeekendRequestsPanel />
      <div className={styles.todayHead}>
        <div>
          <h2 className={styles.todayDate}>{dateLabel}</h2>
          {b.closed ? (
            <span className={styles.todayBand}>Closed</span>
          ) : b.band ? (
            <span className={`${styles.todayBand} ${styles[`band_${b.band.id}`]}`}>Expected {b.band.label.toLowerCase()} · from past weeks</span>
          ) : null}
        </div>
        <div className={styles.seg}>
          <button
            type="button"
            className={`${styles.segBtn} ${view === 'day' && !custom && offset === 0 ? styles.segOn : ''}`}
            onClick={() => {
              // Must switch the view back too — in week mode this button did nothing, because
              // offset was already 0, so the highlight was stuck on Today with no way back.
              setView('day');
              setCustom('');
              setOffset(0);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className={`${styles.segBtn} ${view === 'day' && !custom && offset === 1 ? styles.segOn : ''}`}
            onClick={() => {
              setView('day');
              setCustom('');
              setOffset(1);
            }}
          >
            {nextDayLabel}
          </button>
          <button type="button" className={`${styles.segBtn} ${view === 'day' && custom ? styles.segOn : ''}`} onClick={() => { setView('day'); setPickerOpen(true); }}>
            {custom ? new Date(`${custom}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Pick a day'}
          </button>
          {/* The week glance the team asked for — who's in across Mon–Fri, not just today. */}
          <button type="button" className={`${styles.segBtn} ${view === 'week' ? styles.segOn : ''}`} onClick={() => setView('week')}>
            Week
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <WeekWhosIn
          week={week}
          loading={weekLoading}
          onPrev={() => setWeekFrom((f) => addDaysISO(f, -7))}
          onNext={() => setWeekFrom((f) => addDaysISO(f, 7))}
          onThisWeek={() => setWeekFrom(toISO(new Date()))}
        />
      ) : null}

      {view === 'day' && loading ? (
        <p className={styles.state}>Loading…</p>
      ) : view === 'day' ? (
        <div className={styles.todayGrid}>
          {/* Who's in usually holds a lot of people and guests are rare — so who's-in gets a
              half-width panel to breathe, with guests as a quieter section beneath a divider
              rather than an equal-sized card of its own. */}
          <div className={`${styles.todayCard} ${styles.todayCardWide}`}>
            <span className={styles.todayCardLabel}>Who&rsquo;s in</span>
            <strong className={styles.todayBig}>{checkins.length}</strong>
            <span className={styles.todayCardSub}>
              {checkins.filter((c) => !c.dayPass && c.status === 'Checked-in').length} here · {checkins.filter((c) => !c.dayPass && c.status !== 'Checked-in').length} expected
              {checkins.some((c) => c.dayPass) ? ` · ${checkins.filter((c) => c.dayPass).length} day pass` : ''}
              {isLiveToday && roll.guests.length ? ` · ${roll.guests.length} guest${roll.guests.length === 1 ? '' : 's'}` : ''}
            </span>
            {checkins.length || tours.length ? (
              <div className={styles.whoWrap}>
                {checkins.map((c, i) => (
                  <span
                    key={`${c.name}-${i}`}
                    className={`${styles.who} ${c.dayPass ? styles.whoDayPass : ''} ${c.length === 'Half' ? styles.whoHalf : ''} ${!c.dayPass && c.status !== 'Checked-in' ? styles.whoExpected : ''}`}
                    title={
                      c.dayPass
                        ? `Day Pass · Paid${c.company ? ` · ${c.company}` : ''}${c.email ? ` · ${c.email}` : ''}`
                        : `${c.status === 'Checked-in' ? 'Here now' : 'Expected'} · ${c.length === 'Half' ? `Half day${c.period ? ` (${c.period === 'am' ? 'morning' : 'afternoon'})` : ''}` : 'Full day'}`
                    }
                  >
                    <span className={styles.whoName}>{c.name}</span>
                    {c.dayPass ? (
                      <span className={styles.whoTag}>Day Pass · Paid</span>
                    ) : c.length === 'Half' ? (
                      <span className={styles.whoHalfTag}>{c.period ? `½ ${c.period.toUpperCase()}` : '½'}</span>
                    ) : null}
                    {c.id ? (
                      <button
                        type="button"
                        className={styles.whoUndo}
                        onClick={() => undoCheckin(c)}
                        aria-label={`Undo check-in for ${c.name}`}
                        title="Undo check-in"
                      >
                        ✕
                      </button>
                    ) : null}
                  </span>
                ))}
                {/* Tours are Kind='Tour' bookings, not check-ins, so they never appeared in
                    this pane — a booked tour was easy to miss entirely. Shown here with the
                    visitor's name and time, styled apart from members and day guests. */}
                {tours.map((t) => (
                  <span key={t.id} className={`${styles.who} ${styles.whoTour}`} title={`Tour · ${minToHHMM(t.startMin)}–${minToHHMM(t.endMin)}`}>
                    <span className={styles.whoName}>{t.name || 'Tour visitor'}</span>
                    <span className={styles.whoTourTag}>Tour · {minToHHMM(t.startMin)}</span>
                  </span>
                ))}
              </div>
            ) : null}

            {/* Guests, folded into the who's-in panel beneath a divider. */}
            {isLiveToday ? (
              <div className={styles.guestsSection}>
                <div className={styles.guestsHead}>
                  <span className={styles.todayCardLabel}>Guests today</span>
                  <span className={styles.guestsCount}>{roll.guests.length}</span>
                </div>
                {roll.guests.length ? (
                  <div className={styles.bdayList}>
                    {roll.guests.map((g) => (
                      <div key={g.id} className={styles.bdayItem}>
                        <Icon name="user" size={15} color="var(--gold-700)" />
                        <span>
                          {g.name}
                          {g.host ? ` → ${g.host}` : ''}
                        </span>
                        <button type="button" className={styles.smallBtn} style={{ marginLeft: 'auto' }} onClick={() => signOut(g.id)}>
                          Sign out
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.todayCardSub}>No guests signed in.</span>
                )}
              </div>
            ) : null}
          </div>
          <NextEventCard />
          <div className={styles.todayCard}>
            <span className={styles.todayCardLabel}>Birthdays in the next 30 days</span>
            {birthdaysThisWeek.length ? (
              <div className={styles.bdayList}>
                {birthdaysThisWeek.map(({ m, s }) => (
                  <div key={m.id} className={styles.bdayItem}>
                    <Icon name="cake" size={16} color="var(--gold-700)" />
                    <span>{m.name || m.email}</span>
                    <span className={styles.muted}>{s.label === 'This week' ? 'this week' : (s.when.split('·').pop() || '').trim()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className={styles.todayCardSub}>None this week.</span>
            )}
            <button type="button" className={styles.allBdays} onClick={onAllBirthdays}>
              All birthdays ›
            </button>
          </div>
        </div>
      ) : null}

      {view === 'day' && !closed ? <DaySchedule spaces={spaces} bookings={bookings} /> : null}

      {members.filter((m) => m.vatRequested).length ? (
        <div className={styles.panel} style={{ marginTop: 18, borderColor: 'var(--gold-400)' }}>
          <span className={styles.panelTitle}>VAT invoice requests</span>
          <p className={styles.muted}>Members asking for a VAT invoice — action it, then mark it done.</p>
          <div className={styles.list}>
            {members
              .filter((m) => m.vatRequested)
              .map((m) => (
                <div key={m.id} className={styles.payRow}>
                  <span className={styles.payName}>{m.name || m.email}</span>
                  <span className={styles.muted}>
                    Requested {m.vatRequested ? new Date(m.vatRequested).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                  <button type="button" className={styles.smallBtn} onClick={() => clearVat(m.id)}>
                    Done
                  </button>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <DatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(d) => {
          setCustom(d);
          setPickerOpen(false);
        }}
        single
        allowWeekend
        planned={custom ? [custom] : []}
      />
    </div>
  );
}

// ------------------------------------------------------- Screens, links & resources
function ScreensPane() {
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    adminGetSpaces().then((s) => {
      if (s.ok) setSpaces(s.data.spaces);
    });
  }, []);

  return (
    <div>
      {/* Wall displays — the always-on screens. Open on the device, then Full screen. */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Wall displays</span>
        <p className={styles.muted}>Always-on screens. Open on the device and tap Full screen.</p>
        <div className={styles.shortcuts}>
          <a className={styles.shortcut} href="/screen" target="_blank" rel="noreferrer">
            <Icon name="monitor" size={16} color="var(--gold-700)" /> Entrance screen
          </a>
          <a className={styles.shortcut} href="/screen?floor=1" target="_blank" rel="noreferrer">
            <Icon name="monitor" size={16} color="var(--gold-700)" /> First-floor screen
          </a>
          <a className={styles.shortcut} href="/screen?floor=2" target="_blank" rel="noreferrer">
            <Icon name="monitor" size={16} color="var(--gold-700)" /> Second-floor screen
          </a>
        </div>
      </div>

      {/* Check-in & sign-in — the shared iPads by the door and the per-room door kiosks. */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Check-in &amp; sign-in</span>
        <p className={styles.muted}>Shared iPads — no login. Reception is the one that checks anyone in.</p>
        <div className={styles.shortcuts}>
          <a className={styles.shortcut} href="/reception" target="_blank" rel="noreferrer">
            <Icon name="users" size={16} color="var(--gold-700)" /> Reception — check members &amp; guests in
          </a>
          <a className={styles.shortcut} href="/arrive" target="_blank" rel="noreferrer">
            <Icon name="check" size={16} color="var(--gold-700)" /> Arrival check-in (member phones)
          </a>
          <a className={styles.shortcut} href="/guest" target="_blank" rel="noreferrer">
            <Icon name="users" size={16} color="var(--gold-700)" /> Guest sign-in
          </a>
          {spaces
            .filter((s) => s.bookable)
            .map((s) => (
              <a key={s.id} className={styles.shortcut} href={`/kiosk?room=${s.id}`} target="_blank" rel="noreferrer">
                <Icon name="door-open" size={16} color="var(--gold-700)" /> {s.name} door
              </a>
            ))}
        </div>
      </div>

      {/* Sign-up & sharing — bringing new members on board. */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Sign-up &amp; sharing</span>
        <div className={styles.shortcuts}>
          <a className={styles.shortcut} href="/enrol" target="_blank" rel="noreferrer">
            <Icon name="user" size={16} color="var(--gold-700)" /> New member sign-up
          </a>
          <button
            type="button"
            className={styles.shortcut}
            onClick={() => {
              const url = `${window.location.origin}/enrol`;
              navigator.clipboard?.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
            title="Copy the sign-up link to send to a new member"
          >
            <Icon name={copied ? 'check' : 'share-2'} size={16} color="var(--gold-700)" /> {copied ? 'Link copied' : 'Copy sign-up link'}
          </button>
          <a className={styles.shortcut} href="/dashboard">
            <Icon name="user" size={16} color="var(--gold-700)" /> My member view
          </a>
        </div>
      </div>

      {/* Print & reference — signage to print, and the "what happens automatically" guides. */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Print &amp; reference</span>
        <div className={styles.shortcuts}>
          <a className={styles.shortcut} href="/signage" target="_blank" rel="noreferrer">
            <Icon name="book-open" size={16} color="var(--gold-700)" /> Printable signage set (A4 posters)
          </a>
          <a className={styles.shortcut} href="/admin/rules">
            <Icon name="badge-check" size={16} color="var(--gold-700)" /> What happens automatically
          </a>
          <a className={styles.shortcut} href="/admin-guide">
            <Icon name="book-open" size={16} color="var(--gold-700)" /> How it works (rewards &amp; partners)
          </a>
        </div>
      </div>

      <div className={styles.counterWrap}>
        <span className={styles.panelTitle}>Counter card (print &amp; keep at the till)</span>
        <div className={styles.counterCard} id="counter-card">
          <span className={styles.counterArc} aria-hidden="true" />
          <span className={styles.counterEyebrow}>The Quarter</span>
          <strong className={styles.counterTitle}>We love Quarter members</strong>
          <span className={styles.counterSub}>When a member shows their pass, scan it to verify and see how to honour their perk.</span>
          <div className={styles.counterQr}>
            <Qr value={`${SITE}/perks`} size={120} />
          </div>
          <span className={styles.counterFoot}>thequarter.work</span>
        </div>
        <button type="button" className={styles.smallBtn} onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className={styles.counterWrap}>
        <span className={styles.panelTitle}>Arrival QR (display at the entrance)</span>
        <div className={styles.counterCard} id="arrive-card">
          <span className={styles.counterArc} aria-hidden="true" />
          <span className={styles.counterEyebrow}>The Quarter</span>
          <strong className={styles.counterTitle}>Scan to check in</strong>
          <span className={styles.counterSub}>Point your phone camera here to check in for the day.</span>
          <div className={styles.counterQr}>
            <Qr value={`${SITE}/arrive`} size={120} />
          </div>
          <span className={styles.counterFoot}>thequarter.work/arrive</span>
        </div>
        <button type="button" className={styles.smallBtn} onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Content
const PERK_TYPES = ['Discount', 'On the house', 'Upgrade', 'Extra', 'Bundle', 'Priority', 'Welcome gift', 'Experience'];

function IconPicker({ value, onPick }: { value: string; onPick: (n: IconName) => void }) {
  return (
    <div className={styles.iconGrid}>
      {ICON_CHOICES.map((n) => (
        <button key={n} type="button" className={`${styles.iconCell} ${value === n ? styles.iconCellOn : ''}`} onClick={() => onPick(n)} aria-label={n}>
          <Icon name={n} size={20} color={value === n ? 'var(--gold-700)' : 'var(--text-muted)'} />
        </button>
      ))}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ContentPane() {
  const [sub, setSub] = useState<'perks' | 'rewards'>('perks');
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [perks, setPerks] = useState<PerkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [valueGbp, setValueGbp] = useState(''); // £ value helper → suggested points

  const refresh = useCallback(async () => {
    const [r, p] = await Promise.all([adminGetRewards(), adminGetPerksAll()]);
    if (r.ok) setRewards(r.data.rewards);
    if (p.ok) setPerks(p.data.perks);
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = (k: string, v: any) => setEditing((e: any) => ({ ...e, [k]: v }));
  const blankItem = (kind: 'perks' | 'rewards') =>
    kind === 'rewards'
      ? { kind: 'rewards', partner: '', title: '', cost: 300, funding: 'inventory', category: '', icon: 'gift', pos: '', hero: false, image: '', status: 'draft' }
      : { kind: 'perks', partner: '', offer: '', category: '', type: 'Discount', days: 'Always on', pos: '', authorisedBy: 'The Quarter', ref: '', contact: '', icon: 'gift', image: '', status: 'draft' };
  function newItem(kind: 'perks' | 'rewards' = sub) {
    // Seed the £-value helper from the reward's default cost (300 pts → £3.00); blank for perks.
    setValueGbp(kind === 'rewards' ? String(300 / POINTS_PER_POUND_VALUE) : '');
    setEditing(blankItem(kind));
  }
  // Switching the sub-tab switches the OPEN form to that kind too, so the Perks/Rewards pills
  // act as form switchers. (Previously a pill changed the list + "Add" label but left an open
  // form on the other kind — so you could sit on "Perks" yet still see the Rewards form.)
  function chooseSub(next: 'perks' | 'rewards') {
    setSub(next);
    setMsg(null);
    if (editing) newItem(next);
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    setMsg(null);
    const r = editing.kind === 'rewards' ? await adminSaveReward(editing) : await adminSavePerk(editing);
    setBusy(false);
    if (r.ok) {
      setEditing(null);
      await refresh();
      setMsg('Saved');
    } else setMsg(r.data?.error || 'Save failed');
  }
  async function remove(id: string, kind: 'rewards' | 'perks') {
    setBusy(true);
    if (kind === 'rewards') await adminDeleteReward(id);
    else await adminDeletePerk(id);
    await refresh();
    setBusy(false);
  }
  async function togglePublish(it: any, kind: 'rewards' | 'perks') {
    const next = { ...it, status: it.status === 'live' ? 'draft' : 'live' };
    if (kind === 'rewards') await adminSaveReward(next);
    else await adminSavePerk(next);
    await refresh();
  }

  if (loading) return <p className={styles.state}>Loading content…</p>;
  const isReward = editing?.kind === 'rewards';
  // £-value → points recommender (100 pts = £1, the POINTS_PER_POUND_VALUE anchor).
  // Give-back = fixed % of spend (POINTS_PER_GBP/pt), so it's a property of the economy,
  // not the reward: base ≈ 1%, Ambassadors earn it × the top level boost (×1.5) ≈ 1.5%.
  const costPts = Math.max(0, Number(editing?.cost) || 0);
  const rewardGbp = costPts / POINTS_PER_POUND_VALUE;
  const topBoost = LEVELS[LEVELS.length - 1].boost;
  const baseGiveBack = (POINTS_PER_GBP / POINTS_PER_POUND_VALUE) * 100;
  const ambGiveBack = baseGiveBack * topBoost;
  const fmtPct = (n: number) => String(Math.round(n * 100) / 100);
  // Reference points implied by the £ value the admin typed. A cost BELOW this gives the
  // member MORE than the reward is worth → amber warning. Equal/above is fine.
  const valueRefPts = valueGbp === '' ? null : Math.round((Number(valueGbp) || 0) * 100);
  const underValue = valueRefPts != null && costPts < valueRefPts;

  return (
    <div>
      <div className={styles.subTabs}>
        <button type="button" className={`${styles.subTab} ${sub === 'perks' ? styles.subTabOn : ''}`} onClick={() => chooseSub('perks')}>
          Perks
        </button>
        <button type="button" className={`${styles.subTab} ${sub === 'rewards' ? styles.subTabOn : ''}`} onClick={() => chooseSub('rewards')}>
          Rewards
        </button>
        <button type="button" className={styles.smallBtn} onClick={() => newItem()} style={{ marginLeft: 'auto' }}>
          + Add {sub === 'rewards' ? 'reward' : 'perk'}
        </button>
      </div>

      {editing ? (
        <div className={styles.editGrid}>
          <div className={styles.editForm}>
            <input className={styles.label} placeholder="Partner" value={editing.partner} onChange={(e) => set('partner', e.target.value)} />
            {isReward ? (
              <input className={styles.label} placeholder="Title (the reward)" value={editing.title} onChange={(e) => set('title', e.target.value)} />
            ) : (
              <input className={styles.label} placeholder="Offer (e.g. 20% off brunch)" value={editing.offer} onChange={(e) => set('offer', e.target.value)} />
            )}
            <select className={styles.select} value={editing.category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
              <option value="">Category…</option>
              {CONTENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {isReward ? (
              <>
                <div className={styles.formRow}>
                  <input className={styles.dayInput} type="number" placeholder="Cost (pts)" value={editing.cost} onChange={(e) => set('cost', Number(e.target.value))} />
                  <select className={styles.select} value={editing.funding} onChange={(e) => set('funding', e.target.value)} aria-label="Funding">
                    <option value="inventory">Quarter inventory</option>
                    <option value="partner">Partner-funded</option>
                    <option value="quarter">Quarter-funded</option>
                  </select>
                  <Checkbox label="Hero" checked={!!editing.hero} onChange={(e) => set('hero', e.target.checked)} />
                </div>
                {/* £-value → points recommender. Enter the real £ value; the points cost
                    is set to value × 100 (100 pts = £1). The cost field above stays editable. */}
                <div className={styles.pickerLabel}>Reward value (£)</div>
                <div className={styles.calcRow}>
                  <label className={styles.calcGbp}>
                    £
                    <input
                      className={styles.calcInput}
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="value"
                      value={valueGbp}
                      onChange={(e) => {
                        const v = e.target.value;
                        setValueGbp(v);
                        if (v !== '') set('cost', Math.round((Number(v) || 0) * 100));
                      }}
                      aria-label="Reward value in pounds"
                    />
                  </label>
                  <span className={styles.calcNote}>
                    {costPts.toLocaleString('en-GB')} pts = £{rewardGbp.toFixed(2)} · ~{fmtPct(baseGiveBack)}% give-back (≈{fmtPct(ambGiveBack)}% for Ambassadors)
                  </span>
                </div>
                {underValue ? (
                  <p className={styles.calcWarn}>This gives away more than the reward’s value — check this is intended.</p>
                ) : null}
              </>
            ) : (
              <div className={styles.formRow}>
                <select className={styles.select} value={editing.type} onChange={(e) => set('type', e.target.value)} aria-label="Perk type">
                  {PERK_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className={styles.label} placeholder="Days (e.g. Mon–Fri / Always on)" value={editing.days} onChange={(e) => set('days', e.target.value)} />
              </div>
            )}
            <textarea className={styles.textarea} placeholder="How staff apply it (POS instruction)" value={editing.pos} onChange={(e) => set('pos', e.target.value)} />
            {!isReward ? (
              <div className={styles.formRow}>
                <input className={styles.label} placeholder="Authorised by" value={editing.authorisedBy} onChange={(e) => set('authorisedBy', e.target.value)} />
                <input className={styles.dayInput} placeholder="Ref" value={editing.ref} onChange={(e) => set('ref', e.target.value)} />
                <input className={styles.label} placeholder="Contact" value={editing.contact} onChange={(e) => set('contact', e.target.value)} />
              </div>
            ) : null}
            <input className={styles.label} placeholder="Image URL (optional)" value={editing.image} onChange={(e) => set('image', e.target.value)} />
            <div className={styles.pickerLabel}>Icon</div>
            <IconPicker value={editing.icon} onPick={(n) => set('icon', n)} />
            <div className={styles.formRow}>
              <Checkbox label="Live" checked={editing.status === 'live'} onChange={(e) => set('status', e.target.checked ? 'live' : 'draft')} />
              <Button variant="primary" size="sm" onClick={save} disabled={busy}>
                Save
              </Button>
              <button type="button" className={styles.smallBtn} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>

          <div className={styles.previewWrap}>
            <span className={styles.pickerLabel}>Preview</span>
            <div className={styles.previewCard}>
              {editing.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className={styles.previewImg} src={editing.image} alt="" />
              ) : null}
              <span className={styles.previewChip}>
                <Icon name={editing.icon as IconName} size={22} color="var(--gold-700)" />
              </span>
              <span className={styles.previewPartner}>{editing.partner || 'Partner'}</span>
              <strong className={styles.previewTitle}>{isReward ? editing.title || 'Reward title' : editing.offer || 'The offer'}</strong>
              <span className={styles.previewMeta}>{isReward ? `${editing.cost || 0} pts` : editing.type}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.list}>
        {(sub === 'rewards' ? rewards : perks).length === 0 ? (
          <p className={styles.muted} style={{ padding: '18px 4px' }}>
            No {sub === 'rewards' ? 'rewards' : 'perks'} yet — add your first with “+ Add {sub === 'rewards' ? 'reward' : 'perk'}” above. They’ll appear on the public Rewards page once set to Live.
          </p>
        ) : null}
        {(sub === 'rewards' ? rewards : perks).map((it: any) => (
          <div key={it.id} className={styles.bRow}>
            <span className={styles.listChip}>
              <Icon name={(it.icon || 'gift') as IconName} size={18} color="var(--gold-700)" />
            </span>
            <span className={styles.bSpace}>{sub === 'rewards' ? it.title : it.offer}</span>
            <span className={`${styles.statusTag} ${it.status === 'live' ? styles.statusLive : ''}`}>{it.status === 'live' ? 'Live' : 'Draft'}</span>
            <span className={styles.bWho}>
              {it.partner} · {it.category}
              {sub === 'rewards' ? ` · ${it.cost} pts` : ` · ${it.type}`}
            </span>
            <button type="button" className={styles.smallBtn} onClick={() => togglePublish(it, sub)}>
              {it.status === 'live' ? 'Unpublish' : 'Publish'}
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => {
                // Seed the £-value helper from the existing points cost (cost / 100).
                setValueGbp(sub === 'rewards' ? String((Number(it.cost) || 0) / POINTS_PER_POUND_VALUE) : '');
                setEditing({ ...it, kind: sub });
              }}
            >
              Edit
            </button>
            <button type="button" className={styles.smallBtn} onClick={() => remove(it.id, sub)} disabled={busy}>
              Remove
            </button>
          </div>
        ))}
      </div>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Partners & float
const EMPTY_PARTNER = {
  partner: '',
  reward: '',
  fundingNote: '',
  floatTotal: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  payeeName: '',
  sortCode: '',
  accountNumber: '',
};

/** In-app partner enrolment: creates a prepaid float and captures contact + payee bank
 *  details. Bank details go only to the private Airtable via the server — never rendered
 *  back or logged. Reloads the float list on success. */
function AddPartnerPanel({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY_PARTNER });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY_PARTNER, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.partner.trim()) {
      setMsg('Add a partner name.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await adminCreatePartner({
      partner: f.partner.trim(),
      reward: f.reward.trim(),
      fundingNote: f.fundingNote.trim(),
      floatTotal: Number(f.floatTotal) || 0,
      contactName: f.contactName.trim(),
      contactEmail: f.contactEmail.trim(),
      phone: f.phone.trim(),
      payeeName: f.payeeName.trim(),
      sortCode: f.sortCode.trim(),
      accountNumber: f.accountNumber.trim(),
    });
    setBusy(false);
    if (r.ok) {
      setF({ ...EMPTY_PARTNER });
      setOpen(false);
      onAdded();
    } else setMsg(r.data?.error || 'Could not add partner.');
  }

  if (!open) {
    return (
      <button type="button" className={styles.smallBtn} onClick={() => setOpen(true)}>
        + Add partner
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <span className={styles.panelTitle}>Add a partner (creates a prepaid float)</span>
      <div className={styles.formRow}>
        <input className={styles.label} placeholder="Partner name" value={f.partner} onChange={(e) => set('partner', e.target.value)} />
        <input className={styles.label} placeholder="Reward it funds (e.g. A treat on us)" value={f.reward} onChange={(e) => set('reward', e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <input className={styles.label} placeholder="Funding note (optional)" value={f.fundingNote} onChange={(e) => set('fundingNote', e.target.value)} />
        <label className={styles.calcGbp} title="Initial float total — the balance starts here">
          £
          <input
            className={styles.calcInput}
            type="number"
            min="0"
            step="1"
            placeholder="float total"
            value={f.floatTotal}
            onChange={(e) => set('floatTotal', e.target.value)}
            aria-label="Initial float total in pounds"
          />
        </label>
      </div>
      <div className={styles.pickerLabel}>Contact &amp; payment — private, stored securely</div>
      <div className={styles.formRow}>
        <input className={styles.label} placeholder="Contact name" value={f.contactName} onChange={(e) => set('contactName', e.target.value)} />
        <input className={styles.label} type="email" placeholder="Contact email" value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
        <input className={styles.label} placeholder="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <div className={styles.formRow}>
        <input className={styles.label} placeholder="Payee name" value={f.payeeName} onChange={(e) => set('payeeName', e.target.value)} />
        <input className={styles.dayInput} placeholder="Sort code" value={f.sortCode} onChange={(e) => set('sortCode', e.target.value)} aria-label="Sort code" />
        <input className={styles.dayInput} placeholder="Account number" value={f.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} aria-label="Account number" />
      </div>
      <div className={styles.formRow}>
        <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
          Add partner
        </Button>
        <button type="button" className={styles.smallBtn} onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <span className={styles.muted}>Bank details are stored privately in Airtable and never shown to members.</span>
      </div>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}

/** A payout row with an on-demand itemised statement (each redemption: date, reward, member, £, owed|paid). */
function PayoutRow({ p, month, busy, onMarkPaid }: { p: PayoutPartner; month: string; busy: boolean; onMarkPaid: () => void }) {
  const [open, setOpen] = useState(false);
  const [stmt, setStmt] = useState<PartnerStatement | null>(null);
  const [loadingS, setLoadingS] = useState(false);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && stmt === null) {
      setLoadingS(true);
      const r = await adminPartnerStatement(p.partner, month || undefined);
      setStmt(r.ok ? r.data : null);
      setLoadingS(false);
    }
  }
  return (
    <div className={styles.payRow} style={{ flexWrap: 'wrap' }}>
      <span className={styles.payName}>{p.partner}</span>
      <span className={styles.payOwed}>£{p.owed.toFixed(2)}</span>
      <span className={styles.muted}>
        {p.owedCount} redemption{p.owedCount === 1 ? '' : 's'}
        {p.paid > 0 ? ` · £${p.paid.toFixed(2)} settled` : ''}
      </span>
      <button type="button" className={styles.smallBtn} onClick={toggle}>
        {open ? 'Hide' : 'Itemise'}
      </button>
      <button type="button" className={styles.smallBtn} disabled={busy || p.owed <= 0} onClick={onMarkPaid}>
        Mark as paid
      </button>
      {open ? (
        <div style={{ flexBasis: '100%', marginTop: 8, overflowX: 'auto' }}>
          {loadingS ? (
            <p className={styles.muted}>Loading…</p>
          ) : !stmt || stmt.items.length === 0 ? (
            <p className={styles.muted}>No redemptions in this period.</p>
          ) : (
            <table style={{ width: '100%', minWidth: 380, fontSize: 'var(--text-sm)', borderCollapse: 'collapse' }}>
              <tbody>
                {stmt.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 8px 3px 0', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {it.at ? new Date(it.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                    </td>
                    <td style={{ padding: '3px 8px' }}>{it.reward}</td>
                    <td style={{ padding: '3px 8px', color: 'var(--text-muted)' }}>{it.email}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>£{it.gbp.toFixed(2)}</td>
                    <td style={{ padding: '3px 0 3px 10px', textAlign: 'right', color: it.status === 'paid' ? '#2f7d52' : 'var(--gold-700)' }}>
                      {it.status === 'paid' ? '✓ paid' : 'owed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PartnersPane() {
  const [floats, setFloats] = useState<AdminFloat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payouts, setPayouts] = useState<PayoutPartner[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await adminGetFloats();
    if (r.ok) setFloats(r.data.floats);
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadPayouts = useCallback(async () => {
    const r = await adminGetPayouts(month || undefined);
    if (r.ok) setPayouts(r.data.partners);
  }, [month]);
  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  async function markPaid(partner: string) {
    if (!window.confirm(`Mark ${partner} as paid for ${month}? This clears their owed balance for the month.`)) return;
    setBusy(true);
    setPayMsg(null);
    const r = await adminMarkPaid(partner, month || undefined);
    setBusy(false);
    if (r.ok) {
      setPayMsg(`${partner} marked paid — ${r.data.settled} redemption${r.data.settled === 1 ? '' : 's'} settled.`);
      await loadPayouts();
    } else setPayMsg('Could not mark paid.');
  }

  function exportPayouts() {
    const rows: (string | number)[][] = [
      ['The Quarter — partner payouts', month],
      [],
      ['Partner', 'Owed (£)', 'Redemptions', 'Already settled (£)', 'Last redemption'],
      ...payouts.map((p) => [p.partner, p.owed.toFixed(2), p.owedCount, p.paid.toFixed(2), p.lastAt ? p.lastAt.slice(0, 10) : '']),
    ];
    downloadCSV(`quarter-payouts-${month}.csv`, rows);
  }

  async function topUp(id: string) {
    const amount = Number(window.prompt('Top up by how much (£)?', '50'));
    if (!amount || amount <= 0) return;
    setBusy(true);
    await adminTopUpFloat(id, amount);
    await refresh();
    setBusy(false);
  }

  function exportReconciliation() {
    const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const rows: (string | number)[][] = [
      ['The Quarter — partner reconciliation', monthLabel],
      [],
      ['Partner', 'Reward', 'Float total (£)', 'Remaining (£)', 'Drawn (£)', 'Uses this month', 'Status', 'Last used'],
      ...floats.map((f) => [
        f.partner,
        f.reward,
        f.floatTotal.toFixed(2),
        f.balance.toFixed(2),
        Math.max(0, f.floatTotal - f.balance).toFixed(2),
        f.usesThisMonth,
        f.status,
        f.lastUsed || '',
      ]),
    ];
    downloadCSV(`quarter-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  if (loading) return <p className={styles.state}>Loading floats…</p>;

  return (
    <div>
      <a href="/admin-guide" className={styles.guideCallout}>
        <Icon name="book-open" size={18} color="var(--gold-700)" />
        <span>
          <strong>New to partners &amp; floats?</strong> Read how it all works — enrolling a partner, how points map to pounds, and how payouts settle.
        </span>
        <span className={styles.guideCalloutGo} aria-hidden="true">→</span>
      </a>
      {/* Payouts — what we owe each partner for rewards we settle. Pick a month, pay
          from Starling, then mark it paid (the balance resets). */}
      <div className={styles.payouts}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <span className={styles.panelTitle}>Partner payouts</span>
            <p className={styles.muted}>What we owe each partner this month for rewards we fund. Pay from your bank, then mark it paid.</p>
          </div>
          <div className={styles.payTools}>
            <div className={styles.monthPick}>
              <button type="button" className={styles.monthArrow} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
                ‹
              </button>
              <span className={styles.monthLabel}>{fmtMonth(month)}</span>
              <button type="button" className={styles.monthArrow} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
                ›
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={exportPayouts} disabled={!payouts.length}>
              Export CSV
            </Button>
          </div>
        </div>
        {payouts.length ? (
          <div className={styles.payList}>
            {payouts.map((p) => (
              <PayoutRow key={p.partner} p={p} month={month} busy={busy} onMarkPaid={() => markPaid(p.partner)} />
            ))}
          </div>
        ) : (
          <p className={styles.muted}>Nothing owed for {month}.</p>
        )}
        {payMsg ? <p className={styles.msg}>{payMsg}</p> : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <span className={styles.panelTitle}>Partner floats</span>
          <p className={styles.muted}>Top up prepaid floats, and export the month&rsquo;s payout summary — one row per partner reward, with the amount drawn to settle.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportReconciliation} disabled={!floats.length}>
          Export reconciliation (CSV)
        </Button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <AddPartnerPanel onAdded={refresh} />
      </div>
      <div className={styles.floatGrid}>
        {floats.map((f) => {
          const pct = f.floatTotal > 0 ? Math.round((f.balance / f.floatTotal) * 100) : 0;
          return (
            <div key={f.id} className={styles.floatCard}>
              <span className={styles.floatPartner}>{f.partner}</span>
              <span className={styles.floatReward}>{f.reward}</span>
              <div className={styles.floatBalance}>
                £{f.balance.toFixed(2)} <span>of £{f.floatTotal.toFixed(2)}</span>
              </div>
              <div className={styles.floatBar}>
                <span style={{ width: `${pct}%` }} className={f.balance <= 0 ? styles.floatBarSpent : ''} />
              </div>
              <div className={styles.floatMeta}>
                <span className={`${styles.statusTag} ${f.status === 'Healthy' ? styles.statusLive : ''}`}>{f.status}</span>
                <span>
                  {f.usesThisMonth} this month{f.lastUsed ? ` · last ${f.lastUsed}` : ''}
                </span>
              </div>
              <button type="button" className={styles.smallBtn} onClick={() => topUp(f.id)} disabled={busy}>
                Top up
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------- Birthdays
function bdayStatus(m: AdminMember): { rank: number; label: string; when: string; days: number } {
  if (!m.bday || !/^\d{2}-\d{2}$/.test(m.bday)) return { rank: 9, label: '', when: '', days: 999 };
  const now = new Date();
  const year = now.getFullYear();
  const [mm, dd] = m.bday.split('-').map(Number);
  const bd = new Date(year, mm - 1, dd);
  const weekEnd = new Date(year, mm - 1, dd + 6);
  const today = new Date(year, now.getMonth(), now.getDate());
  const claimedThisYear = m.bdayClaimed ? new Date(m.bdayClaimed).getFullYear() === year : false;
  const whenStr = bd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  if (claimedThisYear) return { rank: 3, label: 'Claimed', when: `Claimed ${new Date(m.bdayClaimed as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, days: 999 };
  if (today >= bd && today <= weekEnd) return { rank: 0, label: 'This week', when: whenStr, days: 0 };
  if (today < bd) {
    const days = Math.ceil((bd.getTime() - today.getTime()) / 86400000);
    return { rank: 1, label: 'Upcoming', when: `${whenStr} · in ${days} day${days === 1 ? '' : 's'}`, days };
  }
  return { rank: 2, label: 'Passed', when: whenStr, days: 999 };
}

function BirthdaysPane() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await adminGetMembers();
    if (r.ok) setMembers(r.data.members);
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function claim(m: AdminMember, claimed: boolean) {
    setBusy(true);
    await adminClaimBirthday(m.id, claimed);
    await refresh();
    setBusy(false);
  }

  if (loading) return <p className={styles.state}>Loading birthdays…</p>;
  const withBday = members.filter((m) => m.bday).map((m) => ({ m, s: bdayStatus(m) })).sort((a, b) => a.s.rank - b.s.rank);

  if (withBday.length === 0) return <p className={styles.muted}>No birthdays on record yet — members add theirs at signup or on Rewards.</p>;

  return (
    <div className={styles.list}>
      {withBday.map(({ m, s }) => (
        <div key={m.id} className={styles.bRow}>
          <span className={styles.bSpace}>{m.name || m.email}</span>
          <span className={`${styles.statusTag} ${s.rank === 0 ? styles.statusLive : ''}`}>{s.label}</span>
          <span className={styles.bWho}>
            {m.plan || '—'} · {s.when}
          </span>
          {s.label === 'Claimed' ? (
            <button type="button" className={styles.smallBtn} onClick={() => claim(m, false)} disabled={busy}>
              Undo
            </button>
          ) : s.label === 'Upcoming' ? (
            <span className={styles.muted}>Not due yet</span>
          ) : (
            <button type="button" className={styles.smallBtn} onClick={() => claim(m, true)} disabled={busy}>
              {s.label === 'Passed' ? 'Mark claimed (late)' : 'Mark claimed'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}
function fmtEvent(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** One admin event row with an on-demand RSVP list (Going count + attendee names). */
function EventAdminRow({ e, onEdit, onDelete, busy }: { e: QuarterEvent; onEdit: () => void; onDelete: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendee[] | null>(null);
  const [loadingR, setLoadingR] = useState(false);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && attendees === null) {
      setLoadingR(true);
      const r = await adminGetRsvps(e.id);
      setAttendees(r.ok ? r.data.rsvps : []);
      setLoadingR(false);
    }
  }
  const going = (attendees || []).filter((a) => a.status === 'Going');
  return (
    <div className={styles.bRow} style={{ flexWrap: 'wrap' }}>
      <span className={styles.bSpace}>{e.title}</span>
      <span className={styles.bTime}>{e.start ? fmtEvent(e.start) : ''}</span>
      <span className={styles.bWho}>
        {e.location || ''}
        {e.published ? '' : ' · (draft)'}
      </span>
      <button type="button" className={styles.smallBtn} onClick={toggle}>
        {open ? 'Hide RSVPs' : 'RSVPs'}
      </button>
      <button type="button" className={styles.smallBtn} onClick={onEdit}>
        Edit
      </button>
      <button type="button" className={styles.smallBtn} onClick={onDelete} disabled={busy}>
        Delete
      </button>
      {open ? (
        <div style={{ flexBasis: '100%', marginTop: 8 }}>
          {loadingR ? (
            <p className={styles.muted}>Loading RSVPs…</p>
          ) : going.length === 0 ? (
            <p className={styles.muted}>No RSVPs yet.</p>
          ) : (
            <>
              <p className={styles.muted} style={{ marginBottom: 6 }}>
                Going: {going.length}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>
                {going.map((a, i) => (
                  <li key={i}>
                    {a.name || a.email}
                    {a.email && a.name ? ` · ${a.email}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EventsPane() {
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [location, setLocation] = useState('The Kentish Pantry');
  const [category, setCategory] = useState('Social & drinks');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);

  const refresh = useCallback(async () => {
    const r = await adminGetEvents();
    if (r.ok) setEvents(r.data.events);
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDate('');
    setStartTime('18:00');
    setEndTime('');
    setLocation('The Kentish Pantry');
    setCategory('Social & drinks');
    setDescription('');
    setPublished(true);
  }
  function edit(e: QuarterEvent) {
    setEditingId(e.id);
    setTitle(e.title);
    const s = e.start ? toLocalInput(e.start) : '';
    setDate(s ? s.split('T')[0] : '');
    setStartTime(s ? s.split('T')[1] : '18:00');
    setEndTime(e.end ? toLocalInput(e.end).split('T')[1] : '');
    setLocation(e.location || 'The Kentish Pantry');
    setCategory(e.category || 'Social & drinks');
    setDescription(e.description || '');
    setPublished(e.published !== false);
  }
  async function save() {
    if (!title || !date) {
      setMsg('Title and date are required.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const payload = {
      title,
      start: new Date(`${date}T${startTime}`).toISOString(),
      end: endTime ? new Date(`${date}T${endTime}`).toISOString() : undefined,
      location,
      category,
      description,
      published,
    };
    const r = editingId ? await adminUpdateEvent(editingId, payload) : await adminCreateEvent(payload);
    if (r.ok) {
      resetForm();
      await refresh();
      setMsg('Saved');
    } else {
      setMsg(r.data?.error || 'Save failed');
    }
    setBusy(false);
  }
  async function del(id: string) {
    setBusy(true);
    await adminDeleteEvent(id);
    await refresh();
    setBusy(false);
  }

  return (
    <div>
      <div className={styles.panel}>
        <span className={styles.panelTitle}>{editingId ? 'Edit event' : 'Add an event'}</span>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Title</span>
            <input className={styles.input} placeholder="e.g. Summer Friday social" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Description</span>
            <textarea
              className={styles.textarea}
              placeholder="What's it about? Line breaks are kept. Shows on the website, member events tab and entrance screen."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
          <label className={styles.field}>
            <span>Date</span>
            <button type="button" className={styles.input} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setPickerOpen(true)}>
              {date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Pick a date'}
            </button>
          </label>
          <label className={styles.field}>
            <span>Starts</span>
            <select className={styles.input} value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              {EVENT_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Ends (optional)</span>
            <select className={styles.input} value={endTime} onChange={(e) => setEndTime(e.target.value)}>
              <option value="">—</option>
              {EVENT_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Location</span>
            <select className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)}>
              {EVENT_LOCATIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Theme</span>
            <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {EVENT_THEMES.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          <div className={styles.field}>
            <span>Visibility</span>
            <Checkbox label="Published" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          </div>
        </div>
        <div className={styles.formActions}>
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>
            {editingId ? 'Update event' : 'Add event'}
          </Button>
          {editingId ? (
            <button type="button" className={styles.smallBtn} onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <DatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(d) => {
          setDate(d);
          setPickerOpen(false);
        }}
        single
        allowWeekend
        planned={date ? [date] : []}
      />

      {loading ? (
        <p className={styles.state}>Loading…</p>
      ) : events.length === 0 ? (
        <p className={styles.muted}>No events yet.</p>
      ) : (
        <div className={styles.list}>
          {events.map((e) => (
            <EventAdminRow key={e.id} e={e} onEdit={() => edit(e)} onDelete={() => del(e.id)} busy={busy} />
          ))}
        </div>
      )}
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
