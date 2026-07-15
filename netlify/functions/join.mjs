/**
 * The Quarter — join with a chosen start date.
 *
 * The plan CTAs normally point at static Stripe Payment Links, which can't carry a
 * future start date. This creates a Checkout Session (subscription mode) for the
 * chosen plan + term, trialing until the start date so the FIRST invoice lands then.
 *
 *   POST { plan, term, startDate?, email? }  → { url }   (Stripe Checkout)
 *
 * plan: 'visitor' | 'resident' | 'citizen' | 'hybrid-office'; term: 'monthly' | 'annual'.
 * Price ids mirror PLAN_STRIPE_PRICE in lib/plans.ts. Env: STRIPE_SECRET_KEY.
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

const midnightUnix = (dateStr) => Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan || '');
  const term = body.term === 'annual' ? 'annual' : 'monthly';
  const priceId = PLAN_PRICES[plan]?.[term] || PLAN_PRICES[plan]?.annual; // hybrid-office is annual-only
  if (!priceId) return json({ error: 'bad-plan' }, 400);

  const origin = new URL(req.url).origin;
  const startDate = String(body.startDate || '');
  const form = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'payment_method_types[0]': 'card',
    'payment_method_types[1]': 'bacs_debit',
    allow_promotion_codes: 'true',
    success_url: `${origin}/welcome/${plan}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/plans/`,
    'metadata[plan]': plan,
    'metadata[term]': term,
  };
  if (body.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email))) form.customer_email = String(body.email);

  // Trial until the chosen start date so the first invoice lands then (future only).
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const startUnix = midnightUnix(startDate);
    if (startUnix > Math.floor(Date.now() / 1000) + 3600) {
      form['subscription_data[trial_end]'] = String(startUnix);
      form['metadata[startDate]'] = startDate;
    }
  }

  const session = await stripe('/v1/checkout/sessions', 'POST', form);
  if (session?.error || !session?.url) return json({ error: 'stripe', detail: session?.error?.message }, 502);
  return json({ url: session.url });
}
