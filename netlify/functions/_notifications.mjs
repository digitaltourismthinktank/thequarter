/**
 * The Quarter — NOTIFICATIONS store (the inbox behind the bell).
 *
 * Every push the app sends is ALSO written here as a durable inbox row, so a member (or the team)
 * can open the bell later and see what they were told — even if the browser push was missed,
 * dismissed, or never delivered (push needs VAPID + a subscription; the inbox needs neither).
 *
 * Addressed BY NAME and env-GATED, exactly like the Activity log: the Notifications table is
 * user-created, and until its id/name is set in AIRTABLE_NOTIFICATIONS_TABLE this module NO-OPS
 * silently. It can ship dark and light up the moment the table exists — no code change, and never
 * a thrown error in the paths that call it (every write/read is best-effort and swallowed).
 *
 * Create the table in the Ops base with these fields (all as named here):
 *   At         — Date (include time)
 *   Recipient  — Single line text   (member email, lower-case; blank for the shared admin feed)
 *   Audience   — Single line text   ('member' | 'admin')
 *   Title      — Single line text
 *   Body       — Long text
 *   Url        — Single line text    (in-app path to open, e.g. "/post/")
 *   Kind       — Single line text    (loose category: post | booking | checkin | reward | billing | admin)
 *   Read       — Checkbox
 *   Cleared    — Checkbox            ("clear" hides a row from the inbox without hard-deleting it)
 * Then set AIRTABLE_NOTIFICATIONS_TABLE to the table id (tbl…) or its exact name.
 */
import { createRecord, updateRecord, listAllRecords, esc } from './_airtable.mjs';

const TABLE = process.env.AIRTABLE_NOTIFICATIONS_TABLE || '';

export const notificationsConfigured = () => !!TABLE;

const NF = {
  at: 'At',
  recipient: 'Recipient',
  audience: 'Audience',
  title: 'Title',
  body: 'Body',
  url: 'Url',
  kind: 'Kind',
  read: 'Read',
  cleared: 'Cleared',
};

/**
 * Store one notification. Best-effort and non-blocking: any failure (table missing, field renamed,
 * transient Airtable error) is swallowed so it can NEVER affect the push/flow that emitted it.
 * @param {object} n { recipient, audience='member', title, body, url, kind }
 */
export async function addNotification(n = {}) {
  if (!TABLE) return; // dark until the table is configured
  const title = String(n.title || '').trim();
  if (!title) return; // a bell row with no title is noise
  try {
    const fields = {
      [NF.at]: new Date().toISOString(),
      [NF.recipient]: String(n.recipient || '').toLowerCase(),
      [NF.audience]: n.audience === 'admin' ? 'admin' : 'member',
      [NF.title]: title,
      [NF.body]: String(n.body || ''),
      [NF.url]: String(n.url || ''),
      [NF.kind]: String(n.kind || ''),
      [NF.read]: false,
      [NF.cleared]: false,
    };
    await createRecord(TABLE, fields, { typecast: true });
  } catch (err) {
    console.error('[notifications] add failed (non-fatal)', String(err?.message || err));
  }
}

/** Build the audience/recipient filter for a scope. Member = their own rows; admin = the shared feed. */
function scopeFormula({ recipient, audience }) {
  if (audience === 'admin') return `{${NF.audience}}='admin'`;
  return `AND({${NF.audience}}='member',LOWER({${NF.recipient}})='${esc(String(recipient || '').toLowerCase())}')`;
}

/**
 * List a scope's inbox (newest first, excluding cleared rows). Returns [] when unconfigured.
 * @param {object} o { recipient, audience='member', limit=60 }
 */
export async function listNotifications({ recipient, audience = 'member', limit = 60 } = {}) {
  if (!TABLE) return [];
  try {
    const rows = await listAllRecords(TABLE, {
      byName: true,
      filterByFormula: `AND(${scopeFormula({ recipient, audience })},NOT({${NF.cleared}}=1))`,
      sort: [{ field: NF.at, direction: 'desc' }],
    });
    return rows.slice(0, limit).map((r) => ({
      id: r.id,
      at: r.fields[NF.at] || null,
      title: r.fields[NF.title] || '',
      body: r.fields[NF.body] || '',
      url: r.fields[NF.url] || '',
      kind: r.fields[NF.kind] || '',
      read: r.fields[NF.read] === true,
    }));
  } catch (err) {
    console.error('[notifications] list failed', String(err?.message || err));
    return [];
  }
}

/** Mark specific rows read. Verifies each row belongs to the scope before touching it. */
export async function markRead({ recipient, audience = 'member', ids = [] } = {}) {
  if (!TABLE || !Array.isArray(ids) || !ids.length) return { ok: true, updated: 0 };
  const own = await ownIdSet({ recipient, audience });
  let updated = 0;
  for (const id of ids.slice(0, 200)) {
    if (!own.has(id)) continue;
    try {
      await updateRecord(TABLE, id, { [NF.read]: true }, { typecast: true });
      updated += 1;
    } catch { /* best-effort */ }
  }
  return { ok: true, updated };
}

/** Mark every unread row in the scope read. */
export async function markAllRead({ recipient, audience = 'member' } = {}) {
  if (!TABLE) return { ok: true, updated: 0 };
  try {
    const rows = await listAllRecords(TABLE, {
      byName: true,
      filterByFormula: `AND(${scopeFormula({ recipient, audience })},NOT({${NF.read}}=1),NOT({${NF.cleared}}=1))`,
    });
    let updated = 0;
    for (const r of rows.slice(0, 400)) {
      try { await updateRecord(TABLE, r.id, { [NF.read]: true }, { typecast: true }); updated += 1; } catch { /* */ }
    }
    return { ok: true, updated };
  } catch (err) {
    console.error('[notifications] markAllRead failed', String(err?.message || err));
    return { ok: false, updated: 0 };
  }
}

/** Clear (hide) specific rows, or the whole scope when ids is empty. */
export async function clear({ recipient, audience = 'member', ids = [] } = {}) {
  if (!TABLE) return { ok: true, cleared: 0 };
  try {
    let targets;
    if (Array.isArray(ids) && ids.length) {
      const own = await ownIdSet({ recipient, audience });
      targets = ids.filter((id) => own.has(id));
    } else {
      const rows = await listAllRecords(TABLE, {
        byName: true,
        filterByFormula: `AND(${scopeFormula({ recipient, audience })},NOT({${NF.cleared}}=1))`,
      });
      targets = rows.map((r) => r.id);
    }
    let cleared = 0;
    for (const id of targets.slice(0, 400)) {
      try { await updateRecord(TABLE, id, { [NF.cleared]: true }, { typecast: true }); cleared += 1; } catch { /* */ }
    }
    return { ok: true, cleared };
  } catch (err) {
    console.error('[notifications] clear failed', String(err?.message || err));
    return { ok: false, cleared: 0 };
  }
}

/** The set of record ids that belong to a scope — so writes can't touch another member's rows. */
async function ownIdSet({ recipient, audience }) {
  try {
    const rows = await listAllRecords(TABLE, { byName: true, filterByFormula: scopeFormula({ recipient, audience }) });
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}
