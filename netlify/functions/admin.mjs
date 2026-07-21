/**
 * The Quarter — Admin API. All actions require a verified member whose email is
 * on the admin domain (@thinkdigital.travel). See _member.mjs isAdmin().
 *
 * GET  ?action=members                         → all members (plan, days, renewal, paused)
 * GET  ?action=spaces                          → all spaces (incl. non-bookable)
 * GET  ?action=calendar&date=YYYY-MM-DD        → that day's bookings across all spaces
 * POST {action:'block',    spaceId,date,start,end,name,notes}  → block a space (reason in name)
 * POST {action:'external', spaceId,date,start,end,name,notes}  → booking for a non-member
 * POST {action:'cancelBooking', id}            → cancel any booking
 * POST {action:'adjustDays', memberId, days}   → set a member's day balance
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, isAdmin, tokenFromRequest } from './_member.mjs';
import { listRecords, listAllRecords, createRecord, updateRecord, deleteRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonWallClockToISO, isoToLondonMin, isoToLondonDate, hhmmToMin, londonNow, holdReleased, addDays } from './_time.mjs';
import { PLAN_NAMES, allowanceForMember, setMemberPlan, clearMemberPlan, renewMember, formatDate } from './_quarter-sync.mjs';
import { listRewards, listPerks, listFloats, floatStatus, awardPoints, redeemReward, partnerPayouts, markPartnerPaid, partnerStatement } from './_rewards.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL, fmtDateLong } from './_email.mjs';
import { pushToEmail } from './_push.mjs';
import { parsePrivatisationSlots, isPrivatisedOn, isRecurringBlockRule, recurringBlockOccurrences, parseSkipDates } from './_privatisation.mjs';

const PERK_TYPES = ['Discount', 'On the house', 'Upgrade', 'Extra', 'Bundle', 'Priority', 'Welcome gift', 'Experience'];
const FUNDINGS = ['inventory', 'partner', 'quarter'];

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const PAUSED = 'pln_paused-fns0m38';
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

/**
 * Find bookings and check-ins that shouldn't exist: made by an account with no plan, no
 * carnet, and no paid day pass for that date. This is the residue of the two entitlement
 * holes (room bookings and check-ins) that were open before they were gated — the gates
 * stop new ones, but anything created earlier is still sitting in the data.
 *
 * Scoped to today onward, because those are the ones worth clearing; a free day already
 * taken in the past can't be undone. Deliberately conservative: a member with a live carnet
 * is left alone (their check-in legitimately spends a pass), so this flags the clear-cut
 * "shouldn't be here at all" cases and keeps false positives near zero.
 */
async function accessAudit() {
  const today = londonNow().dateStr;
  const admin = memberstackAdmin.init(MS_SECRET);

  // email → { hasPlan, hasCarnet, name }
  const ent = new Map();
  let after;
  for (let i = 0; i < 20; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    for (const m of res?.data || []) {
      const email = String(m.auth?.email || m.email || '').toLowerCase();
      if (!email) continue;
      const cf = m.customFields || {};
      ent.set(email, {
        hasPlan: allowanceForMember(m) !== undefined,
        hasCarnet: Math.max(0, Number(m.metaData?.carnet?.remaining) || 0) > 0,
        name: [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || null,
      });
    }
    if (!res?.hasNextPage || !(res?.data || []).length) break;
    after = res?.endCursor;
  }

  const [checkinRows, bookingRows] = await Promise.all([
    listAllRecords(T.checkins, {
      filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(today)}', OR({Status}='Checked-in', {Status}='Planned', {Status}='Paid'))`,
    }),
    listAllRecords(T.bookings, {
      filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(today)}', {Status}='Confirmed', {Kind}='Member')`,
    }),
  ]);

  // Dates each email has actually paid a day pass for — those check-ins/bookings are fine.
  const paidFor = new Set();
  for (const r of checkinRows) {
    if (r.fields[F.checkins.status] === 'Paid') {
      paidFor.add(`${String(r.fields[F.checkins.email] || '').toLowerCase()}|${isoToLondonDate(r.fields[F.checkins.date])}`);
    }
  }

  const entitled = (email, date) => {
    const e = ent.get(email);
    if (e?.hasPlan || e?.hasCarnet) return true; // has a plan, or passes to spend
    return paidFor.has(`${email}|${date}`);
  };

  const flags = [];
  for (const r of checkinRows) {
    if (r.fields[F.checkins.status] === 'Paid') continue; // a paid day pass is legitimate
    const email = String(r.fields[F.checkins.email] || '').toLowerCase();
    const date = isoToLondonDate(r.fields[F.checkins.date]);
    if (!email || entitled(email, date)) continue;
    flags.push({ type: 'checkin', id: r.id, email, name: ent.get(email)?.name || r.fields[F.checkins.name] || email, date, detail: r.fields[F.checkins.status] });
  }
  for (const r of bookingRows) {
    const email = String(r.fields[F.bookings.email] || '').toLowerCase();
    const date = isoToLondonDate(r.fields[F.bookings.date]);
    if (!email || entitled(email, date)) continue;
    flags.push({ type: 'booking', id: r.id, email, name: ent.get(email)?.name || r.fields[F.bookings.name] || email, date, detail: r.fields[F.bookings.title] || 'Room/pod' });
  }
  flags.sort((a, b) => a.date.localeCompare(b.date) || a.email.localeCompare(b.email));
  return { flags, scanned: { members: ent.size, checkins: checkinRows.length, bookings: bookingRows.length } };
}

