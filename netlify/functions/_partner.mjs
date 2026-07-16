/**
 * The Quarter — deterministic per-partner self-service tokens.
 *
 * A partner can bookmark a NO-LOGIN balance page at /partner/<token>. The token is
 * derived deterministically from the partner's name via HMAC-SHA256 with a server
 * secret — so it needs NO new Airtable column and never changes for a given partner.
 * resolvePartnerToken() scans the Partners float rows and constant-time-compares each
 * derived token, returning every float row that belongs to the matching partner.
 *
 * Secret: PARTNER_TOKEN_SECRET (preferred). Falls back to an existing stable server
 * secret so the tokens keep working before a dedicated env var is set — never expose
 * or log the secret. This module imports ONLY from _airtable.mjs (no _rewards.mjs) so
 * _rewards.mjs can import partnerToken() from here without a circular dependency.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { listRecords, T, F } from './_airtable.mjs';

const SECRET =
  process.env.PARTNER_TOKEN_SECRET ||
  process.env.MEMBERSTACK_SECRET_KEY ||
  process.env.AIRTABLE_API_KEY ||
  'the-quarter-partner-fallback';

/** Normalise a partner name so trivial case/whitespace differences resolve the same. */
const norm = (name) => String(name || '').trim().toLowerCase();

/** Deterministic, bookmarkable token for a partner name (32 hex chars). */
export function partnerToken(name) {
  return createHmac('sha256', SECRET).update(norm(name)).digest('hex').slice(0, 32);
}

/** Constant-time-ish string compare (equal length → timingSafeEqual). */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Resolve a self-service token → { partner, rows } where rows are ALL Partners float
 * rows for that partner (a partner may fund more than one reward). Returns null when
 * nothing matches. Never returns bank details — the caller decides what to expose.
 */
export async function resolvePartnerToken(token) {
  if (!token) return null;
  const rows = await listRecords(T.partners);
  const matches = rows.filter((r) => {
    const name = r.fields[F.partners.partner] || '';
    return name && safeEqual(partnerToken(name), token);
  });
  if (!matches.length) return null;
  return { partner: matches[0].fields[F.partners.partner] || '', rows: matches };
}
