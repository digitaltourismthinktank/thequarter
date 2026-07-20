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
import { BUSINESS, hhmmToMin, isWeekday, londonWallClockToISO, isoToLondonMin, isoToLondonDate, londonNow, holdReleased, roomBookingReleased } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';
import { isRecurringBlockRule, recurringBlockOccurrences, parsePrivatisationSlots, isPrivatisedOn } from './_privatisation.mjs';
import { notifyAdmins, fmtDateTime, dayBar } from './_email.mjs';
import { canBook } from './_entitlement.mjs';

/** A released company hold no longer blocks the room. */
const isReleased = (r, dateStr, nowMin, todayStr) =>
  holdReleased(
    { holdUntil: r.fields[F.bookings.holdUntil], checkedIn: !!r.fields[F.bookings.checkedIn], releasable: !!r.fields[F.bookings.releasable] },
    dateStr,
    nowMin,
    todayStr,
  );

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

/**
 * Per-floor screen map for /screen?floor=1|2. Keyed by the Space name in Airtable,
 * matched case-, whitespace- AND apostrophe-insensitively (curly ’ and straight '
 * both normalise to a straight quote — see normSpaceName). A name absent from the
 * map resolves to floor null and is excluded from BOTH floor screens (e.g. the
 * downstairs/outdoor "Dane John Gardens").
 */
const SPACE_FLOORS = {
  "the knight's tale": 1,
  'the chapter house': 2,
  'the bell tower': 2,
  'the scriptorium': 2,
  'the hop yard': 2,
  'the vineyard': 2,
};
const normSpaceName = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[‘’ʼ′]/g, "'") // curly / modifier / prime apostrophes → straight '
    .replace(/\s+/g, ' ');
const floorForName = (name) => SPACE_FLOORS[normSpaceName(name)] ?? null;

/** Field-agnostic room/pod auto-release check for an Airtable booking record. */
const roomReleased = (r, dateStr, nowMin, todayStr) =>
  roomBookingReleased(
    {
      kind: r.fields[F.bookings.kind],
      holdUntil: r.fields[F.bookings.holdUntil],
      checkedIn: !!r.fields[F.bookings.checkedIn],
      releasable: !!r.fields[F.bookings.releasable],
      startMin: isoToLondonMin(r.fields[F.bookings.start]),
    },
    dateStr,
    nowMin,
    todayStr,
  );

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

/**
 * Confirmed bookings occupying a space on a date. Concrete dated rows are filtered by date+status
 * in Airtable (space matched in JS). Indefinite recurring-Block RULE rows live only on their start
 * date, so they're excluded here and expanded separately (recurringBlockOccurrences) — this makes
 * a recurring block occupy the room on EVERY future weekday, blocking member double-booking too.
 */
/** The display name of a space by record id (for emails). Best-effort → 'Room'. */
async function spaceNameById(spaceId) {
  try {
    const recs = await listRecords(T.spaces, { filterByFormula: `RECORD_ID()='${esc(spaceId)}'`, maxRecords: 1 });
    return recs[0]?.fields[F.spaces.name] || 'Room';
  } catch {
    return 'Room';
  }
}