async function listAllMembers() {
  const admin = memberstackAdmin.init(MS_SECRET);
  const out = [];
  let after;
  for (let i = 0; i < 20; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const data = res?.data || [];
    for (const m of data) {
      const cf = m.customFields || {};
      const md = m.metaData || {};
      const managedPlanId = (m.planConnections || []).map(planIdOf).filter((p) => p in PLAN_NAMES)[0] || null;
      const planId = (m.planConnections || []).map(planIdOf).filter(Boolean)[0] || null;
      out.push({
        id: m.id,
        email: m.auth?.email || m.email || null,
        name: [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || null,
        plan: planId ? PLAN_NAMES[planId] || planId : null,
        days: cf['days-remaining'] ?? null,
        renewal: cf['renewal-date'] ?? null,
        allowanceOverride: cf['allowance-override'] || null,
        allowance: allowanceForMember(m), // effective allowance (override-aware); null = unlimited
        doorCode: cf['door-code'] ?? null,
        paused: planId === PAUSED,
        manualBilling: !!md.manualBilling, // admin-managed (renewal cron owns them, not Stripe)
        unassigned: !managedPlanId, // holds no managed plan tag
        bday: md.bday || null,
        bdayClaimed: md.bdayClaimed || null,
        points: Math.max(0, Math.round(Number(md.points) || 0)),
        carnet: Math.max(0, Number(md.carnet?.remaining) || 0),
        paymentIssue: !!md.paymentIssue,
        vatRequested: md.vatRequested || null,
        company: md.company || null,
        phone: md.phone || null,
      });
    }
    if (!res?.hasNextPage || data.length === 0) break;
    after = res?.endCursor;
  }
  out.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  return out;
}

/** Rich per-member profile for the admin pop-over: basics + lifetime stats + history. */
async function memberProfile(id) {
  const admin = memberstackAdmin.init(MS_SECRET);
  let m;
  try {
    const r = await admin.members.retrieve({ id });
    m = r?.data;
  } catch {
    return null;
  }
  if (!m) return null;
  const email = m.auth?.email || m.email || '';
  const cf = m.customFields || {};
  const md = m.metaData || {};
  const planId = (m.planConnections || []).map(planIdOf).filter(Boolean)[0] || null;
  const managedPlanId = (m.planConnections || []).map(planIdOf).filter((p) => p in PLAN_NAMES)[0] || null;
  const [checkins, redemptions, ledger, scans] = await Promise.all([
    listRecords(T.checkins, { filterByFormula: `AND({Member email}='${esc(email)}', {Status}='Checked-in')` }),
    listRecords(T.redemptions, { filterByFormula: `{Member email}='${esc(email)}'`, sort: [{ field: 'At', direction: 'desc' }] }),
    listRecords(T.pointsLedger, { filterByFormula: `{Member email}='${esc(email)}'`, sort: [{ field: 'At', direction: 'desc' }] }),
    listRecords(T.scanLog, { filterByFormula: `{Member email}='${esc(email)}'` }),
  ]);
  return {
    id: m.id,
    email,
    name: [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || email,
    plan: planId ? PLAN_NAMES[planId] || planId : null,
    paused: planId === PAUSED,
    since: m.createdAt || null,
    days: cf['days-remaining'] ?? null,
    renewal: cf['renewal-date'] ?? null,
    allowanceOverride: cf['allowance-override'] || null,
    allowance: allowanceForMember(m), // effective allowance (override-aware); null = unlimited
    manualBilling: !!md.manualBilling,
    unassigned: !managedPlanId,
    company: md.company || null,
    phone: md.phone || null,
    bday: md.bday || null,
    roomHoursCap: md.meetingRoomHoursCap ?? null,
    points: Math.max(0, Math.round(Number(md.points) || 0)),
    daysIn: checkins.length,
    rewardsRedeemed: redemptions.length,
    pointsRedeemed: redemptions.reduce((s, x) => s + (Number(x.fields[F.redemptions.cost]) || 0), 0),
    perksUsed: scans.length,
    recentRedemptions: redemptions.slice(0, 6).map((x) => ({
      reward: x.fields[F.redemptions.reward] || '',
      cost: Number(x.fields[F.redemptions.cost]) || 0,
      at: x.fields[F.redemptions.at] || null,
    })),
    recentLedger: ledger.slice(0, 8).map((x) => ({
      delta: Number(x.fields[F.pointsLedger.delta]) || 0,
      reason: x.fields[F.pointsLedger.reason] || '',
      at: x.fields[F.pointsLedger.at] || null,
    })),
  };
}

async function allSpaces() {
  const recs = await listRecords(T.spaces, { sort: [{ field: 'Order' }] });
  return recs.map((r) => ({
    id: r.id,
    name: r.fields[F.spaces.name],
    type: r.fields[F.spaces.type],
    bookable: !!r.fields[F.spaces.bookable],
  }));
}

async function bookingsForDate(date) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}', {Status}='Confirmed')`,
    sort: [{ field: 'Start' }],
  });
  const now = londonNow();
  // Privatisation marker rows are excluded here (they carry no Start/End → would render as
  // "NaN:NaN"). They surface instead as synthetic all-day rows via privatisationsForDate().
  // Indefinite recurring-Block RULE rows are excluded too — they surface (on their start date
  // AND every future occupied date) via recurringBlocksForDate(); leaving them here would
  // double-count them on the start date.
  return recs
    .filter((r) => r.fields[F.bookings.kind] !== 'Privatisation' && !isRecurringBlockRule(r))
    .map((r) => {
    const f = r.fields;
    const hold = { holdUntil: f[F.bookings.holdUntil], checkedIn: !!f[F.bookings.checkedIn], releasable: !!f[F.bookings.releasable] };
    return {
      id: r.id,
      space: Array.isArray(f[F.bookings.space]) ? f[F.bookings.space][0] : null,
      startMin: isoToLondonMin(f[F.bookings.start]),
      endMin: isoToLondonMin(f[F.bookings.end]),
      kind: f[F.bookings.kind],
      name: f[F.bookings.name] || null,
      email: f[F.bookings.email] || null,
      company: f[F.bookings.company] || null,
      holdUntil: f[F.bookings.holdUntil] || null,
      checkedIn: hold.checkedIn,
      releasable: hold.releasable,
      recurring: !!parsePrivatisationSlots(f[F.bookings.notes] || '') || null,
      released: holdReleased(hold, date, now.min, now.dateStr),
    };
  });
}

