/**
 * The Quarter — admin test / debug tool (SIM_KEY-gated; never wired into any UI).
 * Set SIM_KEY in Netlify to enable; remove it to disable.
 *
 *   Inspect a member (read-only):
 *     GET /.netlify/functions/sim-renewal?key=KEY&email=…&inspect=1
 *   Force a plan re-tag (test the switch/pause logic without Stripe):
 *     GET /.netlify/functions/sim-renewal?key=KEY&email=…&plan=pln_visitor-plan-blk50re2
 *   Simulate a renewal (reset days + rollover; &lapse=1 to simulate a cancel):
 *     GET /.netlify/functions/sim-renewal?key=KEY&email=…
 */
import { renewMember, formatDate, setMemberPlan, inspectMember } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const SIM_KEY = process.env.SIM_KEY;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!MS_SECRET || !SIM_KEY) return json({ error: 'not-configured' }, 503);

  const url = new URL(req.url);
  if (url.searchParams.get('key') !== SIM_KEY) return json({ error: 'forbidden' }, 403);

  const email = url.searchParams.get('email');
  if (!email) return json({ error: 'missing-email' }, 400);

  // Read-only inspection of the member's plan tags + custom fields.
  if (url.searchParams.get('inspect') === '1') {
    const result = await inspectMember(MS_SECRET, email);
    return json(result, result.ok ? 200 : 404);
  }

  // Force a plan re-tag (exercises the exact switch/pause logic the webhook uses).
  const plan = url.searchParams.get('plan');
  if (plan) {
    const result = await setMemberPlan(MS_SECRET, email, plan);
    return json(result, result.ok ? 200 : 404);
  }

  // Default: simulate a renewal (reset days + rollover, or lapse).
  const lapse = url.searchParams.get('lapse') === '1';
  const renewalDate = lapse ? '' : formatDate(Math.floor(Date.now() / 1000) + 30 * 86400);
  const result = await renewMember(MS_SECRET, email, { renewalDate, resetDays: !lapse, lapse });
  return json(result, result.ok ? 200 : 404);
}
