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
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonWallClockToISO, isoToLondonMin, hhmmToMin, londonNow } from './_time.mjs';
import { PLAN_NAMES, allowanceForMember } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const PAUSED = 'pln_paused-fns0m38';
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

async function listAllMembers() {
  const admin = memberstackAdmin.init(MS_SECRET);
  const out = [];
  let after;
  for (let i = 0; i < 20; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const data = res?.data || [];
    for (const m of data) {
      const cf = m.customFields || {};
      const planId = (m.planConnections || []).map(planIdOf).filter(Boolean)[0] || null;
      out.push({
        id: m.id,
        email: m.auth?.email || m.email || null,
        name: [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || null,
        plan: planId ? PLAN_NAMES[planId] || planId : null,
        days: cf['days-remaining'] ?? null,
        renewal: cf['renewal-date'] ?? null,
        doorCode: cf['door-code'] ?? null,
        paused: planId === PAUSED,
      });
    }
    if (!res?.hasNextPage || data.length === 0) break;
    after = res?.endCursor;
  }
  out.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  return out;
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
  return recs.map((r) => ({
    id: r.id,
    space: Array.isArray(r.fields[F.bookings.space]) ? r.fields[F.bookings.space][0] : null,
    startMin: isoToLondonMin(r.fields[F.bookings.start]),
    endMin: isoToLondonMin(r.fields[F.bookings.end]),
    kind: r.fields[F.bookings.kind],
    name: r.fields[F.bookings.name] || null,
    email: r.fields[F.bookings.email] || null,
  }));
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
    if (action === 'spaces') return json({ spaces: await allSpaces() });
    if (action === 'calendar') {
      const date = new URL(req.url).searchParams.get('date');
      if (!date) return json({ error: 'missing-date' }, 400);
      return json({ date, bookings: await bookingsForDate(date) });
    }
    return json({ error: 'unknown-action' }, 400);
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const action = body?.action;

  if (action === 'block' || action === 'external') {
    const { spaceId, date, start, end, name, notes } = body;
    if (!spaceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) {
      return json({ error: 'missing-or-bad-params' }, 400);
    }
    if (hhmmToMin(start) >= hhmmToMin(end)) return json({ error: 'bad-range' }, 400);
    const label = action === 'block' ? `Blocked${name ? ': ' + name : ''}` : name || 'External booking';
    const rec = await createRecord(T.bookings, {
      [F.bookings.title]: `${start}–${end} · ${label}`,
      [F.bookings.space]: [spaceId],
      [F.bookings.date]: date,
      [F.bookings.start]: londonWallClockToISO(date, start),
      [F.bookings.end]: londonWallClockToISO(date, end),
      [F.bookings.kind]: action === 'block' ? 'Block' : 'External',
      [F.bookings.name]: name || '',
      [F.bookings.notes]: notes || '',
      [F.bookings.status]: 'Confirmed',
      [F.bookings.source]: 'Admin',
    });
    return json({ ok: true, id: rec.id });
  }

  if (action === 'cancelBooking') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    await updateRecord(T.bookings, body.id, { [F.bookings.status]: 'Cancelled' });
    return json({ ok: true });
  }

  if (action === 'adjustDays') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({ id: body.memberId, data: { customFields: { 'days-remaining': String(body.days ?? '') } } });
    return json({ ok: true });
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
    const unlimited = allowanceForMember(m) === null;
    const today = londonNow().dateStr;

    if (!unlimited) {
      const raw = cf['days-remaining'];
      const cur = String(raw).toLowerCase() === 'unlimited' ? null : Math.max(0, parseFloat(String(raw)) || 0);
      if (cur !== null) {
        await admin.members.update({ id: body.memberId, data: { customFields: { 'days-remaining': String(Math.max(0, cur - cost)) } } });
      }
    }
    await createRecord(T.checkins, {
      [F.checkins.ref]: `${name} · ${today}`,
      [F.checkins.email]: email,
      [F.checkins.name]: name,
      [F.checkins.date]: today,
      [F.checkins.length]: length,
      [F.checkins.dayCost]: unlimited ? 0 : cost,
      [F.checkins.status]: 'Checked-in',
      [F.checkins.source]: 'Admin',
    });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
