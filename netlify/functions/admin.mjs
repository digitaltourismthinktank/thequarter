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
import { londonWallClockToISO, isoToLondonMin, isoToLondonDate, hhmmToMin, londonNow, holdReleased } from './_time.mjs';
import { PLAN_NAMES, allowanceForMember, setMemberPlan, renewMember } from './_quarter-sync.mjs';
import { listRewards, listPerks, listFloats, floatStatus, awardPoints, redeemReward, partnerPayouts, markPartnerPaid } from './_rewards.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';
import { pushToEmail } from './_push.mjs';
import { parsePrivatisationSlots, isPrivatisedOn } from './_privatisation.mjs';

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
  return recs
    .filter((r) => r.fields[F.bookings.kind] !== 'Privatisation')
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
      recurring: f[F.bookings.recurring] || null,
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

async function checkinsForDate(date) {
  // Include Planned (booked ahead, not yet arrived) as well as Checked-in, so
  // "who's in" reflects everyone expected that day — not just those on site now.
  // Also include paid Day Passes (Status='Paid', Source='Web') — guests who've
  // bought a day online and are due in, so staff can spot them ahead of arrival.
  const recs = await listRecords(T.checkins, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}', OR({Status}='Checked-in', {Status}='Planned', {Status}='Paid'))`,
  });
  return recs.map((r) => {
    const status = r.fields[F.checkins.status] || 'Planned';
    const source = r.fields[F.checkins.source] || '';
    // A paid day-pass guest, not a member — flagged so the UI can mark them distinctly.
    const dayPass = status === 'Paid' || source === 'Web';
    // Day-pass rows carry the guest's company at the tail of the Notes field
    // ("Day Pass · <pi> · £<total> · <company>") — surface it when present.
    let company = '';
    if (dayPass) {
      const parts = String(r.fields[F.checkins.notes] || '').split(' · ');
      if (parts.length >= 4) company = parts.slice(3).join(' · ').trim();
    }
    return {
      name: r.fields[F.checkins.name] || r.fields[F.checkins.email] || (dayPass ? 'Day guest' : 'Member'),
      length: r.fields[F.checkins.length] || 'Full',
      status,
      dayPass,
      email: r.fields[F.checkins.email] || '',
      company,
    };
  });
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
    if (action === 'payouts') {
      const month = new URL(req.url).searchParams.get('month') || undefined;
      return json({ partners: await partnerPayouts({ month }) });
    }
    if (action === 'spaces') return json({ spaces: await allSpaces() });
    if (action === 'calendar') {
      const date = new URL(req.url).searchParams.get('date');
      if (!date) return json({ error: 'missing-date' }, 400);
      const [bookings, privs] = await Promise.all([bookingsForDate(date), privatisationsForDate(date)]);
      return json({ date, bookings: [...privs, ...bookings] });
    }
    if (action === 'today') {
      const date = new URL(req.url).searchParams.get('date') || londonNow().dateStr;
      const [checkins, bookings, privs] = await Promise.all([checkinsForDate(date), bookingsForDate(date), privatisationsForDate(date)]);
      return json({ date, checkins, bookings: [...privs, ...bookings] });
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

  if (action === 'company') {
    const { spaceId, date, start, end, company, holdUntil, releasable, recurring, notes } = body;
    if (!spaceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) {
      return json({ error: 'missing-or-bad-params' }, 400);
    }
    if (hhmmToMin(start) >= hhmmToMin(end)) return json({ error: 'bad-range' }, 400);
    if (holdUntil && !/^\d{2}:\d{2}$/.test(holdUntil)) return json({ error: 'bad-hold' }, 400);
    const rec = await createRecord(T.bookings, {
      [F.bookings.title]: `${start}–${end} · ${company || 'Company'}`,
      [F.bookings.space]: [spaceId],
      [F.bookings.date]: date,
      [F.bookings.start]: londonWallClockToISO(date, start),
      [F.bookings.end]: londonWallClockToISO(date, end),
      [F.bookings.kind]: 'External',
      [F.bookings.name]: company || 'Company booking',
      [F.bookings.company]: company || '',
      [F.bookings.holdUntil]: holdUntil || '',
      [F.bookings.releasable]: !!releasable,
      [F.bookings.recurring]: recurring || '',
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
    const meta = { ...(m.metaData || {}) };
    delete meta.vatRequested;
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
      if (typeof body.company === 'string') {
        const c = body.company.trim();
        if (c) md.company = c;
        else delete md.company;
      }
      if (typeof body.phone === 'string') {
        const p = body.phone.trim();
        if (p) md.phone = p;
        else delete md.phone;
      }
      // Per-member override for free meeting-room hours/month (blank/0 → default 4).
      if (body.meetingRoomHoursCap !== undefined) {
        const n = Number(body.meetingRoomHoursCap);
        if (Number.isFinite(n) && n > 0) md.meetingRoomHoursCap = n;
        else delete md.meetingRoomHoursCap;
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
    let when = date;
    try {
      when = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      /* keep iso */
    }
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
