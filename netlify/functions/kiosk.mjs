/**
 * The Quarter — per-room iPad kiosk API (public; member PIN authorises booking).
 *
 * GET  ?action=room&id=<spaceId>   → that room's today status + schedule (no names)
 * GET  ?action=memberSearch&q=     → privacy-safe name search ({id,name} only, >=2 chars, capped)
 * POST {action:'book', spaceId, date, start, end, pin}  → book on the spot; the PIN
 *      identifies the member (their dashboard shows it). Source = Kiosk.
 * POST {action:'bookFor', spaceId, date, start, end, memberId}  → on-screen reserve attributed
 *      by member LOOKUP (floor-screen panel; no PIN). Source = Kiosk.
 * POST {action:'checkinBooking', bookingId}  → check a booking/hold in (keeps the room).
 *
 * Note: a 6-digit PIN is low-security (booking a room as someone else is low stakes);
 * fine for a small trusted space. Revisit with signed QR if needed.
 */
import memberstackAdmin from '@memberstack/admin';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, isoToLondonMin, londonWallClockToISO, hhmmToMin, minToHHMM, BUSINESS, isWeekday, roomBookingReleased, ROOM_HOLD_GRACE_MIN } from './_time.mjs';

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

/** Room/pod auto-release check for an Airtable booking record (default 15-min grace). */
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

/**
 * Privacy-safe member name search for the on-screen (kiosk / floor-screen) picker.
 * Requires >= 2 chars, matches on name (or email), caps results, and returns ONLY
 * { id, name } — never a browsable full list, no email/company/plan leaked.
 */
async function searchMembers(q, cap = 8) {
  const needle = String(q || '').trim().toLowerCase();
  if (!MS_SECRET || needle.length < 3) return [];
  const admin = memberstackAdmin.init(MS_SECRET);
  const out = [];
  let after;
  for (let i = 0; i < 20 && out.length < cap; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const data = res?.data || [];
    for (const m of data) {
      const cf = m.customFields || {};
      const name = [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim();
      if (!name) continue;
      const email = m.auth?.email || m.email || '';
      if (`${name} ${email}`.toLowerCase().includes(needle)) {
        out.push({ id: m.id, name });
        if (out.length >= cap) break;
      }
    }
    if (!res?.hasNextPage || data.length === 0) break;
    after = res?.endCursor;
  }
  return out;
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET' && url.searchParams.get('action') === 'memberSearch') {
    const q = url.searchParams.get('q') || '';
    if (q.trim().length < 3) return json({ members: [] });
    return json({ members: await searchMembers(q, 8) });
  }

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
          released: roomReleased(r, today.dateStr, today.min, today.dateStr),
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

  // Door check-in for a booking/hold — a warm tap to keep the room (no login).
  if (body.action === 'checkinBooking') {
    if (!body.bookingId) return json({ error: 'missing-id' }, 400);
    await updateRecord(T.bookings, body.bookingId, { [F.bookings.checkedIn]: true });
    return json({ ok: true });
  }

  // On-screen reserve attributed by member LOOKUP (not PIN). Used by the floor-screen panel:
  // staff/member picks a name from the privacy-safe search, then books the room now.
  if (body.action === 'bookFor') {
    const { spaceId, date, start, end, memberId } = body;
    if (!spaceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '') || !memberId) {
      return json({ error: 'missing-or-bad-params' }, 400);
    }
    if (!isWeekday(date)) return json({ error: 'closed-weekend' }, 400);
    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    if (!(s >= BUSINESS.openMin && e <= BUSINESS.closeMin && s < e)) return json({ error: 'outside-hours' }, 400);

    const admin = memberstackAdmin.init(MS_SECRET);
    let m = null;
    try {
      const r = await admin.members.retrieve({ id: memberId });
      m = r?.data || null;
    } catch {
      m = null;
    }
    if (!m) return json({ error: 'unknown-member' }, 404);

    const now = londonNow();
    const existing = await bookingsForSpaceDate(spaceId, date);
    const clash = existing.some((r) => {
      if (roomReleased(r, date, now.min, now.dateStr)) return false; // a released no-show hold frees the slot
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
      // On-the-spot floor/kiosk reservation: releasable so it frees the room if the person
      // doesn't check in by their release time (ROOM_HOLD_GRACE_MIN after start).
      [F.bookings.releasable]: true,
      [F.bookings.holdUntil]: minToHHMM(s + ROOM_HOLD_GRACE_MIN),
    });
    return json({ ok: true, id: rec.id, member: name });
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
      // On-the-spot floor/kiosk reservation: releasable so it frees the room if the person
      // doesn't check in by their release time (ROOM_HOLD_GRACE_MIN after start).
      [F.bookings.releasable]: true,
      [F.bookings.holdUntil]: minToHHMM(s + ROOM_HOLD_GRACE_MIN),
    });
    return json({ ok: true, id: rec.id, member: name });
  }

  return json({ error: 'unknown-action' }, 400);
}
