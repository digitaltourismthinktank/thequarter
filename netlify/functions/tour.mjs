/**
 * The Quarter — book a tour (public, free).
 *
 * People who want to see the space before joining pick a weekday slot. Tours run
 * 09:30–17:00, Monday–Friday, in 30-minute slots, and are ALWAYS available unless
 * staff have blocked that time (a kind:'Block' booking overlapping it) or it's a
 * closed day. Booking creates a kind:'Tour' record and emails the visitor + ops.
 *
 *   GET  ?date=YYYY-MM-DD                       → { date, slots:[{time,available}], closed? }
 *   POST { date, time, name, email, phone?, notes? } → { ok }
 *
 * Env: Airtable (via _airtable), RESEND_API_KEY (via _email).
 */
import { listRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonWallClockToISO, isoToLondonMin, hhmmToMin } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';
import { pushToEmail } from './_push.mjs';

const OPEN = 570; // 09:30
const LAST = 990; // 16:30 (last tour start; a 30-min tour ends by 17:00)
const STEP = 30;
const DURATION = 30;
const ADDRESS = 'The Quarter, 1st & 2nd Floor, 27–28 Burgate, Canterbury, Kent CT1 2HA';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const minToHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const weekdayOf = (d) => new Date(`${d}T00:00:00Z`).getUTCDay(); // 0=Sun
const slotStarts = () => {
  const out = [];
  for (let m = OPEN; m <= LAST; m += STEP) out.push(m);
  return out;
};

async function dayBookings(date) {
  return listRecords(T.bookings, { filterByFormula: `AND({Status}='Confirmed', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}')` });
}

/** Slot list for a date: available unless another Tour holds the slot, or a dedicated
 *  'Tour block' overlaps (staff closing tours). Room blocks do NOT affect tours. */
async function slotAvailability(date) {
  const recs = await dayBookings(date);
  const takenTours = new Set();
  const blocks = [];
  for (const r of recs) {
    const kind = r.fields[F.bookings.kind];
    const s = isoToLondonMin(r.fields[F.bookings.start]);
    const e = isoToLondonMin(r.fields[F.bookings.end]);
    if (kind === 'Tour') takenTours.add(s);
    else if (kind === 'Tour block') blocks.push([s, e]);
  }
  return slotStarts().map((m) => {
    const end = m + DURATION;
    const blocked = blocks.some(([bs, be]) => m < be && end > bs);
    return { time: minToHHMM(m), available: !takenTours.has(m) && !blocked };
  });
}

function friendlyDate(date) {
  try {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return date;
  }
}

async function sendTourEmails({ name, email, date, time }) {
  const when = `${friendlyDate(date)} at ${time}`;
  const visitorBody = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your tour of The Quarter is booked for <strong>${escapeHtml(when)}</strong>. We’re looking forward to showing you around.</p>
    <p style="margin:12px 0 0;">Find us at:<br/>${escapeHtml(ADDRESS)}</p>
    <p style="margin:12px 0 0;">Come up to reception and ask for us. If anything changes, just reply to this email.</p>`;
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject: `Your tour of The Quarter — ${friendlyDate(date)} at ${time}`,
    html: emailShell('Your tour is booked', visitorBody, `We’re looking forward to seeing you on ${friendlyDate(date)}`),
  });
  await pushToEmail(email, { title: 'Tour booked', body: `See you ${when}.`, url: '/' });
  await sendEmail({
    to: OPS_EMAIL,
    subject: `New tour booked — ${friendlyDate(date)} at ${time} (${name})`,
    html: emailShell('New tour booked', `<p><strong>${escapeHtml(name)}</strong> booked a tour for <strong>${escapeHtml(when)}</strong>.</p><p>${escapeHtml(email)}</p>`, 'A new tour was just booked'),
  });
  await pushToEmail(OPS_EMAIL, { title: 'New tour booked', body: `${name} · ${when}`, url: '/admin/' });
}

export default async function handler(req) {
  if (!airtableReady()) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
    const dow = weekdayOf(date);
    if (dow === 0 || dow === 6 || (await isClosedDay(date))) {
      return json({ date, closed: true, slots: slotStarts().map((m) => ({ time: minToHHMM(m), available: false })) });
    }
    return json({ date, slots: await slotAvailability(date) });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const b = await req.json().catch(() => ({}));
  const date = String(b.date || '');
  const time = String(b.time || '');
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'bad-slot' }, 400);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad-input' }, 400);

  const m = hhmmToMin(time);
  const dow = weekdayOf(date);
  if (dow === 0 || dow === 6) return json({ error: 'weekend' }, 400);
  if (m < OPEN || m > LAST || m % STEP !== 0) return json({ error: 'outside-hours' }, 400);
  if (await isClosedDay(date)) return json({ error: 'closed-day' }, 400);

  const slot = (await slotAvailability(date)).find((s) => s.time === time);
  if (!slot || !slot.available) return json({ error: 'slot-taken' }, 409);

  await createRecord(
    T.bookings,
    {
      [F.bookings.title]: `Tour · ${name}`,
      [F.bookings.date]: date,
      [F.bookings.start]: londonWallClockToISO(date, time),
      [F.bookings.end]: londonWallClockToISO(date, minToHHMM(m + DURATION)),
      [F.bookings.kind]: 'Tour',
      [F.bookings.email]: email,
      [F.bookings.name]: name,
      [F.bookings.status]: 'Confirmed',
      [F.bookings.source]: 'Web',
      [F.bookings.notes]: [b.phone ? `Tel ${String(b.phone).trim()}` : '', String(b.notes || '').trim()].filter(Boolean).join(' · '),
    },
    { typecast: true },
  );

  await sendTourEmails({ name, email, date, time });
  return json({ ok: true });
}