/**
 * Synthetic all-day "Privatised" rows for `date`. Each confirmed Privatisation is stored as
 * ONE marker row (Date=startDate, no Start/End, slots token in Notes). Rather than generate
 * hundreds of dated block rows, we recompute — for the single date being viewed — whether the
 * room is occupied (isPrivatisedOn) and, if so, emit one all-day entry the admin UI can render
 * as "Privatised · <company>". This makes the room visible on EVERY occupied date and marks it
 * not-free. Marker rows are few, so loading them all is cheap.
 */
async function privatisationsForDate(date) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND({Status}='Confirmed', {Kind}='Privatisation')`,
  });
  const out = [];
  for (const r of recs) {
    const f = r.fields;
    const parsed = parsePrivatisationSlots(f[F.bookings.notes] || '');
    if (!parsed) continue;
    const startDate = isoToLondonDate(f[F.bookings.date]) || '';
    if (!isPrivatisedOn(date, parsed.cadence, parsed.weekdays, startDate)) continue;
    const company = f[F.bookings.company] || f[F.bookings.name] || 'Company';
    out.push({
      id: `priv-${r.id}`,
      space: Array.isArray(f[F.bookings.space]) ? f[F.bookings.space][0] : null,
      startMin: 0,
      endMin: 0,
      kind: 'Privatisation',
      allDay: true,
      name: company,
      email: f[F.bookings.email] || null,
      company,
      label: `Privatised · ${company}`,
      status: 'Confirmed',
    });
  }
  return out;
}

/**
 * Synthetic timed occurrences for `date` of every INDEFINITE recurring-Block RULE. Each rule is
 * ONE Block row (Date=start date, Recurring=true, a `slots=` weekday token in Notes) — rather
 * than exploding hundreds of dated rows, we recompute for the viewed date whether the rule fires
 * (isPrivatisedOn) and, if so, emit one occurrence carrying the rule's start/end window. The id is
 * `rblock-<recordId>` (stable, derivable back to the rule) so the admin UI can render + cancel it;
 * cancelling the single rule row removes it from every future date. These occurrences feed the day
 * list AND the client clash-check, so a recurring block both shows and blocks double-booking.
 */
async function recurringBlocksForDate(date) {
  // Block AND External rules recur indefinitely (company bookings store Kind='External'), so fetch
  // both kinds; recurringBlockOccurrences filters to genuine rule rows (token-bearing) among them.
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND({Status}='Confirmed', OR({Kind}='Block', {Kind}='External'))`,
  });
  const now = londonNow();
  return recurringBlockOccurrences(recs, date).map(({ record: r, startMin, endMin }) => {
    const f = r.fields;
    const hold = { holdUntil: f[F.bookings.holdUntil], checkedIn: !!f[F.bookings.checkedIn], releasable: !!f[F.bookings.releasable] };
    return {
      id: `rblock-${r.id}`,
      space: Array.isArray(f[F.bookings.space]) ? f[F.bookings.space][0] : null,
      startMin,
      endMin,
      kind: f[F.bookings.kind],
      name: f[F.bookings.name] || null,
      email: f[F.bookings.email] || null,
      company: f[F.bookings.company] || null,
      holdUntil: f[F.bookings.holdUntil] || null,
      checkedIn: hold.checkedIn,
      releasable: hold.releasable,
      recurring: true,
      released: holdReleased(hold, date, now.min, now.dateStr),
    };
  });
}

/** A single member's check-in records for a given date (mirrors checkin.mjs's checkinsFor). */
async function checkinsForMemberDate(email, dateStr) {
  return listRecords(T.checkins, {
    filterByFormula: `AND(LOWER({Member email})='${esc(String(email || '').toLowerCase())}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}')`,
  });
}

/** A half day's period ('am'|'pm'), stored in a member check-in's Notes as 'AM'/'PM'. */
const periodFromNotes = (n) => {
  const s = String(n || '').trim().toUpperCase();
  return s === 'AM' ? 'am' : s === 'PM' ? 'pm' : null;
};

/** Map one Check-ins Airtable row to the admin who's-in shape. Shared by the day and week
 *  views so a chip renders the same in both. */
function mapCheckin(r) {
  const status = r.fields[F.checkins.status] || 'Planned';
  const source = r.fields[F.checkins.source] || '';
  const dayPass = status === 'Paid' || source === 'Web';
  let company = '';
  if (dayPass) {
    const parts = String(r.fields[F.checkins.notes] || '').split(' · ');
    if (parts.length >= 4) company = parts.slice(3).join(' · ').trim();
  }
  const length = r.fields[F.checkins.length] || 'Full';
  return {
    id: r.id,
    name: r.fields[F.checkins.name] || r.fields[F.checkins.email] || (dayPass ? 'Day guest' : 'Member'),
    length,
    period: !dayPass && length === 'Half' ? periodFromNotes(r.fields[F.checkins.notes]) : null,
    status,
    dayPass,
    email: r.fields[F.checkins.email] || '',
    company,
  };
}

/**
 * Who's in across a working week (Mon–Fri from `monday`). One ranged Airtable query for the
 * check-ins and one for the tours, grouped by date here — five per-day queries would be five
 * round-trips for a view that refreshes on every week change.
 */
async function weekWhosIn(monday) {
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const fri = days[4];
  const [checkinRecs, tourRecs] = await Promise.all([
    listAllRecords(T.checkins, {
      filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(monday)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')<='${esc(fri)}', OR({Status}='Checked-in', {Status}='Planned', {Status}='Paid'))`,
    }),
    listAllRecords(T.bookings, {
      filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(monday)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')<='${esc(fri)}', {Status}='Confirmed', {Kind}='Tour')`,
    }),
  ]);
  const byDay = new Map(days.map((d) => [d, { date: d, checkins: [], tours: [] }]));
  for (const r of checkinRecs) {
    const d = isoToLondonDate(r.fields[F.checkins.date]);
    byDay.get(d)?.checkins.push(mapCheckin(r));
  }
  for (const r of tourRecs) {
    const d = isoToLondonDate(r.fields[F.bookings.date]);
    const bucket = byDay.get(d);
    if (bucket) {
      bucket.tours.push({
        id: r.id,
        name: r.fields[F.bookings.name] || 'Tour visitor',
        startMin: isoToLondonMin(r.fields[F.bookings.start]),
      });
    }
  }
  return days.map((d) => byDay.get(d));
}

