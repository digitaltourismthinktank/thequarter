/**
 * The Quarter — Events API.
 *
 * GET  ?action=upcoming        → published, upcoming events (public; dashboard + entrance screen)
 * GET  ?action=all             → all events (admin)
 * POST {action:'create', title, start, end?, location?, description?, category?, published?}  (admin)
 * POST {action:'update', id, ...fields}   (admin)
 * POST {action:'delete', id}              (admin)
 */
import { verifyMember, isAdmin, tokenFromRequest, memberEmail, memberName } from './_member.mjs';
import { listRecords, createRecord, updateRecord, deleteRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, isoToLondonDate } from './_time.mjs';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

// ---- Event RSVPs (user-created "Event RSVPs" Airtable table, read/written BY NAME) ----
// We don't hold this table's field IDs, so reads use { byName:true } (fields keyed by name)
// and writes pass field names + typecast. The Event field is a link → an array of Event record IDs.
const RSVP = { event: 'Event', email: 'Member email', name: 'Name', status: 'Status' };
const rsvpsForEmail = (email) => listRecords(T.rsvps, { byName: true, filterByFormula: `{${RSVP.email}}='${esc(email)}'` });
const eventIdOf = (r) => (Array.isArray(r.fields[RSVP.event]) ? r.fields[RSVP.event][0] : null);

function mapEvent(r) {
  return {
    id: r.id,
    title: r.fields[F.events.title] || 'Event',
    start: r.fields[F.events.start] || null,
    end: r.fields[F.events.end] || null,
    location: r.fields[F.events.location] || null,
    description: r.fields[F.events.description] || null,
    category: r.fields[F.events.category] || null,
    published: !!r.fields[F.events.published],
  };
}

