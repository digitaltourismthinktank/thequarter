/**
 * The Quarter — write-time ACTIVITY LOG.
 *
 * A durable, append-only record of every money/account action, so the admin audit trail can show
 * not just "a check-in happened" but "days went 3 → 2, from the rollover bucket" — the corresponding
 * balance movements that the existing tables (Check-ins, Bookings, Points ledger) don't capture on
 * their own. This is the piece that answers "did it deduct a day? did the refund land? did the
 * points reverse?" for actions that leave no other trace (manual adjustments, plan changes, pauses,
 * renewals, carnet purchases).
 *
 * Addressed BY NAME and env-GATED: the Activity table is user-created, and until its id/name is set
 * in AIRTABLE_ACTIVITY_TABLE this module NO-OPS silently. That means it can ship dark and start
 * recording the moment the table exists — no code change, and never a thrown error in a money path
 * if the table is missing or a field is renamed (every write is best-effort and swallowed).
 *
 * Create the table in the Ops base with these fields (all as named here):
 *   At            — Date (include time)
 *   Action        — Single line text     (e.g. "check-in", "adjust-days", "plan-change", "renewal")
 *   Member email  — Single line text
 *   Member name   — Single line text
 *   Actor         — Single line text      (who did it: the member, "Admin: name", "System (cron)")
 *   Base          — Single line text      (which Airtable table / system the primary record lives in)
 *   Summary       — Long text             (human sentence)
 *   Days before   — Number    Days after   — Number
 *   Roll before   — Number    Roll after   — Number
 *   Passes before — Number    Passes after — Number
 *   Points before — Number    Points after — Number
 *   Detail        — Long text             (JSON / free notes for drill-down)
 * Then set AIRTABLE_ACTIVITY_TABLE to the table id (tbl…) or its exact name.
 */
import { createRecord } from './_airtable.mjs';

const ACTIVITY_TABLE = process.env.AIRTABLE_ACTIVITY_TABLE || '';

/** Is the activity log wired up (table configured)? Reads elsewhere use this to decide whether to
 *  merge in write-log rows or fall back to aggregation only. */
export const activityConfigured = () => !!ACTIVITY_TABLE;

const AF = {
  at: 'At',
  action: 'Action',
  email: 'Member email',
  name: 'Member name',
  actor: 'Actor',
  base: 'Base',
  summary: 'Summary',
  daysBefore: 'Days before',
  daysAfter: 'Days after',
  rollBefore: 'Roll before',
  rollAfter: 'Roll after',
  passesBefore: 'Passes before',
  passesAfter: 'Passes after',
  pointsBefore: 'Points before',
  pointsAfter: 'Points after',
  detail: 'Detail',
};

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

/**
 * Record one action. Best-effort and non-blocking: any failure (table missing, field renamed,
 * transient Airtable error) is swallowed so it can NEVER affect the money write it's logging.
 *
 * @param {object} e
 *   action, actor, memberEmail, memberName, base, summary, detail (string|object),
 *   before/after: { days, roll, passes, points } — pass only the buckets this action touched.
 */
export async function logActivity(e = {}) {
  if (!ACTIVITY_TABLE) return; // dark until the table is configured
  try {
    const before = e.before || {};
    const after = e.after || {};
    const fields = {
      [AF.at]: new Date().toISOString(),
      [AF.action]: String(e.action || 'action'),
      [AF.email]: String(e.memberEmail || '').toLowerCase(),
      [AF.name]: e.memberName || '',
      [AF.actor]: e.actor || '',
      [AF.base]: e.base || '',
      [AF.summary]: e.summary || '',
      [AF.detail]: typeof e.detail === 'string' ? e.detail : e.detail ? JSON.stringify(e.detail) : '',
    };
    const pairs = [
      [AF.daysBefore, before.days],
      [AF.daysAfter, after.days],
      [AF.rollBefore, before.roll],
      [AF.rollAfter, after.roll],
      [AF.passesBefore, before.passes],
      [AF.passesAfter, after.passes],
      [AF.pointsBefore, before.points],
      [AF.pointsAfter, after.points],
    ];
    for (const [k, v] of pairs) {
      const n = num(v);
      if (n !== undefined) fields[k] = n;
    }
    await createRecord(ACTIVITY_TABLE, fields, { typecast: true, byName: true });
  } catch (err) {
    console.error('[activity] log failed (non-fatal)', e?.action, String(err?.message || err));
  }
}

/** Read raw Activity rows for the ledger view (by member and/or date window). Returns [] when the
 *  table isn't configured, so callers can always spread it in safely. */
export async function readActivity({ email, from, to } = {}) {
  if (!ACTIVITY_TABLE) return [];
  try {
    const { listAllRecords, esc } = await import('./_airtable.mjs');
    const clauses = [];
    if (email) clauses.push(`LOWER({${AF.email}})='${esc(String(email).toLowerCase())}'`);
    if (from) clauses.push(`DATETIME_FORMAT({${AF.at}},'YYYY-MM-DD')>='${esc(from)}'`);
    if (to) clauses.push(`DATETIME_FORMAT({${AF.at}},'YYYY-MM-DD')<='${esc(to)}'`);
    const rows = await listAllRecords(ACTIVITY_TABLE, {
      byName: true,
      filterByFormula: clauses.length ? `AND(${clauses.join(',')})` : '',
    });
    return rows.map((r) => ({
      id: r.id,
      at: r.fields[AF.at] || null,
      action: r.fields[AF.action] || '',
      email: r.fields[AF.email] || '',
      name: r.fields[AF.name] || '',
      actor: r.fields[AF.actor] || '',
      base: r.fields[AF.base] || 'Activity',
      summary: r.fields[AF.summary] || '',
      before: { days: r.fields[AF.daysBefore], roll: r.fields[AF.rollBefore], passes: r.fields[AF.passesBefore], points: r.fields[AF.pointsBefore] },
      after: { days: r.fields[AF.daysAfter], roll: r.fields[AF.rollAfter], passes: r.fields[AF.passesAfter], points: r.fields[AF.pointsAfter] },
      detail: r.fields[AF.detail] || '',
    }));
  } catch (err) {
    console.error('[activity] read failed', String(err?.message || err));
    return [];
  }
}
