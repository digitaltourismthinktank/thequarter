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
import { listRecords, createRecord, updateRecord, deleteRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonWallClockToISO, isoToLondonMin, hhmmToMin, londonNow } from './_time.mjs';
import { PLAN_NAMES, allowanceForMember } from './_quarter-sync.mjs';
import { listRewards, listPerks, listFloats, floatStatus, awardPoints, redeemReward } from './_rewards.mjs';

const PERK_TYPES = ['Discount', 'On the house', 'Upgrade', 'Extra', 'Bundle', 'Priority', 'Welcome gift', 'Experience'];
const FUNDINGS = ['inventory', 'partner', 'quarter'];

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
      const md = m.metaData || {};
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
        bday: md.bday || null,
        bdayClaimed: md.bdayClaimed || null,
        points: Math.max(0, Math.round(Number(md.points) || 0)),
        company: md.company || null,
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
    company: md.company || null,
    bday: md.bday || null,
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

async function checkinsForDate(date) {
  const recs = await listRecords(T.checkins, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}', {Status}='Checked-in')`,
  });
  return recs.map((r) => ({
    name: r.fields[F.checkins.name] || r.fields[F.checkins.email] || 'Member',
    length: r.fields[F.checkins.length] || 'Full',
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
    if (action === 'today') {
      const date = new URL(req.url).searchParams.get('date') || londonNow().dateStr;
      const [checkins, bookings] = await Promise.all([checkinsForDate(date), bookingsForDate(date)]);
      return json({ date, checkins, bookings });
    }
    if (action === 'rewards') return json({ rewards: await listRewards({ liveOnly: false }) });
    if (action === 'perks') return json({ perks: await listPerks({ liveOnly: false }) });
    if (action === 'floats') return json({ floats: await listFloats() });
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

  // ---- Birthday claim (Quarter inventory; flows to the member's card) ----
  if (action === 'claimBirthday') {
    if (!body.memberId) return json({ error: 'missing-member' }, 400);
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ id: body.memberId });
    const m = r?.data;
    if (!m) return json({ error: 'not-found' }, 404);
    const md = { ...(m.metaData || {}) };
    if (body.claimed === false) delete md.bdayClaimed;
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

  return json({ error: 'unknown-action' }, 400);
}
