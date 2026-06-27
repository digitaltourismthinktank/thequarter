/**
 * The Quarter — per-room iPad kiosk API (public; member PIN authorises booking).
 *
 * GET  ?action=room&id=<spaceId>   → that room's today status + schedule (no names)
 * POST {action:'book', spaceId, date, start, end, pin}  → book on the spot; the PIN
 *      identifies the member (their dashboard shows it). Source = Kiosk.
 *
 * Note: a 6-digit PIN is low-security (booking a room as someone else is low stakes);
 * fine for a small trusted space. Revisit with signed QR if needed.
 */
import memberstackAdmin from '@memberstack/admin';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, isoToLondonMin, londonWallClockToISO, hhmmToMin, BUSINESS, isWeekday, holdReleased } from './_time.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function memberByPin(pin) {
  if (!MS_SECRET || !pin) return null;
  const admin = memberstackAdmin.init(MS_SECRET);
  let after;
  for (let i = 0; i < 20; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const data = res?.data || [];
    for (const m of data) if (String(m.metaData?.bookingPin) === String(pin)) return m;
    if (!res?.hasNextPage || data.length === 0) break;
    after = res?.endCursor;
  }
  return null;
}

async function bookingsForSpaceDate(spaceId, dateStr) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}', {Status}='Confirmed')`,
  });
  return recs.filter((r) => Array.isArray(r.fields[F.bookings.space]) && r.fields[F.bookings.space].includes(spaceId));
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('action') === 'room') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'missing-id' }, 400);
    const today = londonNow();
    const spaceRecs = await listRecords(T.spaces);
    const sp = spaceRecs.find((r) => r.id === id);
    if (!sp) return json({ error: 'not-found' }, 404);
    const recs = await bookingsForSpaceDate(id, today.dateStr);
    const bookings = recs
      .map((r) => {
        const f = r.fields;
        const hold = { holdUntil: f[F.bookings.holdUntil], checkedIn: !!f[F.bookings.checkedIn], releasable: !!f[F.bookings.releasable] };
        return {
          id: r.id,
          startMin: isoToLondonMin(f[F.bookings.start]),
          endMin: isoToLondonMin(f[F.bookings.end]),
          kind: f[F.bookings.kind],
          company: f[F.bookings.company] || null,
          holdUntil: f[F.bookings.holdUntil] || null,
          checkedIn: hold.checkedIn,
          releasable: hold.releasable,
          released: holdReleased(hold, today.dateStr, today.min, today.dateStr),
        };
      })
      .sort((a, b) => a.startMin - b.startMin);
    return json({
      date: today.dateStr,
      nowMin: today.min,
      weekday: isWeekday(today.dateStr),
      openMin: BUSINESS.openMin,
      closeMin: BUSINESS.closeMin,
      space: {
        id: sp.id,
        name: sp.fields[F.spaces.name],
        type: sp.fields[F.spaces.type],
        capacityLabel: sp.fields[F.spaces.capacityLabel] ?? null,
        bookable: !!sp.fields[F.spaces.bookable],
      },
      bookings,
    });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));

  // Door check-in for a company hold — a warm tap to keep the room (no login).
  if (body.action === 'checkinBooking') {
    if (!body.bookingId) return json({ error: 'missing-id' }, 400);
    await updateRecord(T.bookings, body.bookingId, { [F.bookings.checkedIn]: true });
    return json({ ok: true });
  }

  if (body.action === 'book') {
    const { spaceId, date, start, end, pin } = body;
    if (!spaceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '') || !pin) {
      return json({ error: 'missing-or-bad-params' }, 400);
    }
    if (!isWeekday(date)) return json({ error: 'closed-weekend' }, 400);
    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    if (!(s >= BUSINESS.openMin && e <= BUSINESS.closeMin && s < e)) return json({ error: 'outside-hours' }, 400);

    const m = await memberByPin(pin);
    if (!m) return json({ error: 'bad-pin' }, 403);

    const existing = await bookingsForSpaceDate(spaceId, date);
    const clash = existing.some((r) => {
      const rs = isoToLondonMin(r.fields[F.bookings.start]);
      const re = isoToLondonMin(r.fields[F.bookings.end]);
      return s < re && e > rs;
    });
    if (clash) return json({ error: 'slot-taken' }, 409);

    const email = m.auth?.email || m.email || null;
    const cf = m.customFields || {};
    const name = [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || email || 'Member';
    const rec = await createRecord(T.bookings, {
      [F.bookings.title]: `${start}–${end} · ${name}`,
      [F.bookings.space]: [spaceId],
      [F.bookings.date]: date,
      [F.bookings.start]: londonWallClockToISO(date, start),
      [F.bookings.end]: londonWallClockToISO(date, end),
      [F.bookings.kind]: 'Member',
      [F.bookings.email]: email,
      [F.bookings.name]: name,
      [F.bookings.status]: 'Confirmed',
      [F.bookings.source]: 'Kiosk',
    });
    return json({ ok: true, id: rec.id, member: name });
  }

  return json({ error: 'unknown-action' }, 400);
}