async function checkinsForDate(date) {
  // Include Planned (booked ahead, not yet arrived) as well as Checked-in, so
  // "who's in" reflects everyone expected that day — not just those on site now.
  // Also include paid Day Passes (Status='Paid', Source='Web') — guests who've
  // bought a day online and are due in, so staff can spot them ahead of arrival.
  const recs = await listRecords(T.checkins, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}', OR({Status}='Checked-in', {Status}='Planned', {Status}='Paid'))`,
  });
  return recs.map(mapCheckin);
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : null;
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  if (!isAdmin(vm.member)) return json({ error: 'forbidden' }, 403);

  if (req.method === 'GET') {
    const action = new URL(req.url).searchParams.get('action');
    if (action === 'members') return json({ members: await listAllMembers() });
    if (action === 'accessAudit') return json(await accessAudit());
    if (action === 'payouts') {
      const month = new URL(req.url).searchParams.get('month') || undefined;
      return json({ partners: await partnerPayouts({ month }) });
    }
    if (action === 'partnerStatement') {
      const url2 = new URL(req.url);
      const partner = url2.searchParams.get('partner');
      if (!partner) return json({ error: 'missing-partner' }, 400);
      return json(await partnerStatement(partner, { month: url2.searchParams.get('month') || undefined }));
    }
    if (action === 'spaces') return json({ spaces: await allSpaces() });
    if (action === 'calendar') {
      const date = new URL(req.url).searchParams.get('date');
      if (!date) return json({ error: 'missing-date' }, 400);
      const [bookings, privs, rblocks] = await Promise.all([bookingsForDate(date), privatisationsForDate(date), recurringBlocksForDate(date)]);
      return json({ date, bookings: [...privs, ...rblocks, ...bookings] });
    }
    if (action === 'week') {
      // `from` is any date in the target week; snap back to its Monday.
      const from = new URL(req.url).searchParams.get('from') || londonNow().dateStr;
      const d = new Date(`${from}T12:00:00Z`);
      const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
      const monday = addDays(from, -dow);
      return json({ monday, days: await weekWhosIn(monday) });
    }
    if (action === 'today') {
      const date = new URL(req.url).searchParams.get('date') || londonNow().dateStr;
      const [checkins, bookings, privs, rblocks] = await Promise.all([checkinsForDate(date), bookingsForDate(date), privatisationsForDate(date), recurringBlocksForDate(date)]);
      return json({ date, checkins, bookings: [...privs, ...rblocks, ...bookings] });
    }
    if (action === 'rewards') return json({ rewards: await listRewards({ liveOnly: false }) });
    if (action === 'perks') return json({ perks: await listPerks({ liveOnly: false }) });
    if (action === 'floats') return json({ floats: await listFloats() });
    if (action === 'weekendRequests') {
      const today = londonNow().dateStr;
      const recs = await listRecords(T.checkins, {
        filterByFormula: `AND({Status}='Requested', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(today)}')`,
        sort: [{ field: 'Date' }],
      });
      const requests = recs.map((r) => ({
        id: r.id,
        date: isoToLondonDate(r.fields[F.checkins.date]),
        name: r.fields[F.checkins.name] || '',
        email: r.fields[F.checkins.email] || '',
        length: r.fields[F.checkins.length] || 'Full',
        period: (r.fields[F.checkins.length] || 'Full') === 'Half' ? periodFromNotes(r.fields[F.checkins.notes]) : null,
      }));
      return json({ requests });
    }
    if (action === 'tourBlocks') {
      const today = londonNow().dateStr;
      const recs = await listRecords(T.bookings, {
        filterByFormula: `AND({Status}='Confirmed', {Kind}='Tour block', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(today)}')`,
        sort: [{ field: 'Start' }],
      });
      const blocks = recs.map((r) => ({
        id: r.id,
        date: isoToLondonDate(r.fields[F.bookings.date]),
        start: isoToLondonMin(r.fields[F.bookings.start]),
        end: isoToLondonMin(r.fields[F.bookings.end]),
        title: r.fields[F.bookings.title] || 'Tours closed',
      }));
      return json({ blocks });
    }
    if (action === 'memberProfile') {
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return json({ error: 'missing-id' }, 400);
      const p = await memberProfile(id);
      return p ? json(p) : json({ error: 'not-found' }, 404);
    }
    return json({ error: 'unknown-action' }, 400);
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const action = body?.action;

  if (action === 'block' || action === 'external') {
    const { spaceId, date, start, end, name, notes, recurring, indefinite } = body;
    if (!spaceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) {
      return json({ error: 'missing-or-bad-params' }, 400);
    }
    if (hhmmToMin(start) >= hhmmToMin(end)) return json({ error: 'bad-range' }, 400);
    const label = action === 'block' ? `Blocked${name ? ': ' + name : ''}` : name || 'External booking';
    // Indefinite weekly Block OR External = one RULE row (no row explosion): store its weekday in a
    // `slots=` token so parsePrivatisationSlots/recurringBlockOccurrences can expand it on every
    // future weekday. Both kinds recur indefinitely; weekend starts (weekday ∉ 1..5) fall back to a
    // plain one-off row (token omitted → not treated as a rule).
    let noteVal = notes || '';
    if (recurring && indefinite) {
      const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
      // The Quarter is a weekday space — an indefinite weekly rule MUST start on a weekday, or it
      // would silently save as a one-off while the UI claims a standing weekly series.
      if (wd < 1 || wd > 5) return json({ error: 'recurring-needs-weekday' }, 400);
      noteVal = `${noteVal ? `${noteVal} ` : ''}slots=week:${wd}`.trim();
    }
    try {
      const rec = await createRecord(
        T.bookings,
        {
          [F.bookings.title]: `${start}–${end} · ${label}`,
          [F.bookings.space]: [spaceId],
          [F.bookings.date]: date,
          [F.bookings.start]: londonWallClockToISO(date, start),
          [F.bookings.end]: londonWallClockToISO(date, end),
          [F.bookings.kind]: action === 'block' ? 'Block' : 'External',
          [F.bookings.name]: name || '',
          [F.bookings.notes]: noteVal,
          [F.bookings.status]: 'Confirmed',
          [F.bookings.source]: 'Admin',
        },
        { typecast: true },
      );
      return json({ ok: true, id: rec.id });
    } catch (e) {
      // Surface the REAL Airtable failure (e.g. a renamed/removed field after a table reset)
      // instead of letting the function 500 and the client mislabel it as "already booked".
      return json({ error: 'save-failed', detail: String(e?.message || e).slice(0, 300) }, 502);
    }
  }

  if (action === 'company') {
    const { spaceId, date, start, end, company, holdUntil, releasable, recurring, indefinite, notes } = body;
    if (!spaceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) {
      return json({ error: 'missing-or-bad-params' }, 400);
    }
    if (hhmmToMin(start) >= hhmmToMin(end)) return json({ error: 'bad-range' }, 400);
    if (holdUntil && !/^\d{2}:\d{2}$/.test(holdUntil)) return json({ error: 'bad-hold' }, 400);
    // A company booking is stored as Kind='External'. Indefinite weekly = one RULE row carrying a
    // `slots=` weekday token (like Block/External above), so it occupies the room every future
    // weekday rather than exploding into dated rows.
    let noteVal = notes || '';
    if (recurring && indefinite) {
      const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
      // The Quarter is a weekday space — an indefinite weekly rule MUST start on a weekday, or it
      // would silently save as a one-off while the UI claims a standing weekly series.
      if (wd < 1 || wd > 5) return json({ error: 'recurring-needs-weekday' }, 400);
      noteVal = `${noteVal ? `${noteVal} ` : ''}slots=week:${wd}`.trim();
    }
    try {
      const rec = await createRecord(
        T.bookings,
        {
          [F.bookings.title]: `${start}–${end} · ${company || 'Company'}`,
          [F.bookings.space]: [spaceId],
          [F.bookings.date]: date,
          [F.bookings.start]: londonWallClockToISO(date, start),
          [F.bookings.end]: londonWallClockToISO(date, end),
          [F.bookings.kind]: 'External',
          [F.bookings.name]: company || 'Company booking',
          [F.bookings.company]: company || '',
          // Optional hold: absent holdUntil → a firm booking that is never auto-released
          // (holdReleased() returns false without a holdUntil), just Confirmed.
          [F.bookings.holdUntil]: holdUntil || '',
          [F.bookings.releasable]: !!releasable,
          [F.bookings.notes]: noteVal,
          [F.bookings.status]: 'Confirmed',
          [F.bookings.source]: 'Admin',
        },
        { typecast: true },
      );
      return json({ ok: true, id: rec.id });
    } catch (e) {
      // Surface the REAL Airtable failure instead of a 500 the client mislabels as "already booked".
      return json({ error: 'save-failed', detail: String(e?.message || e).slice(0, 300) }, 502);
    }
  }

  if (action === 'cancelBooking') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    // "This week only" for a recurring RULE: don't delete the rule — record the occurrence's
    // date as a skip in its Notes, so just that week is freed (across admin, screens and
    // member/paid availability, which all expand the rule via recurringBlockOccurrences) and
    // the series keeps running on every other week. "Whole series" / one-off bookings fall
    // through to a normal cancel.
    if (body.scope === 'occurrence' && /^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) {
      const recs = await listRecords(T.bookings, { filterByFormula: `RECORD_ID()='${esc(body.id)}'` });
      const rec = recs[0];
      if (!rec) return json({ error: 'not-found' }, 404);
      const notes = String(rec.fields[F.bookings.notes] || '');
      const skips = parseSkipDates(notes);
      if (!skips.includes(body.date)) skips.push(body.date);
      const withoutSkip = notes.replace(/\s*skip=[\d,-]+/, '').trim();
      const newNotes = `${withoutSkip}${withoutSkip ? ' ' : ''}skip=${skips.sort().join(',')}`.trim();
      await updateRecord(T.bookings, body.id, { [F.bookings.notes]: newNotes });
      return json({ ok: true, scope: 'occurrence' });
    }
    await updateRecord(T.bookings, body.id, { [F.bookings.status]: 'Cancelled' });
    return json({ ok: true });
  }

  if (action === 'adjustDays') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({ id: body.memberId, data: { customFields: { 'days-remaining': String(body.days ?? '') } } });
    return json({ ok: true });
  }

  // Grant (or correct) a member's day passes — for comping and for testing the
  // carnet without a real purchase. Tops up the carnet balance + resets the expiry.
  if (action === 'grantPasses') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const n = Math.round(Number(body.passes) || 0);
    if (n === 0) return json({ error: 'bad-count' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const c = m.metaData?.carnet || {};
    const remaining = Math.max(0, (Number(c.remaining) || 0) + n);
    const total = Math.max(0, (Number(c.total) || 0) + Math.max(0, n));
    const expires = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    await admin.members.update({ id: body.memberId, data: { metaData: { ...(m.metaData || {}), carnet: { remaining, total, expires } } } });
    return json({ ok: true, carnet: { remaining, total, expires } });
  }

  // Clear a member's VAT-invoice request (admin has actioned it manually).
  if (action === 'clearVat') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    // Memberstack MERGES metaData by key, so `delete meta.vatRequested` doesn't remove it —
    // the key survives and the request reappears on refresh. Explicitly NULL it so the merge
    // actually clears it. Readers treat null/falsy as "not requested".
    const meta = { ...(m.metaData || {}), vatRequested: null };
    await admin.members.update({ id: body.memberId, data: { metaData: meta } });
    return json({ ok: true });
  }

  // Set / change a member's door entry code.
  if (action === 'setDoorCode') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({ id: body.memberId, data: { customFields: { 'door-code': String(body.code ?? '') } } });
    return json({ ok: true });
  }

  // Edit a member's details (fixes e.g. a wrong name on their record). Memberstack
  // merges customFields by key, so we only touch the fields provided.
  if (action === 'updateMember') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const cf = {};
    if (typeof body.firstName === 'string') cf['first-name'] = body.firstName.trim();
    if (typeof body.lastName === 'string') cf['last-name'] = body.lastName.trim();
    const data = {};
    if (Object.keys(cf).length) data.customFields = cf;
    if (typeof body.company === 'string' || typeof body.phone === 'string' || body.meetingRoomHoursCap !== undefined) {
      const r = await admin.members.retrieve({ id: body.memberId });
      const md = { ...(r?.data?.metaData || {}) };
      // Memberstack merges metaData by key, so clearing a field means NULLing it, not
      // `delete` (a deleted key is simply absent from the merge and the old value survives).
      if (typeof body.company === 'string') {
        const c = body.company.trim();
        md.company = c || null;
      }
      if (typeof body.phone === 'string') {
        const p = body.phone.trim();
        md.phone = p || null;
      }
      // Per-member override for free meeting-room hours/month (blank/0 → default 4).
      if (body.meetingRoomHoursCap !== undefined) {
        const n = Number(body.meetingRoomHoursCap);
        md.meetingRoomHoursCap = Number.isFinite(n) && n > 0 ? n : null;
      }
      data.metaData = md;
    }
    if (!Object.keys(data).length) return json({ error: 'nothing-to-update' }, 400);
    await admin.members.update({ id: body.memberId, data });
    return json({ ok: true });
  }

  // Settle a partner's owed redemptions (running balance resets to zero).
  if (action === 'markPaid') {
    if (!body.partner) return json({ error: 'missing-partner' }, 400);
    const r = await markPartnerPaid(body.partner, body.month || undefined);
    return json({ ok: true, ...r });
  }

  // Approve or decline a member's weekend-access request (emails them the outcome).
  if (action === 'approveWeekend' || action === 'declineWeekend') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const recs = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(body.id)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    const approve = action === 'approveWeekend';
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: approve ? 'Planned' : 'Cancelled' }, { typecast: true });
    const email = r.fields[F.checkins.email];
    const name = r.fields[F.checkins.name] || 'there';
    const date = isoToLondonDate(r.fields[F.checkins.date]);
    const when = fmtDateLong(date);
    if (email) {
      await sendEmail(
        approve
          ? {
              to: email,
              replyTo: OPS_EMAIL,
              subject: `Weekend access confirmed — ${when}`,
              html: emailShell('Your weekend access is confirmed', `<p>Hi ${escapeHtml(name)},</p><p>Good news — you’re all set to come in on <strong>${escapeHtml(when)}</strong>. Just check in as usual when you arrive. See you then.</p>`, 'Your weekend access is confirmed'),
            }
          : {
              to: email,
              replyTo: OPS_EMAIL,
              subject: `Weekend access — ${when}`,
              html: emailShell('About that weekend', `<p>Hi ${escapeHtml(name)},</p><p>Sorry — we’re not able to open on <strong>${escapeHtml(when)}</strong> this time. Do get in touch and we’ll help you find another day.</p>`, 'An update on your weekend access request'),
            },
      );
    }
    if (approve && email) {
      await pushToEmail(email, { title: 'Weekend access confirmed', body: `You’re set for ${when}. See you then.`, url: '/dashboard/' });
    }
    return json({ ok: true });
  }

  // Close tours for a whole day, or a set of hours — independent of room blocks.
  if (action === 'blockTours') {
    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
    const hasRange = /^\d{2}:\d{2}$/.test(body.start || '') && /^\d{2}:\d{2}$/.test(body.end || '');
    const start = hasRange ? body.start : '09:30';
    const end = hasRange ? body.end : '17:00';
    if (hhmmToMin(start) >= hhmmToMin(end)) return json({ error: 'bad-range' }, 400);
    const rec = await createRecord(
      T.bookings,
      {
        [F.bookings.title]: hasRange ? `Tours closed ${start}–${end}` : 'Tours closed (all day)',
        [F.bookings.date]: date,
        [F.bookings.start]: londonWallClockToISO(date, start),
        [F.bookings.end]: londonWallClockToISO(date, end),
        [F.bookings.kind]: 'Tour block',
        [F.bookings.status]: 'Confirmed',
        [F.bookings.source]: 'Admin',
        [F.bookings.notes]: 'Tours closed',
      },
      { typecast: true },
    );
    return json({ ok: true, id: rec.id });
  }

  // Manually check a member in for today (admin), deducting a day unless unlimited.
  if (action === 'checkinMember') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const email = m.auth?.email || m.email || null;
    const cf = m.customFields || {};
    const name = [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || email || 'Member';
    const length = body.length === 'Half' ? 'Half' : 'Full';
    const cost = length === 'Half' ? 0.5 : 1;
    // Did staff explicitly pick a half? If not, we must not clobber a member's own AM/PM choice.
    const adminChosePeriod = body.period === 'am' || body.period === 'pm';
    const chosenPeriodNote = length === 'Half' ? (String(body.period).toLowerCase() === 'pm' ? 'PM' : 'AM') : '';
    const unlimited = allowanceForMember(m) === null;
    const today = londonNow().dateStr;

    // Idempotent per member/day: if a non-Cancelled 'Checked-in' record already exists for
    // today, a repeated admin tap is a no-op — no second deduction, no duplicate row.
    const todaysRecs = await checkinsForMemberDate(email, today);
    if (todaysRecs.some((rr) => rr.fields[F.checkins.status] === 'Checked-in')) {
      return json({ ok: true, alreadyCheckedIn: true });
    }

    const raw = cf['days-remaining'];
    const cur = String(raw).toLowerCase() === 'unlimited' ? null : Math.max(0, parseFloat(String(raw)) || 0);
    // Block a check-in when the allowance is exhausted (metered member with < cost left).
    if (!unlimited && cur !== null && cur < cost) {
      return json({ error: 'no-allowance' }, 400);
    }

    if (!unlimited) {
      if (cur !== null) {
        await admin.members.update({ id: body.memberId, data: { customFields: { 'days-remaining': String(Math.max(0, cur - cost)) } } });
      }
    }
    // If the member already has a Planned reservation for today (they reserved the day, or an
    // approved weekend), FLIP it to Checked-in rather than adding a second row — otherwise the
    // person is duplicated in the Today "Who's in" view. Only create fresh when none exists.
    const plannedToday = todaysRecs.find((rr) => (rr.fields[F.checkins.status] || '') === 'Planned');
    if (plannedToday) {
      // Keep the member's own half-day AM/PM (stored in Notes) unless staff explicitly chose one.
      const existingPeriod = periodFromNotes(plannedToday.fields[F.checkins.notes]);
      const flipNotes = length !== 'Half' ? '' : adminChosePeriod ? chosenPeriodNote : existingPeriod ? existingPeriod.toUpperCase() : 'AM';
      await updateRecord(T.checkins, plannedToday.id, {
        [F.checkins.status]: 'Checked-in',
        [F.checkins.length]: length,
        [F.checkins.notes]: flipNotes,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.source]: 'Admin',
      });
    } else {
      await createRecord(T.checkins, {
        [F.checkins.ref]: `${name} · ${today}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: today,
        [F.checkins.length]: length,
        [F.checkins.notes]: chosenPeriodNote,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.status]: 'Checked-in',
        [F.checkins.source]: 'Admin',
      });
    }
    return json({ ok: true });
  }

  // Undo a check-in from the Today pane: cancel the row, and (unless the member is
  // unlimited) refund the day it cost — mirror of the checkinMember deduction, inverted.
  // The refund is best-effort/guarded so a hiccup can't fail the cancel itself.
  if (action === 'removeCheckin') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const recs = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(body.id)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    // Idempotent: if it's already cancelled, don't cancel/refund again (prevents a double refund
    // on a double-tap or endpoint retry).
    if (r.fields[F.checkins.status] === 'Cancelled') return json({ ok: true, alreadyCancelled: true });
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: 'Cancelled' }, { typecast: true });
    try {
      const dayCost = Number(r.fields[F.checkins.dayCost]) || 0;
      const email = r.fields[F.checkins.email];
      if (dayCost > 0 && email) {
        const admin = memberstackAdmin.init(MS_SECRET);
        const mr = await admin.members.retrieve({ email });
        const m = mr?.data;
        // allowanceForMember === null means unlimited — nothing to refund.
        if (m && allowanceForMember(m) !== null) {
          const raw = m.customFields?.['days-remaining'];
          const cur = String(raw).toLowerCase() === 'unlimited' ? null : Math.max(0, parseFloat(String(raw)) || 0);
          if (cur !== null) {
            await admin.members.update({ id: m.id, data: { customFields: { 'days-remaining': String(cur + dayCost) } } });
          }
        }
      }
    } catch {
      /* refund is best-effort — the cancel already succeeded */
    }
    return json({ ok: true });
  }

  // ---- Birthday claim (Quarter inventory; flows to the member's card) ----
  if (action === 'claimBirthday') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const md = { ...(m.metaData || {}) };
    // Un-claim must NULL the key (Memberstack merges by key; a `delete` leaves it in place).
    if (body.claimed === false) md.bdayClaimed = null;
    else md.bdayClaimed = body.date || londonNow().dateStr;
    await admin.members.update({ id: body.memberId, data: { metaData: md } });
    return json({ ok: true, bdayClaimed: md.bdayClaimed || null });
  }

  // ---- Content management: Rewards ----
  if (action === 'saveReward') {
    const fields = {
      [F.rewards.title]: body.title || '',
      [F.rewards.partner]: body.partner || '',
      [F.rewards.cost]: Number(body.cost) || 0,
      [F.rewards.funding]: FUNDINGS.includes(body.funding) ? body.funding : 'inventory',
      [F.rewards.category]: body.category || '',
      [F.rewards.icon]: body.icon || 'gift',
      [F.rewards.pos]: body.pos || '',
      [F.rewards.hero]: !!body.hero,
      [F.rewards.status]: body.status === 'live' ? 'live' : 'draft',
      [F.rewards.image]: body.image || '',
      [F.rewards.order]: Number(body.order) || 0,
    };
    if (body.id) {
      await updateRecord(T.rewards, body.id, fields);
      return json({ ok: true, id: body.id });
    }
    const rec = await createRecord(T.rewards, fields);
    return json({ ok: true, id: rec.id });
  }
  if (action === 'deleteReward') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    await deleteRecord(T.rewards, body.id);
    return json({ ok: true });
  }

  // ---- Content management: Perks ----
  if (action === 'savePerk') {
    const fields = {
      [F.perks.partner]: body.partner || '',
      [F.perks.offer]: body.offer || '',
      [F.perks.browseCategory]: body.category || '',
      [F.perks.perkType]: PERK_TYPES.includes(body.type) ? body.type : 'Discount',
      [F.perks.days]: body.days || '',
      [F.perks.pos]: body.pos || '',
      [F.perks.authorisedBy]: body.authorisedBy || '',
      [F.perks.ref]: body.ref || '',
      [F.perks.contact]: body.contact || '',
      [F.perks.icon]: body.icon || 'gift',
      [F.perks.image]: body.image || '',
      [F.perks.status]: body.status === 'live' ? 'live' : 'draft',
      [F.perks.order]: Number(body.order) || 0,
    };
    if (body.id) {
      await updateRecord(T.perks, body.id, fields);
      return json({ ok: true, id: body.id });
    }
    const rec = await createRecord(T.perks, fields);
    return json({ ok: true, id: rec.id });
  }
  if (action === 'deletePerk') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    await deleteRecord(T.perks, body.id);
    return json({ ok: true });
  }

  // ---- Member points: manual adjust (with a reason) + redeem a reward for them ----
  if (action === 'adjustPoints') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const delta = Math.round(Number(body.delta) || 0);
    if (!delta) return json({ error: 'no-delta' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const balance = await awardPoints(m, delta, 'adjust', body.reason || 'admin adjust');
    return json({ ok: true, balance });
  }
  if (action === 'redeemForMember') {
    if (!body.memberId || !body.rewardId) return json({ error: 'missing-params' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const res = await redeemReward(m, body.rewardId);
    if (!res.ok) return json({ error: res.reason }, 400);
    return json({ ok: true, balance: res.balance, reward: res.reward.title });
  }

  // Assign / change a member's plan (e.g. company-paid staff who registered without one).
  // Tags the Memberstack plan + sets the day balance to that plan's allowance.
  if (action === 'assignPlan') {
    if (!body.memberId || !body.planId) return json({ error: 'missing-params' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const email = m.auth?.email || m.email || null;
    if (!email) return json({ error: 'no-email' }, 400);
    await setMemberPlan(MS_SECRET, email, body.planId);
    await renewMember(MS_SECRET, email, { resetDays: true, flat: true });
    return json({ ok: true });
  }

  // Manually-managed (non-Stripe) membership: apply any subset of plan / renewal date /
  // allowance-override / day balance to an admin-managed member, and mark them manualBilling
  // so the renewal cron owns their renewals and the Stripe webhook leaves them alone. Only the
  // provided fields are touched. setMemberPlan does its own Memberstack update(s); the
  // customFields writes + the metaData.manualBilling merge are batched into ONE update.
  if (action === 'updateMembership') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const email = m.auth?.email || m.email || null;
    if (!email) return json({ error: 'no-email' }, 400);

    // Plan change first (it runs its own add/remove-free-plan updates). 'none' is the
    // explicit "remove their plan — day pass / carnet only" sentinel from the profile.
    if (body.planId === 'none') await clearMemberPlan(MS_SECRET, email);
    else if (body.planId) await setMemberPlan(MS_SECRET, email, body.planId);

    const cf = {};
    // renewalDate: a 'DD/MM/YYYY' string, or '' to clear.
    if (body.renewalDate !== undefined) cf['renewal-date'] = String(body.renewalDate);
    // allowance: a number to set the per-member override, or '' to clear it back to plan default.
    if (body.allowance !== undefined) cf['allowance-override'] = body.allowance === '' ? '' : String(body.allowance);
    // days: the day balance (days-remaining).
    if (body.days !== undefined) cf['days-remaining'] = String(body.days);

    // Merge manualBilling=true into metaData (this member is now admin-managed).
    const md = { ...(m.metaData || {}), manualBilling: true };
    const data = { metaData: md };
    if (Object.keys(cf).length) data.customFields = cf;
    await admin.members.update({ id: body.memberId, data });
    return json({ ok: true });
  }

  // Renew a manually-managed member now: reset their day balance to the (override-aware)
  // allowance with rollover, and advance their renewal date to one month from today.
  if (action === 'renewNow') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const email = m.auth?.email || m.email || null;
    if (!email) return json({ error: 'no-email' }, 400);
    // One month from today, formatted DD/MM/YYYY via the shared helper (unix-seconds in).
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const renewalDate = formatDate(Math.floor(next.getTime() / 1000));
    const result = await renewMember(MS_SECRET, email, { renewalDate, resetDays: true });
    return json({ ok: true, ...result });
  }

  // ---- Partner float top-up ----
  if (action === 'topUpFloat') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const amount = Math.max(0, Number(body.amount) || 0);
    const recs = await listRecords(T.partners, { filterByFormula: `RECORD_ID()='${esc(body.id)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    const bal = (Number(r.fields[F.partners.balance]) || 0) + amount;
    const total = Math.max(Number(r.fields[F.partners.floatTotal]) || 0, bal);
    await updateRecord(T.partners, body.id, {
      [F.partners.balance]: bal,
      [F.partners.floatTotal]: total,
      [F.partners.status]: floatStatus(bal, total),
    });
    return json({ ok: true, balance: bal, floatTotal: total });
  }

  // ---- Add a partner (in-app enrolment) ----
  // Creates a prepaid partner float row + captures contact & payee bank details. The
  // balance starts equal to the float total. The 6 contact/bank fields are written BY
  // NAME (typecast:true) — SENSITIVE, stored only in the private Airtable, never logged
  // or returned in any member-facing response.
  if (action === 'createPartner') {
    const partner = String(body.partner || '').trim();
    if (!partner) return json({ error: 'missing-partner' }, 400);
    const floatTotal = Math.max(0, Number(body.floatTotal) || 0);
    // No dedicated notes column on Partners → fold the optional funding note into the
    // reward label (display-only; payouts/availability match on partner, not reward).
    const reward = [String(body.reward || '').trim(), String(body.fundingNote || '').trim()]
      .filter(Boolean)
      .join(' · ');
    const rec = await createRecord(
      T.partners,
      {
        [F.partners.partner]: partner,
        [F.partners.reward]: reward,
        [F.partners.balance]: floatTotal,
        [F.partners.floatTotal]: floatTotal,
        [F.partners.status]: floatStatus(floatTotal, floatTotal),
        [F.partners.contactName]: String(body.contactName || '').trim(),
        [F.partners.contactEmail]: String(body.contactEmail || '').trim(),
        [F.partners.phone]: String(body.phone || '').trim(),
        [F.partners.payeeName]: String(body.payeeName || '').trim(),
        [F.partners.sortCode]: String(body.sortCode || '').trim(),
        [F.partners.accountNumber]: String(body.accountNumber || '').trim(),
      },
      { typecast: true },
    );
    return json({ ok: true, id: rec.id });
  }

  return json({ error: 'unknown-action' }, 400);
}
