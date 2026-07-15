/**
 * The Quarter — native in-site subscription checkout (no Payment Links, no redirect).
 *
 *   POST { plan, term, email, name?, startDate? }
 *     → creates/reuses a Stripe Customer, then a Subscription with
 *       payment_behavior=default_incomplete.
 *     → START TODAY (no/empty/past startDate): first invoice is due now; the browser
 *       confirms its PaymentIntent with the Payment Element. → { clientSecret, mode:'payment', … }
 *     → START ON A FUTURE DATE: the sub trials until London-midnight of that day, so the
 *       first PAID invoice lands then. A trialing sub's first invoice is £0 (no
 *       PaymentIntent), so we return the subscription's pending_setup_intent secret — the
 *       browser saves the card via confirmSetup and Stripe auto-charges at trial_end.
 *       → { clientSecret, mode:'setup', … }
 *     → { clientSecret, mode, subscriptionId, customerId }
 *
 * The browser confirms in-site (Elements), then creates the Memberstack account with a
 * password. The Stripe webhook syncs plan/days on invoice.paid (days granted at trial_end
 * for future-dated joins). Prices mirror PLAN_STRIPE_PRICE (lib/plans.ts) + join.mjs.
 * Env: STRIPE_SECRET_KEY (Subscriptions + Customers write).
 */
import { londonWallClockToISO } from './_time.mjs';

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

  // Optional future start date → a trial until London-midnight of that day, so the FIRST
  // PAID invoice (and the day allowance) lands on the start date. Empty / today / past →
  // charge now (the original behaviour). London tz via londonWallClockToISO (DST-aware).
  const startDate = String(body.startDate || '');
  let trialEnd = 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const startUnix = Math.floor(new Date(londonWallClockToISO(startDate, '00:00')).getTime() / 1000);
    if (startUnix > Math.floor(Date.now() / 1000) + 3600) trialEnd = startUnix; // future only
  }
  const future = trialEnd > 0;

  // Guard against stacking subscriptions when a member retries checkout (this is a pay-first
  // flow, so an abandoned attempt leaves an unfinished subscription behind). Reuse an in-flight
  // subscription for this exact price rather than creating a second one, and refuse outright if
  // they already hold this plan — otherwise a retry would double-bill them. A future-dated join
  // sits in `trialing` from creation with a pending_setup_intent; an ABANDONED one (card not yet
  // saved: no default PM, setup not succeeded) is reusable, not a duplicate.
  const existing = await stripe(
    `/v1/subscriptions?customer=${customerId}&status=all&limit=20&expand[0]=data.latest_invoice.payment_intent&expand[1]=data.pending_setup_intent`,
    'GET',
  );
  const forPrice = (existing?.data || []).filter((s) => (s.items?.data || []).some((it) => it.price?.id === priceId));
  const setupPending = (s) =>
    s.status === 'trialing' &&
    !s.default_payment_method &&
    s.pending_setup_intent?.client_secret &&
    s.pending_setup_intent?.status !== 'succeeded';
  // Already a live membership (charged/active), or a future-dated one whose card is already
  // saved (setup done, just awaiting its start date) → refuse. Abandoned trials fall through.
  if (forPrice.some((s) => ['active', 'past_due', 'unpaid'].includes(s.status) || (s.status === 'trialing' && !setupPending(s)))) {
    return json(
      { error: 'already-subscribed', message: 'This email already has a membership started. Please log in — or if you just paid and didn’t finish setting up, contact us and we’ll complete it.' },
      409,
    );
  }
  const reusePay = forPrice.find((s) => s.status === 'incomplete' && s.latest_invoice?.payment_intent?.client_secret);
  if (reusePay) {
    return json({ clientSecret: reusePay.latest_invoice.payment_intent.client_secret, mode: 'payment', subscriptionId: reusePay.id, customerId });
  }
  // Reuse an abandoned trial only for another future-dated attempt (switching back to
  // start-today falls through to a fresh immediate sub; the card-less trial never charges).
  const reuseSetup = future ? forPrice.find(setupPending) : null;
  if (reuseSetup) {
    // Keep the server authoritative on the date: if they changed it on retry, move the trial.
    if (String(reuseSetup.trial_end) !== String(trialEnd)) {
      await stripe(`/v1/subscriptions/${reuseSetup.id}`, 'POST', { trial_end: String(trialEnd), 'metadata[startDate]': startDate });
    }
    return json({ clientSecret: reuseSetup.pending_setup_intent.client_secret, mode: 'setup', subscriptionId: reuseSetup.id, customerId });
  }

  const subForm = {
    customer: customerId,
    'items[0][price]': priceId,
    payment_behavior: 'default_incomplete',
    // Declare a payment method so Stripe always mints a PaymentIntent (→ client_secret) on the
    // first invoice. Without this the default_incomplete sub can return no client_secret and the
    // browser shows "We couldn't set up the payment" (same fix as privatisation.mjs / B18).
    'payment_settings[payment_method_types][0]': 'card',
    'payment_settings[save_default_payment_method]': 'on_subscription',
    'metadata[plan]': plan,
    'metadata[term]': term,
    'metadata[source]': 'native-checkout',
  };
  if (future) {
    // Trialing sub: £0 first invoice now, real charge auto-taken at trial_end from the card
    // saved via the pending_setup_intent (no PaymentIntent exists to confirm during a trial).
    // If a member abandons before saving a card, cancel at trial_end (never bill a no-card sub).
    subForm['trial_end'] = String(trialEnd);
    subForm['trial_settings[end_behavior][missing_payment_method]'] = 'cancel';
    subForm['metadata[startDate]'] = startDate;
    subForm['expand[0]'] = 'pending_setup_intent';
  } else {
    subForm['expand[0]'] = 'latest_invoice.payment_intent';
  }
  const sub = await stripe('/v1/subscriptions', 'POST', subForm);
  if (sub?.error) return json({ error: 'stripe', detail: sub?.error?.message }, 502);
  if (future) {
    const clientSecret = sub?.pending_setup_intent?.client_secret;
    if (!clientSecret) return json({ error: 'stripe', detail: 'no-setup-intent' }, 502);
    return json({ clientSecret, mode: 'setup', subscriptionId: sub.id, customerId });
  }
  const clientSecret = sub?.latest_invoice?.payment_intent?.client_secret;
  if (!clientSecret) return json({ error: 'stripe', detail: 'no-client-secret' }, 502);
  return json({ clientSecret, mode: 'payment', subscriptionId: sub.id, customerId });
}
