/**
 * The Quarter — member communications (admin only).
 *
 * GET  ?action=index            → templates, events, audience counts, and the to-do list
 * POST {action:'preview'}       → rendered subject + HTML for one sample recipient
 * POST {action:'test'}          → send one to the admin's own address
 * POST {action:'send'}          → send to an audience, or to explicit emails
 * POST {action:'dismiss'}       → clear a to-do item without emailing
 * POST {action:'push'}          → a push to everyone in today, or to one member
 *
 * DESIGN NOTES worth reading before changing anything here.
 *
 * Sending is the only irreversible thing in the admin. So: every send reports exactly who
 * it is going to before it goes, marketing sends skip anyone who has opted out, once-only
 * templates are enforced here rather than by the sender remembering, and the recipient list
 * is always resolved server-side — the client says "active members", never "these 84
 * addresses", so a stale browser tab cannot mail the wrong people.
 *
 * Batch, never bcc: sendBatch issues one message per recipient. Passing an array to
 * sendEmail would put every member's address in a single To header, which is both a
 * privacy breach and the sort of thing you only notice after it has gone.
 */

import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, isAdmin, tokenFromRequest } from './_member.mjs';
import { listRecords, listAllRecords, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, addDays, isoToLondonDate } from './_time.mjs';
import { sendEmail, sendBatch, emailShell, escapeHtml, fmtDateLong, OPS_EMAIL } from './_email.mjs';
import { renderTemplate, TEMPLATE_INDEX, TEMPLATES } from './_templates.mjs';
import { pushToEmail } from './_push.mjs';
import { PLAN_NAMES, PAUSED_PLAN_ID } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const lower = (s) => String(s || '').trim().toLowerCase();
const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

/** A stable unsubscribe token. Not a secret — it only ever turns marketing off. */
function unsubToken(email) {
  return Buffer.from(lower(email)).toString('base64url');
}
export function emailFromUnsubToken(token) {
  try {
    return lower(Buffer.from(String(token), 'base64url').toString('utf8'));
  } catch {
    return '';
  }
}

/** Every Memberstack member, paginated. ~100s of records, so fine to walk on demand. */
async function allMembers(admin) {
  const out = [];
  let after;
  for (let i = 0; i < 40; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const data = res?.data || [];
    out.push(...data);
    if (!res?.hasNextPage || !data.length) break;
    after = res?.endCursor;
  }
  return out;
}

const memberPlanName = (m) => {
  const ids = (m?.planConnections || []).map(planIdOf).filter(Boolean);
  const paused = ids.includes(PAUSED_PLAN_ID);
  const named = ids.map((id) => PLAN_NAMES[id]).filter(Boolean);
  // NB: keyed 'planName', NOT 'name' — shape() spreads this, and calling it 'name' clobbered
  // the person's own name, so every To-Do row showed the plan ("Resident") instead of who it is.
  return { hasPlan: ids.length > 0, paused, planName: paused ? 'Paused' : named[0] || (ids.length ? 'Member' : null) };
};

const shape = (m) => ({
  id: m.id,
  email: lower(memberEmail(m)),
  name: [m?.customFields?.['first-name'], m?.customFields?.['last-name']].filter(Boolean).join(' ').trim() || null,
  optOut: m?.metaData?.emailOptOut === true,
  pushOptOut: m?.metaData?.pushOptOut === true,
  sent: m?.metaData?.commsSent || {},
  // Kept so a commsSent stamp merges into the existing metaData instead of replacing it —
  // Memberstack's update overwrites the whole object.
  rawMeta: m?.metaData || {},
  ...memberPlanName(m),
});

/** Day-pass visits in a window, from the Check-ins table. Buyers may have no member record. */
async function dayPassVisits(fromIso, toIso) {
  const rows = await listAllRecords(T.checkins, {
    filterByFormula: `AND({Status}='Paid', DATETIME_FORMAT({Date},'YYYY-MM-DD')>='${esc(fromIso)}', DATETIME_FORMAT({Date},'YYYY-MM-DD')<='${esc(toIso)}')`,
  });
  return rows.map((r) => ({
    id: r.id,
    email: lower(r.fields[F.checkins.email]),
    name: r.fields[F.checkins.name] || null,
    date: isoToLondonDate(r.fields[F.checkins.date]),
    notes: String(r.fields[F.checkins.notes] || ''),
  }));
}

/* A visit is "handled" once we've thanked them or deliberately let it go. Stamped on the
   Check-ins row rather than a new table: the to-do list already reads these rows, and the
   mark belongs to the visit, not to the person. */
const THANKED = 'comms:thanked';
const SKIPPED = 'comms:skipped';
const handled = (notes) => notes.includes(THANKED) || notes.includes(SKIPPED);

