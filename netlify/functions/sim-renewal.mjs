/**
 * The Quarter — renewal simulator (admin test tool).
 *
 * Runs the EXACT same day-reset + rollover logic as the real Stripe webhook, but
 * on demand, so you can verify the behaviour and the dashboard without taking a
 * subscription. Gated by a SIM_KEY secret (set it in Netlify to enable; remove it
 * to disable). Never exposed to members — it's not wired into any UI.
 *
 *   GET /.netlify/functions/sim-renewal?key=YOUR_SIM_KEY&email=member@example.com
 *
 * Pass &lapse=1 to simulate a cancellation (zeroes the balance) instead.
 */
import { renewMember, formatDate } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const SIM_KEY = process.env.SIM_KEY;

export default async function handler(req) {
  if (!MS_SECRET || !SIM_KEY) {
    return new Response(JSON.stringify({ error: 'not-configured' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('key') !== SIM_KEY) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  const email = url.searchParams.get('email');
  if (!email) {
    return new Response(JSON.stringify({ error: 'missing-email' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const lapse = url.searchParams.get('lapse') === '1';
  // Simulate a renewal dated ~30 days out (or clear it on a simulated cancel).
  const renewalDate = lapse ? '' : formatDate(Math.floor(Date.now() / 1000) + 30 * 86400);

  const result = await renewMember(MS_SECRET, email, { renewalDate, resetDays: !lapse, lapse });
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 404,
    headers: { 'content-type': 'application/json' },
  });
}
