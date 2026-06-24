/**
 * The Quarter — admin test / debug tool (SIM_KEY-gated; never wired into any UI).
 * Set SIM_KEY in Netlify to enable; remove it to disable.
 *
 *   Inspect a member (read-only):
 *     …/sim-renewal?key=KEY&email=…&inspect=1
 *   See the member's real Stripe customer/subscription + how it maps (read + re-tag):
 *     …/sim-renewal?key=KEY&email=…&syncstripe=1
 *   Force a plan re-tag:
 *     …/sim-renewal?key=KEY&email=…&plan=pln_visitor-plan-blk50re2
 *   Simulate a renewal (reset days + rollover; &lapse=1 to simulate a cancel):
 *     …/sim-renewal?key=KEY&email=…
 */
import { renewMember, formatDate, setMemberPlan, inspectMember, targetPlanForPrice } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const SIM_KEY = process.env.SIM_KEY;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com${path}`, { headers: { authorization: `Bearer ${STRIPE_SECRET}` } });
  return res.json();
}

/** Pull the member's real Stripe customer + subscription and map it like the webhook does. */
async function syncFromStripe(email) {
  if (!STRIPE_SECRET) return { ok: false, step: 'no-stripe-key' };
  const customers = await stripeGet(`/v1/customers?email=${encodeURIComponent(email)}&limit=1`);
  const customerId = customers?.data?.[0]?.id;
  if (!customerId) return { ok: false, step: 'no-customer', email };

  const subs = await stripeGet(`/v1/subscriptions?customer=${customerId}&status=all&limit=10`);
  if (!subs?.data) return { ok: false, step: 'subscriptions-read-failed', customerId, stripe: subs };
  const allSubscriptions = (subs?.data || []).map((s) => ({
    id: s.id,
    status: s.status,
    priceId: s.items?.data?.[0]?.price?.id,
    unit_amount: s.items?.data?.[0]?.price?.unit_amount,
  }));
  const activeSub = (subs?.data || []).find((s) => ['active', 'trialing', 'past_due'].includes(s.status)) || subs?.data?.[0];
  if (!activeSub) return { ok: false, step: 'no-subscription', customerId, allSubscriptions };

  const price = activeSub.items?.data?.[0]?.price;
  const target = targetPlanForPrice(price?.id, price?.unit_amount);
  const setResult = target ? await setMemberPlan(MS_SECRET, email, target) : null;
  return {
    ok: true,
    customerId,
    activeSubscription: { id: activeSub.id, status: activeSub.status, priceId: price?.id, unit_amount: price?.unit_amount },
    mappedKnownPrice: !!target,
    target: target || null,
    setResult,
    allSubscriptions,
  };
}

/** List recent Stripe subscriptions (any customer) with email + price, to see where test subs landed. */
async function recentSubs() {
  if (!STRIPE_SECRET) return { ok: false, step: 'no-stripe-key' };
  const subs = await stripeGet(`/v1/subscriptions?status=all&limit=20`);
  if (!subs?.data) return { ok: false, step: 'subscriptions-read-failed', stripe: subs };
  const rows = [];
  for (const s of subs?.data || []) {
    const price = s.items?.data?.[0]?.price;
    let email = null;
    try {
      const c = await stripeGet(`/v1/customers/${s.customer}`);
      email = c?.email;
    } catch {
      /* ignore */
    }
    rows.push({
      sub: s.id,
      status: s.status,
      customer: s.customer,
      email,
      priceId: price?.id,
      unit_amount: price?.unit_amount,
      mapped: !!targetPlanForPrice(price?.id, price?.unit_amount),
    });
  }
  return { ok: true, count: rows.length, rows };
}

export default async function handler(req) {
  if (!MS_SECRET || !SIM_KEY) return json({ error: 'not-configured' }, 503);

  const url = new URL(req.url);
  if (url.searchParams.get('key') !== SIM_KEY) return json({ error: 'forbidden' }, 403);

  // No email needed: list recent subscriptions across all customers.
  if (url.searchParams.get('recentsubs') === '1') return json(await recentSubs());

  const email = url.searchParams.get('email');
  if (!email) return json({ error: 'missing-email' }, 400);

  if (url.searchParams.get('inspect') === '1') {
    const result = await inspectMember(MS_SECRET, email);
    return json(result, result.ok ? 200 : 404);
  }

  if (url.searchParams.get('syncstripe') === '1') {
    const result = await syncFromStripe(email);
    return json(result, result.ok ? 200 : 404);
  }

  const plan = url.searchParams.get('plan');
  if (plan) {
    const result = await setMemberPlan(MS_SECRET, email, plan);
    return json(result, result.ok ? 200 : 404);
  }

  const lapse = url.searchParams.get('lapse') === '1';
  const renewalDate = lapse ? '' : formatDate(Math.floor(Date.now() / 1000) + 30 * 86400);
  const result = await renewMember(MS_SECRET, email, { renewalDate, resetDays: !lapse, lapse });
  return json(result, result.ok ? 200 : 404);
}
