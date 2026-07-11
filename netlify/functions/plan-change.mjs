/**
 * The Quarter — native in-dashboard plan change (switch / pause / resume).
 *
 * POST {action:'switch', priceId}  → move the member's live subscription to a new
 *                                    price (prorated). Also clears any pause.
 * POST {action:'pause'}            → pause_collection {behavior:'void'} — billing
 *                                    stops and the day balance freezes (no £0 plan).
 * POST {action:'resume'}           → clear pause_collection; billing + days resume.
 *
 * We verify the member's Memberstack token, find their Stripe customer + active
 * subscription, and drive Stripe only. The Stripe webhook (customer.subscription.
 * updated) then re-tags the member's Memberstack plan + day balance, so plan state
 * always flows through the one sync path.
 *
 * Requires Netlify env: MEMBERSTACK_SECRET_KEY, STRIPE_SECRET_KEY (Subscriptions:
 * Write, Customers: Read). Returns 503 until both are set.
 */
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

/**
 * Prices we permit switching to — never trust a client-supplied price blindly.
 * Mirrors PLAN_STRIPE_PRICE in lib/plans.ts (monthly + annual for the three core
 * plans, plus the annual-only Hybrid Office).
 */
const ALLOWED_PRICES = new Set([
  'price_0PgRo1w5GSGOu4zJdycNlCpy', // Visitor monthly
  'price_0Tn4ucw5GSGOu4zJ7UqWhlO8', // Visitor annual
  'price_0PgRphw5GSGOu4zJ0dnCFwjp', // Resident monthly
  'price_0Tn4Nmw5GSGOu4zJwV8L1Imz', // Resident annual
  'price_0PgS1pw5GSGOu4zJQpVlN6Gm', // Citizen monthly
  'price_0Tn4MXw5GSGOu4zJLe6oAQEu', // Citizen annual
  'price_0OtrBRw5GSGOu4zJC3vsROvC', // Hybrid Office (annual)
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${STRIPE_SECRET}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

/** Find the member's active membership subscription (the customer that carries one). */
async function findSubscription(email) {
  const customers = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=10`, 'GET');
  for (const c of customers?.data || []) {
    const subs = await stripe(`/v1/subscriptions?customer=${c.id}&status=active&limit=1`, 'GET');
    if (subs?.data?.length) return subs.data[0];
  }
  return null;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!MS_SECRET || !STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  let token;
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
  let body = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }
  if (!token) token = body?.token;
  if (!token) return json({ error: 'missing-token' }, 401);

  const action = body?.action;
  if (!['switch', 'pause', 'resume'].includes(action)) return json({ error: 'unknown-action' }, 400);
  if (action === 'switch' && !ALLOWED_PRICES.has(body?.priceId)) return json({ error: 'bad-price' }, 400);

  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const verified = await admin.verifyToken({ token });
    if (!verified?.id) return json({ error: 'invalid-token' }, 401);
    const { data: member } = await admin.members.retrieve({ id: verified.id });
    const email = member?.auth?.email || member?.email;
    if (!email) return json({ error: 'no-email' }, 404);

    const sub = await findSubscription(email);
    if (!sub) return json({ error: 'no-subscription' }, 404);

    if (action === 'switch') {
      const itemId = sub.items?.data?.[0]?.id;
      if (!itemId) return json({ error: 'no-item' }, 409);
      const updated = await stripe(`/v1/subscriptions/${sub.id}`, 'POST', {
        'items[0][id]': itemId,
        'items[0][price]': body.priceId,
        proration_behavior: 'create_prorations',
        pause_collection: '', // switching resumes a paused subscription
      });
      if (updated?.error) return json({ error: 'stripe', detail: updated.error.message }, 502);
      return json({ ok: true });
    }

    if (action === 'pause') {
      const updated = await stripe(`/v1/subscriptions/${sub.id}`, 'POST', { 'pause_collection[behavior]': 'void' });
      if (updated?.error) return json({ error: 'stripe', detail: updated.error.message }, 502);
      return json({ ok: true, paused: true });
    }

    // resume
    const updated = await stripe(`/v1/subscriptions/${sub.id}`, 'POST', { pause_collection: '' });
    if (updated?.error) return json({ error: 'stripe', detail: updated.error.message }, 502);
    return json({ ok: true, paused: false });
  } catch (err) {
    return json({ error: 'failed', detail: String(err?.message || err) }, 500);
  }
}