async function upcomingEvents() {
  // Mirrors events.mjs: filter on {Published} in Airtable, then keep the future ones here.
  // A date comparison in a formula against a datetime column is fiddly and this list is small.
  const rows = await listAllRecords(T.events, { filterByFormula: '{Published}', sort: [{ field: 'Start' }] });
  const now = Date.now();
  return rows
    .map((r) => ({
      id: r.id,
      title: r.fields[F.events.title] || 'Event',
      start: r.fields[F.events.start] || null,
      location: r.fields[F.events.location] || '',
      blurb: r.fields[F.events.description] || '',
    }))
    .filter((e) => e.start && Date.parse(e.start) >= now - 12 * 3600_000);
}

const RSVP = { event: 'Event', email: 'Member email', name: 'Name', status: 'Status' };

async function rsvpEmailsFor(eventId) {
  if (!eventId) return new Set();
  // {Event} is a LINK field holding an array of record ids, so an equality formula matches
  // nothing. Read by name and filter here, exactly as events.mjs does.
  const rows = await listAllRecords(T.rsvps, { byName: true });
  return new Set(
    rows
      .filter((r) => Array.isArray(r.fields[RSVP.event]) && r.fields[RSVP.event].includes(eventId) && r.fields[RSVP.status] === 'Going')
      .map((r) => lower(r.fields[RSVP.email])),
  );
}

/**
 * Resolve an audience to a recipient list, server-side. `kind` decides whether opt-outs
 * are dropped — an operational email (your event is tomorrow) still goes to someone who
 * has unsubscribed from the friendly ones.
 */
async function resolveAudience(admin, audience, { eventId, emails } = {}, kind = 'marketing') {
  const today = londonNow().dateStr;
  let people = [];

  if (audience === 'explicit') {
    const wanted = new Set((emails || []).map(lower).filter(Boolean));
    const members = (await allMembers(admin)).map(shape);
    const byEmail = new Map(members.map((m) => [m.email, m]));
    people = [...wanted].map((e) => byEmail.get(e) || { email: e, name: null, optOut: false, sent: {} });
  } else if (audience === 'daypass-12m' || audience === 'daypass-4w') {
    const from = audience === 'daypass-4w' ? addDays(today, -28) : addDays(today, -365);
    const visits = await dayPassVisits(from, today);
    const seen = new Map();
    for (const v of visits) if (v.email && !seen.has(v.email)) seen.set(v.email, { email: v.email, name: v.name, optOut: false, sent: {}, visitDate: v.date });
    // A day-pass buyer may also be a member — prefer the member record so we honour opt-outs.
    const members = (await allMembers(admin)).map(shape);
    const byEmail = new Map(members.map((m) => [m.email, m]));
    people = [...seen.values()].map((v) => {
      const m = byEmail.get(v.email) || {};
      // Member record wins on everything except the name and the visit — a member with no
      // first/last name set would otherwise blank out the name the day pass was booked in.
      return { ...v, ...m, name: m.name || v.name, visitDate: v.visitDate };
    });
  } else {
    const members = (await allMembers(admin)).map(shape);
    const going = await rsvpEmailsFor(eventId);
    if (audience === 'members-active') people = members.filter((m) => m.hasPlan);
    else if (audience === 'event-rsvps') people = members.filter((m) => going.has(m.email));
    else if (audience === 'members-not-rsvpd') people = members.filter((m) => m.hasPlan && !going.has(m.email));
    else people = members.filter((m) => m.hasPlan);
  }

  const withEmail = people.filter((p) => p.email && p.email.includes('@'));
  return kind === 'marketing' ? withEmail.filter((p) => !p.optOut) : withEmail;
}

function ctxFor(person, body, ev) {
  return {
    // body.name is the single-recipient case — the to-do list knows the visitor's name from
    // the Check-ins row even when they have no member account at all.
    name: person.name || body.name || null,
    email: person.email,
    visitDate: person.visitDate || body.visitDate || null,
    eventTitle: ev?.title || '',
    eventWhen: ev?.start ? fmtDateLong(ev.start) : '',
    eventLocation: ev?.location || '',
    eventBlurb: ev?.blurb || '',
    subject: body.subject || '',
    message: body.message || '',
    reviewUrl: process.env.GOOGLE_REVIEW_URL || '',
    unsubToken: unsubToken(person.email),
  };
}

