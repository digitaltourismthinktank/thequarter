'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember } from './useMember';
import { WeekStrip } from './WeekStrip';
import { CompanyInput } from './CompanyInput';
import { Icon, type IconName } from '@/components/ds/Icon';
import { Qr } from '@/components/ds/Qr';
import { EVENT_THEMES } from '@/lib/eventThemes';
import { busyness } from '@/lib/busyness';
import { PLANS, PLAN_MEMBERSTACK_ID } from '@/lib/plans';
import {
  adminGetMembers,
  adminGetSpaces,
  adminGetCalendar,
  adminBlock,
  adminExternal,
  adminCompanyBooking,
  adminCancel,
  adminAdjustDays,
  adminCheckinMember,
  adminGetEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
  adminClaimBirthday,
  adminGetRewards,
  adminSaveReward,
  adminDeleteReward,
  adminGetPerksAll,
  adminSavePerk,
  adminDeletePerk,
  adminGetFloats,
  adminTopUpFloat,
  adminGetToday,
  getRoll,
  signOutGuest,
  adminGetMemberProfile,
  adminAdjustPoints,
  adminRedeemForMember,
  adminAssignPlan,
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
const EVENT_LOCATIONS = ['The Kentish Pantry', 'The Board Room', 'The Hop Yard', 'The Chapter House', 'The whole Quarter', 'Off-site'];
/** Content categories for rewards + perks — a picker to avoid typos. */
const CONTENT_CATEGORIES = ['Food & drink', 'Coffee & cake', 'Culture', 'Wellbeing', 'Getting here', 'Shopping', 'Services', 'Treats', 'Experiences'];

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
export function AdminClient() {
  const { loading, member } = useMember();
  const [tab, setTab] = useState<'today' | 'members' | 'rooms' | 'events' | 'content' | 'partners' | 'birthdays'>('today');

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
        <button type="button" className={`${styles.tab} ${tab === 'rooms' ? styles.tabOn : ''}`} onClick={() => setTab('rooms')}>
          Rooms &amp; bookings
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'events' ? styles.tabOn : ''}`} onClick={() => setTab('events')}>
          Events
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'content' ? styles.tabOn : ''}`} onClick={() => setTab('content')}>
          Content
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'partners' ? styles.tabOn : ''}`} onClick={() => setTab('partners')}>
          Partners &amp; float
        </button>
        <button type="button" className={`${styles.tab} ${tab === 'birthdays' ? styles.tabOn : ''}`} onClick={() => setTab('birthdays')}>
          Birthdays
        </button>
      </div>

      {tab === 'today' ? (
        <AdminTodayPane onAllBirthdays={() => setTab('birthdays')} />
      ) : tab === 'members' ? (
        <MembersPane />
      ) : tab === 'rooms' ? (
        <RoomsPane />
      ) : tab === 'events' ? (
        <EventsPane />
      ) : tab === 'content' ? (
        <ContentPane />
      ) : tab === 'partners' ? (
        <PartnersPane />
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState('All');
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
  async function checkIn(m: AdminMember) {
    setBusyId(m.id);
    setMsg(null);
    const r = await adminCheckinMember(m.id, 'Full');
    if (!r.ok) setMsg(r.data?.error || 'Check-in failed');
    await refresh();
    setBusyId(null);
  }

  if (loading) return <p className={styles.state}>Loading members…</p>;

  const FILTERS = ['All', 'Day Pass', 'Visitor', 'Resident', 'Citizen', 'Hybrid Office', 'Paused'];
  const companyCount = (c: string) => members.filter((x) => x.company === c).length;
  const filtered = members.filter((m) => {
    const matchesPlan = planFilter === 'All' ? true : planFilter === 'Paused' ? m.paused : m.plan === planFilter && !m.paused;
    if (!matchesPlan) return false;
    if (!q) return true;
    return `${m.name || ''} ${m.email || ''} ${m.company || ''}`.toLowerCase().includes(q.toLowerCase());
  });

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
                <td className={styles.muted}>{m.points.toLocaleString('en-GB')}</td>
                <td className={styles.muted}>{m.renewal || '—'}</td>
                <td>
                  <button type="button" className={styles.smallBtn} onClick={() => setProfileId(m.id)}>
                    Profile
                  </button>{' '}
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
      <MemberProfileModal
        id={profileId}
        bday={members.find((m) => m.id === profileId)?.bday ?? null}
        onClose={() => setProfileId(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function MemberProfileModal({ id, bday, onClose, onChanged }: { id: string | null; bday?: string | null; onClose: () => void; onChanged: () => void }) {
  const [p, setP] = useState<MemberProfile | null>(null);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [rewardId, setRewardId] = useState('');
  const [planSel, setPlanSel] = useState('');
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function assignPlan() {
    if (!planSel || !id) return;
    setBusy(true);
    setMsg(null);
    const r = await adminAssignPlan(id, planSel);
    setBusy(false);
    if (r.ok) {
      setPlanSel('');
      setMsg('Plan assigned');
      await load();
      onChanged();
    } else setMsg('Could not assign plan.');
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
              <span className={styles.profSectionTitle}>Assign / change plan</span>
              <div className={styles.formRow}>
                <select className={styles.select} value={planSel} onChange={(e) => setPlanSel(e.target.value)} aria-label="Plan">
                  <option value="">Choose a plan…</option>
                  {PLANS.filter((pl) => pl.id !== 'day-pass').map((pl) => (
                    <option key={pl.id} value={PLAN_MEMBERSTACK_ID[pl.id]}>
                      {pl.name}
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.smallBtn} onClick={assignPlan} disabled={busy || !planSel}>
                  Assign
                </button>
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
    </div>
  );
}

function RoomsPane() {
  const [date, setDate] = useState<string>(() => firstWeekday());
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'block' | 'external' | 'company'>('block');
  const [spaceId, setSpaceId] = useState<string>('');
  const [start, setStart] = useState<string>('09:00');
  const [end, setEnd] = useState<string>('17:00');
  const [label, setLabel] = useState<string>('');
  const [holdUntil, setHoldUntil] = useState<string>('11:00');
  const [releasable, setReleasable] = useState(true);
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
    let r;
    if (kind === 'company') {
      r = await adminCompanyBooking({ spaceId, date, start, end, company: label, holdUntil, releasable });
    } else {
      const payload = { spaceId, date, start, end, name: label };
      r = kind === 'block' ? await adminBlock(payload) : await adminExternal(payload);
    }
    if (r.ok) {
      setLabel('');
      await loadCalendar();
      setMsg('Added');
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
        <span className={styles.panelTitle}>Add a block, external or company booking</span>
        <div className={styles.formRow}>
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
          {kind === 'company' ? (
            <CompanyInput className={styles.label} value={label} onChange={setLabel} placeholder="Company name" />
          ) : (
            <input
              className={styles.label}
              placeholder={kind === 'block' ? 'Reason (optional)' : 'Who for'}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          )}
          {kind === 'company' ? (
            <>
              <label className={styles.field}>
                <span>Hold until</span>
                <select className={styles.select} value={holdUntil} onChange={(e) => setHoldUntil(e.target.value)} aria-label="Hold until">
                  {TIMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={releasable} onChange={(e) => setReleasable(e.target.checked)} /> Release if no-show
              </label>
            </>
          ) : null}
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
              <span className={`${styles.bKind} ${b.kind === 'Block' ? styles.kindBlock : ''}`}>{b.company ? 'Company' : b.kind}</span>
              <span className={styles.bWho}>{b.company || b.name || b.email || ''}</span>
              {b.company ? (
                <span className={styles.statusTag}>
                  {b.released ? 'Released' : b.checkedIn ? 'Checked in' : b.holdUntil ? `Held to ${b.holdUntil}` : 'Booked'}
                </span>
              ) : null}
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

// ---------------------------------------------------------------- Today (admin home)
function AdminTodayPane({ onAllBirthdays }: { onAllBirthdays: () => void }) {
  const [offset, setOffset] = useState(0); // 0 = today, 1 = tomorrow
  const [date, setDate] = useState('');
  const [checkins, setCheckins] = useState<AdminCheckin[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [roll, setRoll] = useState<{ membersIn: number; headcount: number; guests: RollGuest[] }>({ membersIn: 0, headcount: 0, guests: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = new Date();
    if (offset === 1) {
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    }
    setDate(toISO(d));
  }, [offset]);

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

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    (async () => {
      const r = await adminGetToday(date);
      if (r.ok) {
        setCheckins(r.data.checkins);
        setBookings(r.data.bookings);
      }
      setLoading(false);
    })();
  }, [date]);

  const dObj = date ? new Date(`${date}T12:00:00`) : new Date();
  const b = busyness(dObj);
  const spaceName = (id: string | null) => spaces.find((s) => s.id === id)?.name ?? 'Space';
  const roomBookings = bookings.filter((x) => x.kind !== 'Block');
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
      <div className={styles.todayHead}>
        <div>
          <h2 className={styles.todayDate}>{dateLabel}</h2>
          {b.closed ? (
            <span className={styles.todayBand}>Closed</span>
          ) : b.band ? (
            <span className={`${styles.todayBand} ${styles[`band_${b.band.id}`]}`}>Today feels {b.band.label.toLowerCase()}</span>
          ) : null}
        </div>
        <div className={styles.seg}>
          <button type="button" className={`${styles.segBtn} ${offset === 0 ? styles.segOn : ''}`} onClick={() => setOffset(0)}>
            Today
          </button>
          <button type="button" className={`${styles.segBtn} ${offset === 1 ? styles.segOn : ''}`} onClick={() => setOffset(1)}>
            {nextDayLabel}
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.state}>Loading…</p>
      ) : (
        <div className={styles.todayGrid}>
          <div className={styles.todayCard}>
            <span className={styles.todayCardLabel}>Who&rsquo;s in</span>
            <strong className={styles.todayBig}>{offset === 0 ? roll.headcount : checkins.length}</strong>
            <span className={styles.todayCardSub}>
              {offset === 0 ? `${roll.membersIn} member${roll.membersIn === 1 ? '' : 's'} · ${roll.guests.length} guest${roll.guests.length === 1 ? '' : 's'} on site` : 'Planned ahead — check-ins land on the day.'}
            </span>
            {checkins.length ? <span className={styles.todayCardSub}>{checkins.map((c) => c.name).join(', ')}</span> : null}
          </div>
          {offset === 0 ? (
            <div className={styles.todayCard}>
              <span className={styles.todayCardLabel}>Guests today</span>
              <strong className={styles.todayBig}>{roll.guests.length}</strong>
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
          <div className={styles.todayCard}>
            <span className={styles.todayCardLabel}>Rooms &amp; pods booked</span>
            <strong className={styles.todayBig}>{roomBookings.length}</strong>
            <span className={styles.todayCardSub}>
              {roomBookings.length
                ? roomBookings.map((x) => `${spaceName(x.space)} ${minToHHMM(x.startMin)}`).join(' · ')
                : 'Nothing booked.'}
            </span>
          </div>
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
      )}

      <div className={styles.panel} style={{ marginTop: 18 }}>
        <span className={styles.panelTitle}>Screens &amp; links</span>
        <div className={styles.shortcuts}>
          <a className={styles.shortcut} href="/screen" target="_blank" rel="noreferrer">
            <Icon name="monitor" size={16} color="var(--gold-700)" /> Entrance screen
          </a>
          <a className={styles.shortcut} href="/guest" target="_blank" rel="noreferrer">
            <Icon name="users" size={16} color="var(--gold-700)" /> Guest sign-in
          </a>
          <a className={styles.shortcut} href="/dashboard">
            <Icon name="user" size={16} color="var(--gold-700)" /> My member view
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
  function newItem() {
    setEditing(
      sub === 'rewards'
        ? { kind: 'rewards', partner: '', title: '', cost: 300, funding: 'inventory', category: '', icon: 'gift', pos: '', hero: false, image: '', status: 'draft' }
        : { kind: 'perks', partner: '', offer: '', category: '', type: 'Discount', days: 'Always on', pos: '', authorisedBy: 'The Quarter', ref: '', contact: '', icon: 'gift', image: '', status: 'draft' },
    );
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

  return (
    <div>
      <div className={styles.subTabs}>
        <button type="button" className={`${styles.subTab} ${sub === 'perks' ? styles.subTabOn : ''}`} onClick={() => setSub('perks')}>
          Perks
        </button>
        <button type="button" className={`${styles.subTab} ${sub === 'rewards' ? styles.subTabOn : ''}`} onClick={() => setSub('rewards')}>
          Rewards
        </button>
        <button type="button" className={styles.smallBtn} onClick={newItem} style={{ marginLeft: 'auto' }}>
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
              <div className={styles.formRow}>
                <input className={styles.dayInput} type="number" placeholder="Cost (pts)" value={editing.cost} onChange={(e) => set('cost', Number(e.target.value))} />
                <select className={styles.select} value={editing.funding} onChange={(e) => set('funding', e.target.value)} aria-label="Funding">
                  <option value="inventory">Quarter inventory</option>
                  <option value="partner">Partner-funded</option>
                  <option value="quarter">Quarter-funded</option>
                </select>
                <label className={styles.check}>
                  <input type="checkbox" checked={!!editing.hero} onChange={(e) => set('hero', e.target.checked)} /> Hero
                </label>
              </div>
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
              <label className={styles.check}>
                <input type="checkbox" checked={editing.status === 'live'} onChange={(e) => set('status', e.target.checked ? 'live' : 'draft')} /> Live
              </label>
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
            <button type="button" className={styles.smallBtn} onClick={() => setEditing({ ...it, kind: sub })}>
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
function PartnersPane() {
  const [floats, setFloats] = useState<AdminFloat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await adminGetFloats();
    if (r.ok) setFloats(r.data.floats);
    setLoading(false);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function topUp(id: string) {
    const amount = Number(window.prompt('Top up by how much (£)?', '50'));
    if (!amount || amount <= 0) return;
    setBusy(true);
    await adminTopUpFloat(id, amount);
    await refresh();
    setBusy(false);
  }

  if (loading) return <p className={styles.state}>Loading floats…</p>;

  return (
    <div>
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

function EventsPane() {
  const [events, setEvents] = useState<QuarterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('The Kentish Pantry');
  const [category, setCategory] = useState('Social & drinks');
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
    setStart('');
    setEnd('');
    setLocation('The Kentish Pantry');
    setCategory('Social & drinks');
    setPublished(true);
  }
  function edit(e: QuarterEvent) {
    setEditingId(e.id);
    setTitle(e.title);
    setStart(e.start ? toLocalInput(e.start) : '');
    setEnd(e.end ? toLocalInput(e.end) : '');
    setLocation(e.location || 'The Kentish Pantry');
    setCategory(e.category || 'Social & drinks');
    setPublished(e.published !== false);
  }
  async function save() {
    if (!title || !start) {
      setMsg('Title and start are required.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const payload = {
      title,
      start: new Date(start).toISOString(),
      end: end ? new Date(end).toISOString() : undefined,
      location,
      category,
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
          <label className={styles.field}>
            <span>Starts</span>
            <input type="datetime-local" className={styles.input} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Ends (optional)</span>
            <input type="datetime-local" className={styles.input} value={end} onChange={(e) => setEnd(e.target.value)} />
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
            <label className={styles.checkInline}>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
            </label>
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

      {loading ? (
        <p className={styles.state}>Loading…</p>
      ) : events.length === 0 ? (
        <p className={styles.muted}>No events yet.</p>
      ) : (
        <div className={styles.list}>
          {events.map((e) => (
            <div key={e.id} className={styles.bRow}>
              <span className={styles.bSpace}>{e.title}</span>
              <span className={styles.bTime}>{e.start ? fmtEvent(e.start) : ''}</span>
              <span className={styles.bWho}>
                {e.location || ''}
                {e.published ? '' : ' · (draft)'}
              </span>
              <button type="button" className={styles.smallBtn} onClick={() => edit(e)}>
                Edit
              </button>
              <button type="button" className={styles.smallBtn} onClick={() => del(e.id)} disabled={busy}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
