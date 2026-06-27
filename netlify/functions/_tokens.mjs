/**
 * The Quarter — verification token lifecycle for the /v/[token] page.
 *
 * A member opening a perk/reward voucher mints a short-lived token bound to
 * {memberEmail, partner, perkId|rewardId, kind}. The QR encodes thequarter.work/v/<token>.
 * Staff scan it → resolveToken computes one of five states + the member identity + how
 * to honour it, and logScan records every scan (powering float draw-down + footfall).
 */
import { randomUUID } from 'node:crypto';
import memberstackAdmin from '@memberstack/admin';
import { listRecords, createRecord, updateRecord, T, F, esc } from './_airtable.mjs';
import { listRewards, getPerk, drawFloat, poundsValue } from './_rewards.mjs';
import { PLAN_NAMES, PAUSED_PLAN_ID } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes — staff scan shortly after the member opens it
const HIGH_TRUST_POINTS = 1400; // reward vouchers at/above this show a rotating code on /v

const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

/** Active = holds a managed plan that isn't the paused plan. */
function memberPlanState(m) {
  const ids = (m?.planConnections || []).map(planIdOf).filter(Boolean);
  const managed = ids.filter((id) => id in PLAN_NAMES);
  const active = managed.some((id) => id !== PAUSED_PLAN_ID);
  const planId = managed.find((id) => id !== PAUSED_PLAN_ID) || managed[0] || null;
  return { active, planName: planId ? PLAN_NAMES[planId] : null };
}

/** Heuristic "is this perk running today" check against a free-text days string. */
function perkActiveToday(days) {
  const s = (days || '').toLowerCase().trim();
  if (!s || /(always|every ?day|daily|any day)/.test(s)) return true;
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  if (!names.some((n) => s.includes(n)) && !s.includes('weekday')) return true; // no weekday mentioned → assume on
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).toLowerCase().slice(0, 3);
  const isWeekday = ['mon', 'tue', 'wed', 'thu', 'fri'].includes(today);
  if (s.includes(today)) return true;
  if (s.includes('weekday') && isWeekday) return true;
  if (s.includes('mon') && s.includes('fri') && isWeekday) return true; // "Mon–Fri" range
  return false;
}

/** Mint a token. kind: 'perk' | 'reward' | 'wallet'. Returns the token string. */
export async function mintToken({ email, partner = '', perkId = '', kind = 'perk' }) {
  const token = randomUUID().replace(/-/g, '');
  const now = Date.now();
  await createRecord(T.tokens, {
    [F.tokens.token]: token,
    [F.tokens.email]: email,
    [F.tokens.partner]: partner,
    [F.tokens.perkId]: perkId,
    [F.tokens.kind]: kind,
    [F.tokens.issuedAt]: new Date(now).toISOString(),
    [F.tokens.expiresAt]: new Date(now + TOKEN_TTL_MS).toISOString(),
  });
  return token;
}

async function tokenRow(token) {
  const rows = await listRecords(T.tokens, { filterByFormula: `{Token}='${esc(token)}'`, maxRecords: 1 });
  return rows[0] || null;
}

/**
 * Resolve a token for the /v page. Returns { ok, state, kind, member, perk|reward, ... }.
 * state ∈ valid | inactive | expired | lapsed | rotating | unknown.
 */
export async function resolveToken(token) {
  if (!token) return { ok: false, state: 'unknown' };
  const row = await tokenRow(token);
  if (!row) return { ok: false, state: 'unknown' };
  const f = row.fields;
  const kind = f[F.tokens.kind] || 'perk';
  const email = f[F.tokens.email] || '';
  const partner = f[F.tokens.partner] || '';
  const perkId = f[F.tokens.perkId] || '';
  const expiresAt = f[F.tokens.expiresAt] ? Date.parse(f[F.tokens.expiresAt]) : 0;

  // Look up the member's current state.
  let member = null;
  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const r = await admin.members.retrieve({ email });
    member = r?.data || null;
  } catch {
    /* ignore — handled below */
  }
  const cf = member?.customFields || {};
  const name = [cf['first-name'], cf['last-name']].filter(Boolean).join(' ').trim() || 'Quarter member';
  const { active, planName } = member ? memberPlanState(member) : { active: false, planName: null };
  const since = member?.createdAt ? new Date(member.createdAt).getFullYear() : null;
  const identity = { name, planName, since, active };

  // Expired beats everything (ask them to reopen + re-scan).
  if (expiresAt && Date.now() > expiresAt) return { ok: true, state: 'expired', kind, partner };
  // Lapsed member — perks are paused.
  if (!active) return { ok: true, state: 'lapsed', kind, partner, member: identity };

  if (kind === 'wallet') {
    return { ok: true, state: 'valid', kind, member: identity, wallet: true };
  }

  if (kind === 'reward') {
    const rewards = await listRewards({ liveOnly: false });
    const reward = rewards.find((r) => r.id === perkId) || null;
    const state = reward && reward.cost >= HIGH_TRUST_POINTS ? 'rotating' : 'valid';
    return { ok: true, state, kind, member: identity, reward, partner: reward?.partner || partner };
  }

  // Perk
  const perk = await getPerk(perkId);
  if (perk && !perkActiveToday(perk.days)) return { ok: true, state: 'inactive', kind, member: identity, perk, partner: perk.partner };
  return { ok: true, state: 'valid', kind, member: identity, perk, partner: perk?.partner || partner };
}

/** Log a scan, mark the token used, and draw the partner float for funded rewards. */
export async function logScan(token, resolved) {
  try {
    const row = await tokenRow(token);
    const f = row?.fields || {};
    await createRecord(T.scanLog, {
      [F.scanLog.entry]: `${resolved?.partner || 'scan'} · ${new Date().toISOString().slice(0, 10)}`,
      [F.scanLog.token]: token,
      [F.scanLog.email]: f[F.tokens.email] || '',
      [F.scanLog.partner]: resolved?.partner || f[F.tokens.partner] || '',
      [F.scanLog.perkId]: f[F.tokens.perkId] || '',
      [F.scanLog.result]: resolved?.state || 'unknown',
      [F.scanLog.at]: new Date().toISOString(),
    });
    if (row && !f[F.tokens.usedAt]) {
      await updateRecord(T.tokens, row.id, { [F.tokens.usedAt]: new Date().toISOString() });
    }
    // Funded reward honoured → draw its £ value from the partner float.
    if ((resolved?.state === 'valid' || resolved?.state === 'rotating') && resolved?.reward && resolved.reward.funding !== 'inventory') {
      await drawFloat(resolved.reward.partner, poundsValue(resolved.reward.cost));
    }
  } catch {
    /* logging must never break the verification page */
  }
}
