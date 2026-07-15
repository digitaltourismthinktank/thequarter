/**
 * The Quarter — native meeting-room booking + payment (public, paid).
 *
 * The marketing meeting rooms (The Knight's Tale, The Chapter House) and the phone
 * pods (The Bell Tower, The Scriptorium) can be booked and paid for by ANYONE — no
 * membership needed. The flow is company-led:
 *
 *   POST {action:'quote',  spaceId, date, pkg, people, lunch}      → { amountPence, lines, start, end }
 *   POST {action:'intent', spaceId, date, pkg, people, lunch,
 *         company, name, email}                                     → { clientSecret, amountPence, lines }
 *
 * Price is ALWAYS computed here from the space's own record (never trusted from the
 * client). The Airtable booking is created by the Stripe webhook on
 * payment_intent.succeeded (metadata.kind==='room-booking') so a booking only ever
 * exists once money is taken. Apple Pay + cards come from automatic_payment_methods.
 *
 * ASSUMPTIONS (flagged for Nick's review):
 *  - Members pay the same listed price (no free/included meeting-room time wired).
 *  - Packages: am 09:00–13:00, pm 13:30–17:30, full 09:00–17:30. Pods book a single
 *    hour at the £21.60 day-pass rate (no lunch, no quiet-day discount).
 *  - Quiet-day 20% off HIRE on Mon/Wed/Fri (meeting rooms only); lunch stays full.
 *
 * Env: STRIPE_SECRET_KEY (PaymentIntents: Write), Airtable (via _airtable).
 */
import { listRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { BUSINESS, hhmmToMin, londonWallClockToISO, isoToLondonMin, londonNow } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';

/** Default free meeting-room hours per member per calendar month (overridable per
 *  member via metaData.meetingRoomHoursCap). Pods are free + never counted here. */
const DEFAULT_FREE_HOURS = 4;

/** Free meeting-room hours belong to a PLAN. A member with no plan connection (pay-as-you-go
 *  account) earns no free hours — they pay (and earn the give-back) like a guest. Mirrors the
 *  dashboard's `(member.planConnections?.length ?? 0) > 0` signal exactly. */
const hasPlan = (m) => (m?.planConnections?.length ?? 0) > 0;

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

// --- Pricing (£, inc VAT). Names normalised so a straight/curly apostrophe or
//     case difference in Airtable never breaks the match. ---------------------
const norm = (s) => String(s ?? '').toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();
const ROOM_PRICE = {
  "the knight's tale": { half: 144, full: 240 },
  'the chapter house': { half: 90, full: 150 },
};
const POD_RATE = 21.6;
const LUNCH_PER_HEAD = 12;
const QUIET_DAYS = [1, 3, 5]; // Mon, Wed, Fri (0=Sun)
const QUIET_DISCOUNT = 0.2;

const PACKAGES = {
  am: { label: 'Morning · 09:00–13:00', start: '09:00', end: '13:00', span: 'half' },
  pm: { label: 'Afternoon · 13:30–17:30', start: '13:30', end: '17:30', span: 'half' },
  full: { label: 'Full day · 09:00–17:30', start: '09:00', end: '17:30', span: 'full' },
};

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

/** London weekday (0=Sun) for a YYYY-MM-DD date — stable regardless of server TZ. */
const weekdayOf = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

async function getSpace(spaceId) {
  const recs = await listRecords(T.spaces, { filterByFormula: `RECORD_ID()='${esc(spaceId)}'`, maxRecords: 1 });
  const r = recs[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.fields[F.spaces.name],
    type: r.fields[F.spaces.type] || '',
    bookable: !!r.fields[F.spaces.bookable],
  };
}

/** Confirmed bookings for a space on a date (date+status in Airtable, space in JS). */
async function bookingsForSpaceDate(spaceId, dateStr) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}', {Status}='Confirmed')`,
  });
  return recs.filter((r) => {
    const sp = r.fields[F.bookings.space];
    return Array.isArray(sp) && sp.includes(spaceId);
  });
}

/**
 * Resolve the time window + price for a request. Returns { error } or
 * { start, end, amountPence, lines, span, isPod }.
 */
