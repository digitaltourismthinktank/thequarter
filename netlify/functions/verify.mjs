/**
 * The Quarter — public verification endpoint for the /v/[token] page.
 *
 * GET ?token=<token> → resolve the token to a verification state + member identity +
 * how staff should honour it, and log the scan (powers float draw-down + footfall).
 *
 * No auth: this is the page a shop/café opens by scanning, with no app installed.
 * The authorisation line shown on /v cites SE1 Media Ltd (t/a Digital Tourism Think Tank).
 */
import { airtableReady } from './_airtable.mjs';
import { resolveToken, logScan } from './_tokens.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);
  if (req.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);

  const token = new URL(req.url).searchParams.get('token');
  if (!token) return json({ error: 'missing-token', state: 'unknown' }, 400);

  const resolved = await resolveToken(token);
  await logScan(token, resolved); // logScan uses reward.funding for float draw-down…
  if (resolved?.reward) delete resolved.reward.funding; // …then we drop it (admin-only)
  return json(resolved);
}
