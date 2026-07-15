/**
 * The Quarter — Bookings API (meeting rooms + phone pods).
 *
 * GET  ?action=spaces                         → bookable spaces (public)
 * GET  ?action=availability&space=&date=      → busy ranges for a space/day (public; no names)
 * GET  ?action=mine            (member token) → the member's upcoming bookings
 * POST {action:'book', spaceId, date, start, end}   (member token)
 * POST {action:'cancel', bookingId}                 (member token; owner or admin)
 *
 * Rules: Mon–Fri 08:00–18:00, 30-min increments, no overlaps. Free for members.
 * Admin-created external bookings / blocks come later via the admin function.
 */
import { verifyMember, memberEmail, memberName, isAdmin, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { BUSINESS, hhmmToMin, isWeekday, londonWallClockToISO, isoToLondonMin, isoToLondonDate, londonNow, holdReleased } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';

/** A released company hold no longer blocks the room. */
const isReleased = (r, dateStr, nowMin, todayStr) =>
  holdReleased(
    { holdUntil: r.fields[F.bookings.holdUntil], checkedIn: !!r.fields[F.bookings.checkedIn], releasable: !!r.fields[F.bookings.releasable] },
    dateStr,
    nowMin,
    todayStr,
  );

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

function validateSlot(dateStr, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return 'bad-date';
  if (!/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) return 'bad-time';
  // Weekends are allowed for members (outside regular hours) — the member app asks
  // them to confirm. Bank holidays / seasonal closures are still blocked (isClosedDay).
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  if (!(s >= BUSINESS.openMin && e <= BUSINESS.closeMin && s < e)) return 'outside-hours';
  if (s % BUSINESS.slotMin !== 0 || e % BUSINESS.slotMin !== 0) return 'bad-increment';
  return null;
}

/** Confirmed bookings for a space on a date (filters by date+status in Airtable, space in JS). */
async function bookingsForSpaceDate(spaceId, dateStr) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}', {Status}='Confirmed')`,
  });
  return recs.filter((r) => {
    const sp = r.fields[F.bookings.space];
    return Array.isArray(sp) && sp.includes(spaceId);
  });
}

