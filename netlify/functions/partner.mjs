/**
 * The Quarter — partner self-service balance API (public, NO login).
 *
 * GET ?token=<partnerToken> → the partner's float health + recent redemptions, so a
 * partner can bookmark /partner/<token> and watch their pot draw down without an
 * account. The token is derived deterministically from the partner name (see
 * _partner.mjs), so there is no session to manage.
 *
 * SENSITIVE FIELDS ARE NEVER RETURNED: no contact, no payee name, no sort code, no
 * account number. Only the float figures + reward redemptions a partner already knows
 * about leave this function.
 */
import { listRecords, T, F, esc, airtableReady } from './_airtable.mjs';
import { resolvePartnerToken } from './_partner.mjs';
import { floatStatus, POINTS_PER_POUND_VALUE } from './_rewards.mjs';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!airtableReady()) return json({ error: 'not-configured' }, 503);
  if (req.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);

  const token = new URL(req.url).searchParams.get('token');
  if (!token) return json({ error: 'missing-token' }, 400);

  const match = await resolvePartnerToken(token);
  if (!match) return json({ error: 'not-found' }, 404);

  const { partner, rows } = match;

  // A partner can fund more than one reward → sum the float rows into one pot.
  let balance = 0;
  let floatTotal = 0;
  let usesThisMonth = 0;
  let lastUsed = null;
  for (const r of rows) {
    balance += Number(r.fields[F.partners.balance]) || 0;
    floatTotal += Number(r.fields[F.partners.floatTotal]) || 0;
    usesThisMonth += Number(r.fields[F.partners.usesThisMonth]) || 0;
    const lu = r.fields[F.partners.lastUsed] || null;
    if (lu && (!lastUsed || lu > lastUsed)) lastUsed = lu;
  }
  balance = Math.round(balance * 100) / 100;
  floatTotal = Math.round(floatTotal * 100) / 100;

  // Recent redemptions at this partner (member-safe: reward + £ value + when).
  const redRows = await listRecords(T.redemptions, {
    filterByFormula: `{Partner}='${esc(partner)}'`,
    sort: [{ field: 'At', direction: 'desc' }],
    maxRecords: 10,
  });
  const redemptions = redRows.map((r) => ({
    reward: r.fields[F.redemptions.reward] || '',
    value: (Number(r.fields[F.redemptions.cost]) || 0) / POINTS_PER_POUND_VALUE,
    at: r.fields[F.redemptions.at] || null,
  }));

  return json({
    partner,
    balance,
    floatTotal,
    status: floatStatus(balance, floatTotal),
    usesThisMonth,
    lastUsed,
    redemptions,
  });
}
