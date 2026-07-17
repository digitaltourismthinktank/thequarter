/**
 * The Quarter — read-only iCalendar (.ics) feed of confirmed room bookings and
 * published events. Subscribe to it in any calendar app. For privacy the event
 * TITLE is the room name only (no member/company names).
 *
 *   GET /.netlify/functions/calendar   → text/calendar
 *
 * Public + read-only. Env: Airtable (via _airtable).
 */
import { listRecords, T, F, airtableReady, esc } from './_airtable.mjs';

const pad = (n) => String(n).padStart(2, '0');

/** ISO string → iCal UTC stamp (YYYYMMDDTHHMMSSZ). */
function icalStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escape text for an iCal value (RFC 5545). */
const icalText = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

function vevent({ uid, start, end, summary, location, description }) {
  const dtStart = icalStamp(start);
  const dtEnd = icalStamp(end);
  if (!dtStart || !dtEnd) return null;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}@thequarter.work`,
    `DTSTAMP:${icalStamp(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icalText(summary)}`,
    location ? `LOCATION:${icalText(location)}` : null,
    description ? `DESCRIPTION:${icalText(description)}` : null,
    'END:VEVENT',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export default async function handler(req) {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  if (!airtableReady())
    return new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//The Quarter//EN\r\nEND:VCALENDAR', {
      headers: { 'content-type': 'text/calendar; charset=utf-8' },
    });

  const today = new Date().toISOString().slice(0, 10);
  // ?type=events → an events-only calendar (for members to subscribe to What's On); the default
  // feed also includes confirmed room bookings (room name only, no personal data).
  const eventsOnly = new URL(req.url).searchParams.get('type') === 'events';

  const [spaceRecs, bookingRecs, eventRecs] = await Promise.all([
    eventsOnly ? Promise.resolve([]) : listRecords(T.spaces, {}),
    eventsOnly ? Promise.resolve([]) : listRecords(T.bookings, { filterByFormula: `AND({Status}='Confirmed', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${esc(today)}')` }),
    listRecords(T.events, { filterByFormula: `{Published}=1` }),
  ]);

  const spaceName = new Map(spaceRecs.map((r) => [r.id, r.fields[F.spaces.name] || 'Room']));

  const events = [];
  for (const r of bookingRecs) {
    const start = r.fields[F.bookings.start];
    const end = r.fields[F.bookings.end];
    if (!start || !end) continue; // skip markers without a concrete slot (e.g. privatisation)
    const sp = r.fields[F.bookings.space];
    const name = Array.isArray(sp) && sp.length ? spaceName.get(sp[0]) || 'Room' : 'The Quarter';
    const ev = vevent({ uid: r.id, start, end, summary: name, location: 'The Quarter, Canterbury' });
    if (ev) events.push(ev);
  }
  for (const r of eventRecs) {
    const start = r.fields[F.events.start];
    const end = r.fields[F.events.end];
    if (!start || !end) continue;
    const ev = vevent({
      uid: r.id,
      start,
      end,
      summary: r.fields[F.events.title] || 'Event',
      location: r.fields[F.events.location] || 'The Quarter, Canterbury',
      description: r.fields[F.events.description] || '',
    });
    if (ev) events.push(ev);
  }

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Quarter//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:The Quarter${eventsOnly ? ' — Events' : ''}`,
    'X-WR-TIMEZONE:Europe/London',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="the-quarter.ics"',
      'cache-control': 'public, max-age=900',
    },
  });
}