export default async function handler(req) {
  if (!MS_SECRET || !airtableReady()) return json({ error: 'not-configured' }, 503);

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  if (!isAdmin(vm.member)) return json({ error: 'forbidden' }, 403);

  const admin = memberstackAdmin.init(MS_SECRET);
  const today = londonNow().dateStr;

  /* ------------------------------------------------------------------ index ------- */
  if (req.method === 'GET') {
    const [members, events, visits] = await Promise.all([
      allMembers(admin).then((ms) => ms.map(shape)),
      upcomingEvents(),
      dayPassVisits(addDays(today, -21), today),
    ]);

    // The to-do list: the reason this feature exists. Things a person should decide on,
    // not a report. Each one is cleared by acting or by explicitly letting it go.
    const toThank = visits
      .filter((v) => v.email && !handled(v.notes))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((v) => ({ kind: 'thank', id: v.id, email: v.email, name: v.name, date: v.date }));

    const needWelcome = members
      .filter((m) => m.hasPlan && !m.paused && !m.sent?.welcome)
      .map((m) => ({ kind: 'welcome', id: m.id, email: m.email, name: m.name, plan: m.planName }));

    const needRewards = members
      .filter((m) => m.hasPlan && !m.paused && m.sent?.welcome && !m.sent?.['rewards-intro'])
      .map((m) => ({ kind: 'rewards-intro', id: m.id, email: m.email, name: m.name }));

    const active = members.filter((m) => m.hasPlan);
    return json({
      templates: TEMPLATE_INDEX,
      events,
      audiences: [
        { id: 'members-active', label: 'Everyone on a plan', hint: 'Includes paused members', count: active.filter((m) => !m.optOut).length },
        { id: 'daypass-4w', label: 'Day-pass visitors — last 4 weeks', count: null },
        { id: 'daypass-12m', label: 'Day-pass visitors — last 12 months', count: null },
        { id: 'event-rsvps', label: 'Coming to an event', hint: 'Pick the event', count: null },
        { id: 'members-not-rsvpd', label: 'On a plan, not yet coming', hint: 'Pick the event', count: null },
      ],
      todo: { thank: toThank, welcome: needWelcome, rewards: needRewards },
      optedOut: members.filter((m) => m.optOut).length,
      checkedInToday: (await listAllRecords(T.checkins, {
        filterByFormula: `AND(DATETIME_FORMAT({Date},'YYYY-MM-DD')='${esc(today)}', {Status}='Checked-in')`,
      })).map((r) => ({ email: lower(r.fields[F.checkins.email]), name: r.fields[F.checkins.name] || null })),
    });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const { action } = body;

  /* ---------------------------------------------------------------- preview ------- */
  if (action === 'preview' || action === 'test') {
    const t = TEMPLATES[body.templateId];
    if (!t) return json({ error: 'unknown-template' }, 400);
    const ev = body.eventId ? (await upcomingEvents()).find((e) => e.id === body.eventId) : null;
    const me = { name: memberName(vm.member) || 'there', email: memberEmail(vm.member), visitDate: body.visitDate || today };
    const rendered = renderTemplate(t.id, ctxFor(me, body, ev));
    if (action === 'preview') return json({ ok: true, ...rendered });
    const r = await sendEmail({ to: me.email, subject: `[TEST] ${rendered.subject}`, html: rendered.html, replyTo: OPS_EMAIL });
    return json({ ok: !!r.ok, sentTo: me.email });
  }

  /* ------------------------------------------------------------------- send ------- */
  if (action === 'send') {
    const t = TEMPLATES[body.templateId];
    if (!t) return json({ error: 'unknown-template' }, 400);
    const ev = body.eventId ? (await upcomingEvents()).find((e) => e.id === body.eventId) : null;

    // A template's `audience` was advisory, so an operational template could be aimed at a
    // list its operational classification doesn't justify — event-reminder is only
    // operational BECAUSE it goes to people who already said yes, and pointing it at
    // everyone would have kept the opt-out skip while losing the reason for it.
    const permitted = {
      'day-pass': ['explicit', 'daypass-4w', 'daypass-12m'],
      members: ['explicit', 'members-active'],
      event: ['explicit', 'members-active', 'members-not-rsvpd', 'daypass-4w', 'daypass-12m'],
      'event-rsvps': ['explicit', 'event-rsvps'],
      any: ['explicit', 'members-active', 'daypass-4w', 'daypass-12m', 'event-rsvps', 'members-not-rsvpd'],
    }[t.audience] || ['explicit'];
    const audience = body.audience || 'explicit';
    if (!permitted.includes(audience)) return json({ error: 'audience-not-allowed', permitted }, 400);

    let people = await resolveAudience(admin, audience, { eventId: body.eventId, emails: body.emails }, t.kind);

    // A once-only template is enforced here, not by the sender remembering. Silently
    // dropping already-sent recipients is deliberate — the count in the reply tells the
    // truth about what actually went.
    let skippedAlreadySent = 0;
    if (t.once) {
      const before = people.length;
      people = people.filter((p) => !p.sent?.[t.id]);
      skippedAlreadySent = before - people.length;
    }

    if (!people.length) return json({ ok: true, sent: 0, skippedAlreadySent, note: 'nobody-to-send-to' });

    // A dry run answers "who exactly is this going to?" without sending anything.
    if (body.dryRun) {
      return json({ ok: true, dryRun: true, count: people.length, skippedAlreadySent, sample: people.slice(0, 12).map((p) => p.email) });
    }

    const messages = people.map((person) => {
      const r = renderTemplate(t.id, ctxFor(person, body, ev));
      return { to: person.email, subject: r.subject, html: r.html, replyTo: OPS_EMAIL };
    });
    const result = await sendBatch(messages);

    // Stamp only what has to be remembered. A once-only template must never repeat, so
    // that write is worth one API call per recipient. Ordinary sends are not stamped:
    // eighty Memberstack writes to record a newsletter would blow the function's budget
    // for no benefit the send log doesn't already give us.
    if (t.once && result.sent > 0) {
      await Promise.allSettled(
        people
          .filter((p) => p.id)
          .map((p) =>
            admin.members.update({
              id: p.id,
              data: { metaData: { ...(p.rawMeta || {}), commsSent: { ...(p.sent || {}), [t.id]: today } } },
            }),
          ),
      );
    }

    // Day-pass thank-yous clear their own to-do item — but ONLY if something was actually
    // sent. Stamping on a failed send made the visitor vanish from the queue having never
    // been thanked, unrecoverable without editing Airtable by hand.
    if (body.markVisitIds?.length && result.sent > 0) {
      await Promise.allSettled(
        body.markVisitIds.map(async (id) => {
          const [row] = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(id)}'`, maxRecords: 1 });
          const prev = String(row?.fields?.[F.checkins.notes] || '');
          return updateRecord(T.checkins, id, { [F.checkins.notes]: `${prev}${prev ? ' · ' : ''}${THANKED} ${today}` });
        }),
      );
    }

    return json({ ok: result.ok, sent: result.sent, failed: result.failed, skippedAlreadySent, errors: result.errors.slice(0, 2) });
  }

  /* ---------------------------------------------------------------- dismiss ------- */
  if (action === 'dismiss') {
    if (body.visitId) {
      const [row] = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(body.visitId)}'`, maxRecords: 1 });
      const prev = String(row?.fields?.[F.checkins.notes] || '');
      await updateRecord(T.checkins, body.visitId, { [F.checkins.notes]: `${prev}${prev ? ' · ' : ''}${SKIPPED} ${today}` });
      return json({ ok: true });
    }
    // Dismissing a welcome/rewards item stamps it as if sent, so it stops asking.
    if (body.memberId && body.templateId) {
      const m = await admin.members.retrieve({ id: body.memberId });
      const meta = m?.data?.metaData || {};
      await admin.members.update({
        id: body.memberId,
        data: { metaData: { ...meta, commsSent: { ...(meta.commsSent || {}), [body.templateId]: `skipped ${today}` } } },
      });
      return json({ ok: true });
    }
    return json({ error: 'nothing-to-dismiss' }, 400);
  }

  /* ------------------------------------------------------------------- push ------- */
  if (action === 'push') {
    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    if (!title || !message) return json({ error: 'missing-message' }, 400);

    let targets = [];
    if (body.email) {
      targets = [lower(body.email)];
    } else {
      // Everyone AT The Quarter today, not just those already at a desk: a planned day (and a
      // paid day pass) now counts as being in, so a space-wide note should reach them too.
      const rows = await listAllRecords(T.checkins, {
        filterByFormula: `AND(DATETIME_FORMAT({Date},'YYYY-MM-DD')='${esc(today)}', OR({Status}='Checked-in', {Status}='Planned', {Status}='Paid'))`,
      });
      const inToday = [...new Set(rows.map((r) => lower(r.fields[F.checkins.email])).filter(Boolean))];
      // Honour a member's opt-out of these space-wide notifications. Transactional pushes
      // (a booking confirmed, a weekend approved) don't check this — only broadcasts do.
      const muted = new Set((await allMembers(admin)).map(shape).filter((m) => m.pushOptOut).map((m) => m.email));
      targets = inToday.filter((e) => !muted.has(e));
    }
    if (!targets.length) return json({ ok: true, sent: 0, note: 'nobody-in-today' });

    await Promise.allSettled(targets.map((to) => pushToEmail(to, { title, body: message, url: '/dashboard/' })));
    return json({ ok: true, sent: targets.length });
  }

  return json({ error: 'unknown-action' }, 400);
}