export default async function handler(req) {
  if (!airtableReady()) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const action = url.searchParams.get('action');

    if (action === 'upcoming') {
      const recs = await listRecords(T.events, { filterByFormula: '{Published}', sort: [{ field: 'Start' }] });
      const today = londonNow().dateStr;
      const events = recs
        .filter((r) => r.fields[F.events.start] && isoToLondonDate(r.fields[F.events.start]) >= today)
        .slice(0, 12)
        .map(mapEvent);
      return json({ events });
    }

    if (action === 'announcements') {
      // Active welcome-screen announcements (public; entrance screen + dashboards). Stored as
      // UNPUBLISHED events tagged Category 'Announcement', so they never surface on the public
      // what's-on, the dashboard events rail, the member Events tab, or the .ics feed — every one
      // of those filters {Published}. Only this action reads them. An announcement is live when
      // today's London date falls within its [Start, End] window, inclusive; End defaults to
      // Start, so a single date shows for that one day (e.g. Belgian National Day).
      const recs = await listRecords(T.events, { filterByFormula: `{Category}='Announcement'` });
      const today = londonNow().dateStr;
      const announcements = recs
        .filter((r) => {
          const from = r.fields[F.events.start] ? isoToLondonDate(r.fields[F.events.start]) : null;
          if (!from) return false;
          const to = r.fields[F.events.end] ? isoToLondonDate(r.fields[F.events.end]) : from;
          return today >= from && today <= to;
        })
        .map((r) => ({ id: r.id, title: r.fields[F.events.title] || '', body: r.fields[F.events.description] || null }))
        .filter((a) => a.title);
      return json({ announcements });
    }

    if (action === 'published') {
      // All published events (past + upcoming) for the member Events tab. Published
      // events are public, so no auth is required.
      const recs = await listRecords(T.events, { filterByFormula: '{Published}', sort: [{ field: 'Start' }] });
      return json({ events: recs.map(mapEvent) });
    }

    if (action === 'all') {
      const vm = await verifyMember(tokenFromRequest(req, null));
      if (!vm.ok) return json({ error: vm.reason }, 401);
      if (!isAdmin(vm.member)) return json({ error: 'forbidden' }, 403);
      const recs = await listRecords(T.events, { sort: [{ field: 'Start' }] });
      return json({ events: recs.map(mapEvent) });
    }

    if (action === 'my-rsvps') {
      // The caller's own RSVPs, so the member Events tab can show current status.
      const vm = await verifyMember(tokenFromRequest(req, null));
      if (!vm.ok) return json({ error: vm.reason }, 401);
      const rows = await rsvpsForEmail(memberEmail(vm.member));
      return json({
        rsvps: rows
          .map((r) => ({ eventId: eventIdOf(r), status: r.fields[RSVP.status] || 'Going' }))
          .filter((x) => x.eventId),
      });
    }

    if (action === 'rsvps') {
      // Attendee list for one event (admin).
      const vm = await verifyMember(tokenFromRequest(req, null));
      if (!vm.ok) return json({ error: vm.reason }, 401);
      if (!isAdmin(vm.member)) return json({ error: 'forbidden' }, 403);
      const eventId = url.searchParams.get('id');
      if (!eventId) return json({ error: 'missing-id' }, 400);
      const rows = await listRecords(T.rsvps, { byName: true });
      const rsvps = rows
        .filter((r) => Array.isArray(r.fields[RSVP.event]) && r.fields[RSVP.event].includes(eventId))
        .map((r) => ({ name: r.fields[RSVP.name] || '', email: r.fields[RSVP.email] || '', status: r.fields[RSVP.status] || 'Going' }));
      return json({ rsvps });
    }

    return json({ error: 'unknown-action' }, 400);
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  // Member RSVP — any authenticated member (NOT admin-gated). Upserts one row per member/event.
  if (body.action === 'rsvp') {
    const eventId = body.id;
    if (!eventId) return json({ error: 'missing-id' }, 400);
    const status = body.status === 'Cancelled' ? 'Cancelled' : 'Going';
    const email = memberEmail(vm.member);
    const name = memberName(vm.member) || email;
    const rows = await rsvpsForEmail(email);
    const existing = rows.find((r) => Array.isArray(r.fields[RSVP.event]) && r.fields[RSVP.event].includes(eventId));
    if (existing) {
      await updateRecord(T.rsvps, existing.id, { [RSVP.status]: status }, { typecast: true });
    } else {
      await createRecord(T.rsvps, { [RSVP.event]: [eventId], [RSVP.email]: email, [RSVP.name]: name, [RSVP.status]: status }, { typecast: true });
    }
    return json({ ok: true, status });
  }

  // Everything below is admin-only.
  if (!isAdmin(vm.member)) return json({ error: 'forbidden' }, 403);

  if (body.action === 'create') {
    if (!body.title || !body.start) return json({ error: 'missing-title-or-start' }, 400);
    const fields = {
      [F.events.title]: body.title,
      [F.events.start]: body.start,
      [F.events.location]: body.location || 'The Kentish Pantry',
      [F.events.published]: body.published !== false,
    };
    if (body.end) fields[F.events.end] = body.end;
    if (body.description) fields[F.events.description] = body.description;
    if (body.category) fields[F.events.category] = body.category;
    // typecast so a new Category (singleSelect) option is accepted, not rejected.
    const rec = await createRecord(T.events, fields, { typecast: true });
    return json({ ok: true, id: rec.id });
  }

  if (body.action === 'update') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const fields = {};
    if (body.title !== undefined) fields[F.events.title] = body.title;
    if (body.start !== undefined) fields[F.events.start] = body.start;
    if (body.end !== undefined) fields[F.events.end] = body.end;
    if (body.location !== undefined) fields[F.events.location] = body.location;
    if (body.description !== undefined) fields[F.events.description] = body.description;
    if (body.category !== undefined) fields[F.events.category] = body.category;
    if (body.published !== undefined) fields[F.events.published] = body.published;
    await updateRecord(T.events, body.id, fields, { typecast: true });
    return json({ ok: true });
  }

  if (body.action === 'delete') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    await deleteRecord(T.events, body.id);
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