async function bookingsForSpaceDate(spaceId, dateStr) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}', {Status}='Confirmed')`,
  });
  const dated = recs.filter((r) => {
    if (isRecurringBlockRule(r)) return false; // rule rows expand via recurringBlockOccurrences
    const sp = r.fields[F.bookings.space];
    return Array.isArray(sp) && sp.includes(spaceId);
  });
  // Expand indefinite recurring blocks falling on this date. Block rules are few, so fetching all
  // Confirmed blocks (mirrors admin's privatisation approach) is cheap. Each occurrence is the
  // rule's own record: isoToLondonMin(Start/End) gives the right window on any date, and it carries
  // no holdUntil so isReleased() treats it as firmly busy.
  const blockRecs = await listRecords(T.bookings, {
    filterByFormula: `AND({Status}='Confirmed', OR({Kind}='Block', {Kind}='External'))`,
  });
  const occ = recurringBlockOccurrences(blockRecs, dateStr)
    .map((o) => o.record)
    .filter((r) => {
      const sp = r.fields[F.bookings.space];
      return Array.isArray(sp) && sp.includes(spaceId);
    });
  return [...dated, ...occ];
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
          floor: floorForName(r.fields[F.spaces.name]),
        }))
        .filter((s) => s.bookable);
      return json({ spaces });
    }

    if (action === 'availability') {
      const spaceId = url.searchParams.get('space');
      const dateStr = url.searchParams.get('date');
      if (!spaceId || !dateStr) return json({ error: 'missing-params' }, 400);
      const recs = await bookingsForSpaceDate(spaceId, dateStr);
      const nowA = londonNow();
      const busy = recs
        // A released, un-checked-in room/pod hold frees the slot for everyone.
        .filter((r) => !roomReleased(r, dateStr, nowA.min, nowA.dateStr))
        .map((r) => ({
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
        floor: floorForName(r.fields[F.spaces.name]),
      }));
      const recs = await listRecords(T.bookings, {
        filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${today.dateStr}', {Status}='Confirmed')`,
      });
      // Expand indefinite recurring-Block rules so a block that started on an earlier date still
      // shows the room as occupied today. Rules live on their start date (so they're absent from
      // `recs` and excluded below); fetch all Confirmed blocks and re-add today's occurrences.
      const blockRecs = await listRecords(T.bookings, {
        filterByFormula: `AND({Status}='Confirmed', OR({Kind}='Block', {Kind}='External'))`,
      });
      const occRecs = recurringBlockOccurrences(blockRecs, today.dateStr).map((o) => o.record);
      const bookings = recs
        .filter((r) => !isRecurringBlockRule(r) && !isReleased(r, today.dateStr, today.min, today.dateStr))
        .concat(occRecs)
        .map((r) => ({
          space: Array.isArray(r.fields[F.bookings.space]) ? r.fields[F.bookings.space][0] : null,
          startMin: isoToLondonMin(r.fields[F.bookings.start]),
          endMin: isoToLondonMin(r.fields[F.bookings.end]),
          kind: r.fields[F.bookings.kind],
        }));
      return json({ date: today.dateStr, nowMin: today.min, spaces, bookings });
    }

    if (action === 'floor') {
      // Dedicated per-floor room-availability display (/screen?floor=1|2). Unlike the
      // entrance `today` snapshot, this INCLUDES booker names (on-site wall display) so
      // rooms can show "Reserved for <name>" and workspaces "Privatised for <name>".
      const floorNum = Number(url.searchParams.get('floor'));
      if (floorNum !== 1 && floorNum !== 2) return json({ error: 'bad-floor' }, 400);
      const today = londonNow();
      const spaceRecs = await listRecords(T.spaces, { sort: [{ field: 'Order' }] });
      const spaces = spaceRecs
        .map((r) => ({
          id: r.id,
          name: r.fields[F.spaces.name],
          type: r.fields[F.spaces.type],
          capacity: r.fields[F.spaces.capacity] ?? null,
          capacityLabel: r.fields[F.spaces.capacityLabel] ?? null,
          bookable: !!r.fields[F.spaces.bookable],
          floor: floorForName(r.fields[F.spaces.name]),
        }))
        .filter((s) => s.floor === floorNum);
      const spaceIds = new Set(spaces.map((s) => s.id));

      // Today's timed room/pod bookings (+ expanded indefinite recurring-Block occurrences),
      // scoped to this floor. Privatisation markers + recurring-rule rows are handled separately.
      const recs = await listRecords(T.bookings, {
        filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${today.dateStr}', {Status}='Confirmed')`,
        sort: [{ field: 'Start' }],
      });
      const blockRecs = await listRecords(T.bookings, {
        filterByFormula: `AND({Status}='Confirmed', OR({Kind}='Block', {Kind}='External'))`,
      });
      const occRecs = recurringBlockOccurrences(blockRecs, today.dateStr).map((o) => o.record);
      const bookings = recs
        .filter((r) => r.fields[F.bookings.kind] !== 'Privatisation' && !isRecurringBlockRule(r))
        .concat(occRecs)
        .map((r) => ({ r, sp: Array.isArray(r.fields[F.bookings.space]) ? r.fields[F.bookings.space][0] : null }))
        .filter(({ sp }) => sp && spaceIds.has(sp))
        .map(({ r, sp }) => ({
          id: r.id,
          space: sp,
          startMin: isoToLondonMin(r.fields[F.bookings.start]),
          endMin: isoToLondonMin(r.fields[F.bookings.end]),
          kind: r.fields[F.bookings.kind],
          name: r.fields[F.bookings.name] || r.fields[F.bookings.company] || null,
          released: roomReleased(r, today.dateStr, today.min, today.dateStr),
        }));

      // All-day workspace privatisations occupying a floor space today (carry the company/name).
      const privRecs = await listRecords(T.bookings, {
        filterByFormula: `AND({Status}='Confirmed', {Kind}='Privatisation')`,
      });
      const privatisations = [];
      for (const r of privRecs) {
        const f = r.fields;
        const parsed = parsePrivatisationSlots(f[F.bookings.notes] || '');
        if (!parsed) continue;
        const startDate = isoToLondonDate(f[F.bookings.date]) || '';
        if (!isPrivatisedOn(today.dateStr, parsed.cadence, parsed.weekdays, startDate)) continue;
        const sp = Array.isArray(f[F.bookings.space]) ? f[F.bookings.space][0] : null;
        if (!sp || !spaceIds.has(sp)) continue;
        privatisations.push({ space: sp, name: f[F.bookings.company] || f[F.bookings.name] || null });
      }

      return json({
        date: today.dateStr,
        nowMin: today.min,
        weekday: isWeekday(today.dateStr),
        openMin: BUSINESS.openMin,
        closeMin: BUSINESS.closeMin,
        slotMin: BUSINESS.slotMin,
        spaces,
        bookings,
        privatisations,
      });
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

    // Entitlement. This endpoint used to check nothing beyond a valid token, so a day-pass
    // visitor with no plan booked meeting rooms for a day he had not bought, and plan members
    // could sail past their monthly cap by booking here rather than on the public page.
    const spaceRecs = await listRecords(T.spaces, { filterByFormula: `RECORD_ID()='${esc(spaceId)}'`, maxRecords: 1 });
    const spaceRec = spaceRecs[0];
    if (!spaceRec) return json({ error: 'missing-space' }, 400);
    const gate = await canBook({ member: me, email, spaceRec, dateStr: date, startMin: s, endMin: e });
    if (!gate.ok) return json(gate, 403);

    const nowC = londonNow();
    const existing = await bookingsForSpaceDate(spaceId, date);
    const clash = existing.some((r) => {
      if (roomReleased(r, date, nowC.min, nowC.dateStr)) return false; // a released no-show hold frees the slot
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
    // Tell ops a room/pod was just booked (best-effort — never blocks the booking).
    // Shows the room name, a European long date + time, the member's NAME (email kept
    // secondary), and a little bar of where the booking sits in the day.
    const spaceName = await spaceNameById(spaceId);
    await notifyAdmins('Room/pod booked', `${memberName(me)} · ${spaceName} · ${fmtDateTime(date, start, end)}`, {
      link: '/admin/#rooms',
      rows: [
        ['Room', spaceName],
        ['When', fmtDateTime(date, start, end)],
        ['Member', memberName(me)],
        ...(email ? [['Email', email]] : []),
      ],
      extraHtml: dayBar(s, e),
    });
    return json({ ok: true, id: rec.id });
  }

  // Amend a booking's date/time IN PLACE (same room) — so a member can move a booking
  // instead of cancelling and re-making it. Same clash rules as booking, but the booking
  // being moved is excluded from the checks. Paid bookings move via ops (money), not here.
  if (body.action === 'amend') {
    const { bookingId, date, start, end } = body;
    if (!bookingId) return json({ error: 'missing-booking' }, 400);
    const err = validateSlot(date, start, end);
    if (err) return json({ error: err }, 400);
    const recs = await listRecords(T.bookings, { filterByFormula: `RECORD_ID()='${esc(bookingId)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    const admin = isAdmin(me);
    const ownerEmail = String(r.fields[F.bookings.email] || '').toLowerCase();
    if (ownerEmail !== String(email || '').toLowerCase() && !admin) return json({ error: 'forbidden' }, 403);
    if (r.fields[F.bookings.kind] === 'Company' && !admin) return json({ error: 'paid-booking' }, 403);
    if (isRecurringBlockRule(r)) return json({ error: 'recurring-booking' }, 400);
    if (await isClosedDay(date)) return json({ error: 'closed-day' }, 400);
    const sp = r.fields[F.bookings.space];
    const spaceId = Array.isArray(sp) && sp.length ? sp[0] : null;
    if (!spaceId) return json({ error: 'no-space' }, 400);

    const s = hhmmToMin(start);
    const e = hhmmToMin(end);

    // Amending is booking again — without this, a member could book inside their allowance
    // and then stretch the same booking to any length. Admins are exempt (they already
    // amend paid bookings), and the booking being moved is excluded from the month's usage
    // so it isn't counted against the member twice.
    if (!admin) {
      const spaceRecs = await listRecords(T.spaces, { filterByFormula: `RECORD_ID()='${esc(spaceId)}'`, maxRecords: 1 });
      const spaceRec = spaceRecs[0];
      if (!spaceRec) return json({ error: 'no-space' }, 400);
      const gate = await canBook({ member: me, email, spaceRec, dateStr: date, startMin: s, endMin: e, excludeBookingId: bookingId });
      if (!gate.ok) return json(gate, 403);
    }

    const nowC = londonNow();
    const existing = await bookingsForSpaceDate(spaceId, date);
    const clash = existing.some((x) => {
      if (x.id === bookingId) return false; // ignore the booking we're moving
      if (roomReleased(x, date, nowC.min, nowC.dateStr)) return false;
      const rs = isoToLondonMin(x.fields[F.bookings.start]);
      const re = isoToLondonMin(x.fields[F.bookings.end]);
      return s < re && e > rs;
    });
    if (clash) return json({ error: 'slot-taken' }, 409);

    const mineThatDay = await listRecords(T.bookings, {
      filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}', LOWER({Member email})='${esc(ownerEmail)}', {Status}='Confirmed')`,
    });
    const selfClash = mineThatDay.some((x) => {
      if (x.id === bookingId) return false;
      const rs = isoToLondonMin(x.fields[F.bookings.start]);
      const re = isoToLondonMin(x.fields[F.bookings.end]);
      return s < re && e > rs;
    });
    if (selfClash) return json({ error: 'double-book' }, 409);

    const nm = r.fields[F.bookings.name] || memberName(me);
    await updateRecord(T.bookings, bookingId, {
      [F.bookings.date]: date,
      [F.bookings.start]: londonWallClockToISO(date, start),
      [F.bookings.end]: londonWallClockToISO(date, end),
      [F.bookings.title]: `${start}–${end} · ${nm}`,
    });
    const spaceName = await spaceNameById(spaceId);
    await notifyAdmins('Booking amended', `${nm} · ${spaceName} · ${fmtDateTime(date, start, end)}`, {
      link: '/admin/#rooms',
      rows: [
        ['Room', spaceName],
        ['New time', fmtDateTime(date, start, end)],
        ['Member', nm],
      ],
      extraHtml: dayBar(s, e),
    });
    return json({ ok: true });
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