export default async function handler(req) {
  if (!airtableReady()) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const action = url.searchParams.get('action');

    if (action === 'spaces') {
      const recs = await listRecords(T.spaces, { sort: [{ field: 'Order' }] });
      const spaces = recs
        .map((r) => ({
          id: r.id,
          name: r.fields[F.spaces.name],
          type: r.fields[F.spaces.type],
          capacity: r.fields[F.spaces.capacity] ?? null,
          capacityLabel: r.fields[F.spaces.capacityLabel] ?? null,
          bookable: !!r.fields[F.spaces.bookable],
          colour: r.fields[F.spaces.colour] ?? null,
        }))
        .filter((s) => s.bookable);
      return json({ spaces });
    }

    if (action === 'availability') {
      const spaceId = url.searchParams.get('space');
      const dateStr = url.searchParams.get('date');
      if (!spaceId || !dateStr) return json({ error: 'missing-params' }, 400);
      const recs = await bookingsForSpaceDate(spaceId, dateStr);
      const busy = recs.map((r) => ({
        startMin: isoToLondonMin(r.fields[F.bookings.start]),
        endMin: isoToLondonMin(r.fields[F.bookings.end]),
      }));
      return json({ date: dateStr, space: spaceId, openMin: BUSINESS.openMin, closeMin: BUSINESS.closeMin, slotMin: BUSINESS.slotMin, busy });
    }

    if (action === 'today') {
      // Public snapshot for the entrance screen: all spaces + today's confirmed
      // bookings/blocks (no names). The screen computes availability + busyness.
      const today = londonNow();
      const spaceRecs = await listRecords(T.spaces, { sort: [{ field: 'Order' }] });
      const spaces = spaceRecs.map((r) => ({
        id: r.id,
        name: r.fields[F.spaces.name],
        type: r.fields[F.spaces.type],
        capacityLabel: r.fields[F.spaces.capacityLabel] ?? null,
        colour: r.fields[F.spaces.colour] ?? null,
        bookable: !!r.fields[F.spaces.bookable],
      }));
      const recs = await listRecords(T.bookings, {
        filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${today.dateStr}', {Status}='Confirmed')`,
      });
      const bookings = recs
        .filter((r) => !isReleased(r, today.dateStr, today.min, today.dateStr))
        .map((r) => ({
          space: Array.isArray(r.fields[F.bookings.space]) ? r.fields[F.bookings.space][0] : null,
          startMin: isoToLondonMin(r.fields[F.bookings.start]),
          endMin: isoToLondonMin(r.fields[F.bookings.end]),
          kind: r.fields[F.bookings.kind],
        }));
      return json({ date: today.dateStr, nowMin: today.min, spaces, bookings });
    }

    if (action === 'mine') {
      const vm = await verifyMember(tokenFromRequest(req, null));
      if (!vm.ok) return json({ error: vm.reason }, 401);
      // Case-insensitive email match (mirrors checkin.mjs) so a member sees their
      // bookings regardless of how their address was cased when the record was written.
      const email = (memberEmail(vm.member) || '').toLowerCase();
      const today = londonNow().dateStr;
      const recs = await listRecords(T.bookings, {
        filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Confirmed', {Kind}!='Privatisation', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
        sort: [{ field: 'Start' }],
      });
      const mine = recs.map((r) => ({
        id: r.id,
        date: isoToLondonDate(r.fields[F.bookings.date]),
        startMin: isoToLondonMin(r.fields[F.bookings.start]),
        endMin: isoToLondonMin(r.fields[F.bookings.end]),
        space: Array.isArray(r.fields[F.bookings.space]) ? r.fields[F.bookings.space][0] : null,
        title: r.fields[F.bookings.title],
        kind: r.fields[F.bookings.kind],
      }));
      return json({ bookings: mine });
    }

    return json({ error: 'unknown-action' }, 400);
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const email = memberEmail(me);

  if (body.action === 'book') {
    const { spaceId, date, start, end } = body;
    if (!spaceId) return json({ error: 'missing-space' }, 400);
    const err = validateSlot(date, start, end);
    if (err) return json({ error: err }, 400);
    if (await isClosedDay(date)) return json({ error: 'closed-day' }, 400);

    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    const nowC = londonNow();
    const existing = await bookingsForSpaceDate(spaceId, date);
    const clash = existing.some((r) => {
      if (isReleased(r, date, nowC.min, nowC.dateStr)) return false; // a released no-show hold frees the slot
      const rs = isoToLondonMin(r.fields[F.bookings.start]);
      const re = isoToLondonMin(r.fields[F.bookings.end]);
      return s < re && e > rs;
    });
    if (clash) return json({ error: 'slot-taken' }, 409);

    // A member can't hold two rooms at the same time — check their other confirmed
    // bookings that day (any room) for an overlap.
    const mineThatDay = await listRecords(T.bookings, {
      filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}', LOWER({Member email})='${esc((email || '').toLowerCase())}', {Status}='Confirmed')`,
    });
    const selfClash = mineThatDay.some((r) => {
      const rs = isoToLondonMin(r.fields[F.bookings.start]);
      const re = isoToLondonMin(r.fields[F.bookings.end]);
      return s < re && e > rs;
    });
    if (selfClash) return json({ error: 'double-book' }, 409);

    const rec = await createRecord(T.bookings, {
      [F.bookings.title]: `${start}–${end} · ${memberName(me)}`,
      [F.bookings.space]: [spaceId],
      [F.bookings.date]: date,
      [F.bookings.start]: londonWallClockToISO(date, start),
      [F.bookings.end]: londonWallClockToISO(date, end),
      [F.bookings.kind]: 'Member',
      [F.bookings.email]: email,
      [F.bookings.name]: memberName(me),
      [F.bookings.status]: 'Confirmed',
      [F.bookings.source]: 'Web',
    });
    return json({ ok: true, id: rec.id });
  }

  if (body.action === 'cancel') {
    const { bookingId } = body;
    if (!bookingId) return json({ error: 'missing-booking' }, 400);
    const recs = await listRecords(T.bookings, { filterByFormula: `RECORD_ID()='${esc(bookingId)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    if (r.fields[F.bookings.email] !== email && !isAdmin(me)) return json({ error: 'forbidden' }, 403);
    // A member must not self-cancel a PAID booking (Kind 'Company', £90–£240) — cancelling
    // here only sets Status='Cancelled' with no Stripe refund, silently voiding money paid.
    // Paid changes go through ops/refund, not the member dashboard.
    if (r.fields[F.bookings.kind] === 'Company') return json({ error: 'paid-booking' }, 403);
    await updateRecord(T.bookings, bookingId, { [F.bookings.status]: 'Cancelled' });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
