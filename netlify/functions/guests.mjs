/**
 * The Quarter — guest registration + fire-safety roll-call (lobby kiosk; public).
 *
 * GET  ?action=hosts&q=<query>  → member host lookup (name/company; min 2 chars; no emails)
 * GET  ?action=roll             → today's roll-call: headcount, members in, guests on site
 * POST {action:'signin', name, company?, hostId?, host?, reason?}  → sign a guest in
 * POST {action:'signout', id}   → sign a guest out
 *
 * The roll-call is a daily record (cleared each evening by ignoring earlier days). Member
 * names appear only as the host a guest has chosen + a count of who's in — no emails.
 */
import memberstackAdmin from '@memberstack/admin';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow } from './_time.mjs';
import { PLAN_NAMES } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

async function searchHosts(q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!MS_SECRET || needle.length < 2) return [];
  const admin = memberstackAdmin.init(MS_SECRET);
  const out = [];
  let after;
  for (let i = 0; i < 20 && out.length < 8; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const data = res?.data || [];
    for (const m of data) {
      const cf = m.customFields || {};
      const name = [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim();
      const company = m.metaData?.company || '';
      if (`${name} ${company}`.toLowerCase().includes(needle)) {
        const planId = (m.planConnections || []).map(planIdOf).filter(Boolean)[0] || null;
        out.push({ id: m.id, name: name || m.auth?.email || m.email || 'Member', company, plan: planId ? PLAN_NAMES[planId] || '' : '' });
        if (out.length >= 8) break;
      }
    }
    if (!res?.hasNextPage || data.length === 0) break;
    after = res?.endCursor;
  }
  return out;
}

async function rollCall() {
  const today = londonNow().dateStr;
  const [checkins, guestRecs] = await Promise.all([
    listRecords(T.checkins, { filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(today)}', {Status}='Checked-in')` }),
    listRecords(T.guests, {
      filterByFormula: `AND(DATETIME_FORMAT({Arrived at}, 'YYYY-MM-DD')='${esc(today)}', {Signed out at}=BLANK())`,
      sort: [{ field: 'Arrived at', direction: 'desc' }],
    }),
  ]);
  const guests = guestRecs.map((r) => ({
    id: r.id,
    name: r.fields[F.guests.name] || 'Guest',
    company: r.fields[F.guests.company] || null,
    host: r.fields[F.guests.host] || null,
    arrivedAt: r.fields[F.guests.arrivedAt] || null,
  }));
  return { membersIn: checkins.length, guests, headcount: checkins.length + guests.length };
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const action = url.searchParams.get('action');
    if (action === 'hosts') return json({ hosts: await searchHosts(url.searchParams.get('q')) });
    if (action === 'roll') return json(await rollCall());
    return json({ error: 'unknown-action' }, 400);
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const body = await req.json().catch(() => ({}));

  if (body.action === 'signin') {
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'missing-name' }, 400);
    const host = String(body.host || '').trim();
    await createRecord(T.guests, {
      [F.guests.name]: name,
      [F.guests.company]: String(body.company || '').trim(),
      [F.guests.host]: host,
      [F.guests.hostId]: String(body.hostId || '').trim(),
      [F.guests.reason]: String(body.reason || '').trim(),
      [F.guests.arrivedAt]: new Date().toISOString(),
    });
    return json({ ok: true, host: host || null });
  }

  if (body.action === 'signout') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    await updateRecord(T.guests, body.id, { [F.guests.signedOutAt]: new Date().toISOString() });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
