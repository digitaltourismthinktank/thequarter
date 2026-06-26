/**
 * The Quarter — Check-in API + day-usage ledger.
 *
 * GET  ?action=today           (member token) → today's status + day balance + planned days
 * POST {action:'checkin', length:'Full'|'Half'}        → check in for TODAY (deducts a day)
 * POST {action:'reserve', date, length}                → reserve a future weekday ("Tomorrow"); no deduct
 * POST {action:'cancel', id}                           → cancel an own Planned reservation
 *
 * Check-ins (Airtable) are the usage ledger. The member's day balance lives in
 * Memberstack `days-remaining`; check-in decrements it, the Stripe webhook resets it
 * on renewal. Citizen (unlimited) records the visit but never decrements.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, isWeekday, addDays } from './_time.mjs';
import { allowanceForMember } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

function parseDays(raw) {
  if (raw == null || String(raw).toLowerCase() === 'unlimited') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

async function setDays(memberId, value) {
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: memberId, data: { customFields: { 'days-remaining': value } } });
}

/** A member's check-in records for a given date (any status). */
async function checkinsFor(email, dateStr) {
  return listRecords(T.checkins, {
    filterByFormula: `AND({Member email}='${esc(email)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}')`,
  });
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  // GET today's status
  if (req.method === 'GET') {
    if (new URL(req.url).searchParams.get('action') !== 'today') return json({ error: 'unknown-action' }, 400);
    const vm = await verifyMember(tokenFromRequest(req, null));
    if (!vm.ok) return json({ error: vm.reason }, 401);
    const email = memberEmail(vm.member);
    const today = londonNow().dateStr;
    const recs = await checkinsFor(email, today);
    const active = recs.find((r) => r.fields[F.checkins.status] === 'Checked-in');
    const planned = await listRecords(T.checkins, {
      filterByFormula: `AND({Member email}='${esc(email)}', {Status}='Planned', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    return json({
      date: today,
      checkedIn: !!active,
      length: active ? active.fields[F.checkins.length] : null,
      balance: vm.member.customFields?.['days-remaining'] ?? null,
      planned: planned.map((r) => ({ id: r.id, date: r.fields[F.checkins.date], length: r.fields[F.checkins.length] })),
    });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const email = memberEmail(me);
  const name = memberName(me);
  const length = body.length === 'Half' ? 'Half' : 'Full';
  const cost = length === 'Half' ? 0.5 : 1;
  const unlimited = allowanceForMember(me) === null;

  // Check in for TODAY (deducts unless unlimited). Idempotent per day.
  if (body.action === 'checkin') {
    const today = londonNow().dateStr;
    if (!isWeekday(today)) return json({ error: 'closed-weekend' }, 400);
    const recs = await checkinsFor(email, today);
    const already = recs.find((r) => r.fields[F.checkins.status] === 'Checked-in');
    if (already) {
      return json({ ok: true, alreadyCheckedIn: true, balance: me.customFields?.['days-remaining'] ?? null });
    }

    // Deduct from the Memberstack balance (unless unlimited).
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    if (!unlimited) {
      const current = parseDays(me.customFields?.['days-remaining']);
      const next = current === null ? null : Math.max(0, current - cost);
      if (next !== null) {
        newBalance = String(next);
        await setDays(me.id, newBalance);
      }
    }

    // Flip an existing Planned record to Checked-in, else create one.
    const planned = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (planned) {
      await updateRecord(T.checkins, planned.id, {
        [F.checkins.status]: 'Checked-in',
        [F.checkins.length]: length,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.source]: 'Self',
      });
    } else {
      await createRecord(T.checkins, {
        [F.checkins.ref]: `${name} · ${today}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: today,
        [F.checkins.length]: length,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.status]: 'Checked-in',
        [F.checkins.source]: 'Self',
      });
    }
    return json({ ok: true, balance: newBalance });
  }

  // Reserve a future weekday ("Tomorrow"). No deduction until they actually check in.
  if (body.action === 'reserve') {
    const date = body.date || addDays(londonNow().dateStr, 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
    if (!isWeekday(date)) return json({ error: 'closed-weekend' }, 400);
    const existing = await checkinsFor(email, date);
    if (existing.some((r) => r.fields[F.checkins.status] !== 'Cancelled')) {
      return json({ ok: true, alreadyReserved: true });
    }
    const rec = await createRecord(T.checkins, {
      [F.checkins.ref]: `${name} · ${date}`,
      [F.checkins.email]: email,
      [F.checkins.name]: name,
      [F.checkins.date]: date,
      [F.checkins.length]: length,
      [F.checkins.dayCost]: 0,
      [F.checkins.status]: 'Planned',
      [F.checkins.source]: 'Self',
    });
    return json({ ok: true, id: rec.id });
  }

  // Cancel an own Planned reservation.
  if (body.action === 'cancel') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const recs = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(body.id)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    if (r.fields[F.checkins.email] !== email) return json({ error: 'forbidden' }, 403);
    if (r.fields[F.checkins.status] !== 'Planned') return json({ error: 'only-planned-cancellable' }, 400);
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: 'Cancelled' });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
