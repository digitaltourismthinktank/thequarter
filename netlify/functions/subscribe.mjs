/**
 * The Quarter — native in-site subscription checkout (no Payment Links, no redirect).
 *
 *   POST { plan, term, email, name? }
 *     → creates/reuses a Stripe Customer, then a Subscription with
 *       payment_behavior=default_incomplete (so nothing is charged until the browser
 *       confirms the first-invoice PaymentIntent with Stripe's Payment Element).
 *     → { clientSecret, subscriptionId, customerId }
 *
 * The browser confirms in-site (Elements), then creates the Memberstack account with a
 * password. The Stripe webhook syncs plan/days on invoice.paid. No free trial: the first
 * invoice is due now. Prices mirror PLAN_STRIPE_PRICE (lib/plans.ts) + join.mjs.
 * Env: STRIPE_SECRET_KEY (Subscriptions + Customers write).
 */
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const PLAN_PRICES = {
  visitor: { monthly: 'price_0PgRo1w5GSGOu4zJdycNlCpy', annual: 'price_0Tn4ucw5GSGOu4zJ7UqWhlO8' },
  resident: { monthly: 'price_0PgRphw5GSGOu4zJ0dnCFwjp', annual: 'price_0Tn4Nmw5GSGOu4zJwV8L1Imz' },
  citizen: { monthly: 'price_0PgS1pw5GSGOu4zJQpVlN6Gm', annual: 'price_0Tn4MXw5GSGOu4zJLe6oAQEu' },
  'hybrid-office': { annual: 'price_0OtrBRw5GSGOu4zJC3vsROvC' },
};

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || '');
  const term = body.term === 'annual' ? 'annual' : 'monthly';
  const priceId = PLAN_PRICES[plan]?.[term] || PLAN_PRICES[plan]?.annual; // hybrid-office is annual-only
  if (!priceId) return json({ error: 'bad-plan' }, 400);
  const email = String(body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ error: 'bad-email' }, 400);
  const name = String(body.name || '').trim();

  // Reuse an existing Stripe customer with this email (avoid duplicates on retry), else create one.
  let customerId = '';
  const found = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=1`, 'GET');
  if (found?.data?.[0]?.id) customerId = found.data[0].id;
  if (!customerId) {
    const cust = await stripe('/v1/customers', 'POST', { email, ...(name ? { name } : {}) });
    if (cust?.error || !cust?.id) return json({ error: 'stripe', detail: cust?.error?.message }, 502);
    customerId = cust.id;
  }

  // Guard against stacking subscriptions when a member retries checkout (this is a pay-first
  // flow, so an abandoned attempt leaves an unfinished subscription behind). Reuse an
  // incomplete subscription for this exact price rather than creating a second one, and refuse
  // outright if they already hold this plan — otherwise a retry would double-bill them.
  const existing = await stripe(
    `/v1/subscriptions?customer=${customerId}&status=all&limit=20&expand[0]=data.latest_invoice.payment_intent`,
    'GET',
  );
  const forPrice = (existing?.data || []).filter((s) => (s.items?.data || []).some((it) => it.price?.id === priceId));
  if (forPrice.some((s) => ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status))) {
    return json(
      { error: 'already-subscribed', message: 'This email already has a membership started. Please log in — or if you just paid and didn’t finish setting up, contact us and we’ll complete it.' },
      409,
    );
  }
  const reuse = forPrice.find((s) => s.status === 'incomplete' && s.latest_invoice?.payment_intent?.client_secret);
  if (reuse) {
    return json({ clientSecret: reuse.latest_invoice.payment_intent.client_secret, subscriptionId: reuse.id, customerId });
  }

  const sub = await stripe('/v1/subscriptions', 'POST', {
    customer: customerId,
    'items[0][price]': priceId,
    payment_behavior: 'default_incomplete',
    'payment_settings[save_default_payment_method]': 'on_subscription',
    'expand[0]': 'latest_invoice.payment_intent',
    'metadata[plan]': plan,
    'metadata[term]': term,
    'metadata[source]': 'native-checkout',
  });
  const clientSecret = sub?.latest_invoice?.payment_intent?.client_secret;
  if (sub?.error || !clientSecret) return json({ error: 'stripe', detail: sub?.error?.message || 'no-client-secret' }, 502);
  return json({ clientSecret, subscriptionId: sub.id, customerId });
}