function priceRequest(space, { date, pkg, people, lunch }) {
  const isPod = /pod/.test(norm(space.type));
  const heads = Math.max(1, Math.min(50, Number(people) || 1));
  const lines = [];

  let start;
  let end;
  let hire = 0;

  if (isPod) {
    // Pods: a single hour at the day-pass rate. pkg carries the start hour "HH:MM".
    start = /^\d{2}:\d{2}$/.test(pkg) ? pkg : '09:00';
    end = `${String(hhmmToMin(start) / 60 + 1).padStart(2, '0')}:00`;
    hire = POD_RATE;
    lines.push({ label: `${space.name} · ${start}–${end}`, amount: POD_RATE });
  } else {
    const p = PACKAGES[pkg];
    if (!p) return { error: 'bad-package' };
    const price = ROOM_PRICE[norm(space.name)];
    if (!price) return { error: 'no-price' };
    start = p.start;
    end = p.end;
    hire = p.span === 'full' ? price.full : price.half;
    const quiet = QUIET_DAYS.includes(weekdayOf(date));
    lines.push({ label: `${space.name} · ${p.label}`, amount: hire });
    if (quiet) {
      const off = round2(hire * QUIET_DISCOUNT);
      hire = round2(hire - off);
      lines.push({ label: 'Quiet-day discount (20%)', amount: -off });
    }
    if (lunch) {
      const lunchTotal = round2(heads * LUNCH_PER_HEAD);
      lines.push({ label: `Lunch · ${heads} × £${LUNCH_PER_HEAD}`, amount: lunchTotal });
    }
  }

  const total = lines.reduce((a, l) => a + l.amount, 0);
  return { start, end, span: isPod ? 'pod' : PACKAGES[pkg]?.span, isPod, amountPence: Math.round(round2(total) * 100), lines };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Slot must be a weekday, within hours, on the grid, and not a closed day. */
async function validate(date, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'bad-date';
  const dow = weekdayOf(date);
  if (dow === 0 || dow === 6) return 'weekend'; // paid rooms are Mon–Fri only
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  if (!(s >= BUSINESS.openMin && e <= BUSINESS.closeMin && s < e)) return 'outside-hours';
  if (await isClosedDay(date)) return 'closed-day';
  return null;
}

async function isFree(spaceId, date, start, end) {
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  const existing = await bookingsForSpaceDate(spaceId, date);
  return !existing.some((r) => {
    const rs = isoToLondonMin(r.fields[F.bookings.start]);
    const re = isoToLondonMin(r.fields[F.bookings.end]);
    return s < re && e > rs;
  });
}

/** Hours the member has already booked in MEETING ROOMS (pods excluded) this calendar month. */
async function monthlyMeetingRoomHours(email, dateStr) {
  const ym = dateStr.slice(0, 7); // YYYY-MM
  const spaces = await listRecords(T.spaces, {});
  const meetingIds = new Set(spaces.filter((r) => !/pod/.test(norm(r.fields[F.spaces.type] || ''))).map((r) => r.id));
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(LOWER({Member email})='${esc((email || '').toLowerCase())}', {Status}='Confirmed', DATETIME_FORMAT({Date}, 'YYYY-MM')='${esc(ym)}')`,
  });
  let hours = 0;
  for (const r of recs) {
    const sp = r.fields[F.bookings.space];
    if (!Array.isArray(sp) || !sp.length || !meetingIds.has(sp[0])) continue;
    // Only FREE member bookings consume the monthly allowance. A member's PAID booking
    // (kind 'Company') now carries their member email, so guard against it eating free hours.
    if (r.fields[F.bookings.kind] !== 'Member') continue;
    const s = isoToLondonMin(r.fields[F.bookings.start]);
    const e = isoToLondonMin(r.fields[F.bookings.end]);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) hours += (e - s) / 60;
  }
  return hours;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!STRIPE_SECRET || !airtableReady()) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const { action, spaceId, date, pkg, people, lunch } = body;

  // Member's free-hours status for the month (drives the free-vs-pay UI). No room needed.
  if (action === 'member-status') {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: 'auth' }, 401);
    const me = vm.member;
    const cap = Number(me?.metaData?.meetingRoomHoursCap) || DEFAULT_FREE_HOURS;
    // No plan → no free hours: report remaining:0 so the client's freeEligible is false and the
    // member is routed to the paid path (where they still earn the give-back).
    if (!hasPlan(me)) return json({ capHours: cap, usedHours: 0, remaining: 0 });
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);
    const used = await monthlyMeetingRoomHours(memberEmail(me), ref);
    return json({ capHours: cap, usedHours: round2(used), remaining: round2(Math.max(0, cap - used)) });
  }

  if (!spaceId || !date) return json({ error: 'missing-params' }, 400);

  const space = await getSpace(spaceId);
  if (!space || !space.bookable) return json({ error: 'no-space' }, 404);

  const priced = priceRequest(space, { date, pkg, people, lunch });
  if (priced.error) return json({ error: priced.error }, 400);

  // Meeting-room RECORD window: honour the caller's explicit start/end (the real
  // slot chosen in the picker) so the saved booking shows the true times. The
  // AMOUNT stays package-priced above (client can't move the £). Pods keep their
  // computed single-hour window.
  if (!priced.isPod) {
    const rs = String(body.start || '');
    const re = String(body.end || '');
    if (/^\d{2}:\d{2}$/.test(rs) && /^\d{2}:\d{2}$/.test(re) && hhmmToMin(re) > hhmmToMin(rs)) {
      priced.start = rs;
      priced.end = re;
    }
  }

  const invalid = await validate(date, priced.start, priced.end);
  if (invalid) return json({ error: invalid }, 400);

  if (!(await isFree(spaceId, date, priced.start, priced.end))) return json({ error: 'slot-taken' }, 409);

  if (action === 'quote') {
    return json({ amountPence: priced.amountPence, lines: priced.lines, start: priced.start, end: priced.end });
  }

  if (action === 'intent') {
    const email = String(body.email || '').trim();
    const name = String(body.name || '').trim();
    const company = String(body.company || '').trim();
    const jobTitle = String(body.jobTitle || '').trim();
    const phone = String(body.phone || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad-email' }, 400);
    if (!company) return json({ error: 'missing-company' }, 400);
    if (priced.amountPence < 100) return json({ error: 'bad-amount' }, 400);

    // Best-effort member resolution: attach the payer's member id/email to the PI metadata so
    // the webhook awards the spend give-back and links the booking to them. NEVER hard-fails —
    // a guest (no/invalid token) simply carries no member metadata and pays exactly as before.
    const vm = await verifyMember(tokenFromRequest(req, body));
    const memberMeta = vm.ok ? { 'metadata[memberId]': vm.member.id, 'metadata[memberEmail]': memberEmail(vm.member) || '' } : {};

    const pi = await stripe('/v1/payment_intents', 'POST', {
      amount: String(priced.amountPence),
      currency: 'gbp',
      'payment_method_types[0]': 'card',
      receipt_email: email,
      description: `${space.name} — ${date} (${company})`,
      'metadata[kind]': 'room-booking',
      'metadata[spaceId]': spaceId,
      'metadata[spaceName]': space.name || '',
      'metadata[date]': date,
      'metadata[start]': priced.start,
      'metadata[end]': priced.end,
      'metadata[people]': String(Math.max(1, Number(people) || 1)),
      'metadata[lunch]': lunch ? 'yes' : 'no',
      'metadata[company]': company,
      'metadata[name]': name,
      'metadata[jobTitle]': jobTitle,
      'metadata[phone]': phone,
      'metadata[email]': email,
      ...memberMeta,
    });
    if (pi?.error || !pi?.client_secret) return json({ error: 'stripe', detail: pi?.error?.message }, 502);
    return json({ clientSecret: pi.client_secret, amountPence: priced.amountPence, lines: priced.lines, start: priced.start, end: priced.end });
  }

  // Members book the two main meeting rooms free, up to their monthly hours cap
  // (metaData.meetingRoomHoursCap, default 4). Pods are free + never counted here.
  if (action === 'member-free') {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: 'auth' }, 401);
    const me = vm.member;
    // Free bookings (rooms and pods) are a membership benefit — a no-plan account can't take one.
    // The client routes them to the paid intent instead (where they still earn the give-back).
    if (!hasPlan(me)) return json({ error: 'no-plan' }, 400);
    const email = memberEmail(me);
    const hours = round2((hhmmToMin(priced.end) - hhmmToMin(priced.start)) / 60);
    // Pods are free + uncapped for members; meeting rooms enforce the monthly cap.
    let cap = null;
    let used = null;
    if (!priced.isPod) {
      cap = Number(me?.metaData?.meetingRoomHoursCap) || DEFAULT_FREE_HOURS;
      used = await monthlyMeetingRoomHours(email, date);
      if (used + hours > cap + 1e-6) {
        return json({ error: 'cap-exceeded', capHours: cap, usedHours: round2(used), remaining: round2(Math.max(0, cap - used)) });
      }
    }
    const rec = await createRecord(
      T.bookings,
      {
        [F.bookings.title]: `${priced.start}–${priced.end} · ${memberName(me)}`,
        [F.bookings.space]: [spaceId],
        [F.bookings.date]: date,
        [F.bookings.start]: londonWallClockToISO(date, priced.start),
        [F.bookings.end]: londonWallClockToISO(date, priced.end),
        [F.bookings.kind]: 'Member',
        [F.bookings.email]: email,
        [F.bookings.name]: memberName(me),
        [F.bookings.status]: 'Confirmed',
        [F.bookings.source]: 'Web',
        [F.bookings.notes]: priced.isPod ? `Member pod booking · ${hours}h` : `Member free booking · ${hours}h (cap ${cap})`,
      },
      { typecast: true },
    );
    return json({ ok: true, id: rec?.id || null, remaining: cap != null ? round2(Math.max(0, cap - used - hours)) : null, capHours: cap });
  }

  return json({ error: 'unknown-action' }, 400);
}

// Exported for the webhook so it finalises bookings with the same field mapping.
export { londonWallClockToISO };
