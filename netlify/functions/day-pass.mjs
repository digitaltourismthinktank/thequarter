/**
 * The Quarter — native Day Pass checkout (£21.60 one-off; replaces the Typeform).
 *
 *   POST { firstName, lastName, company?, email, date }  → { clientSecret }   (Stripe PaymentIntent)
 *
 * The browser confirms in-site with the Payment Element. The Stripe webhook finalises
 * on payment_intent.succeeded (metadata.kind='day-pass') — records the pass + emails
 * the confirmation. No account is created (it's a single guest day). Env: STRIPE_SECRET_KEY.
 */
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const DAY_PASS_PENCE = 2160; // £21.60 inc VAT — keep in step with DAY_PASS_PRICE (lib/rewards.ts)

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
  const email = String(body.email || '').trim().toLowerCase();
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const company = String(body.company || '').trim();
  const name = `${firstName} ${lastName}`.trim();
  const date = String(body.date || '').trim();
  if (!isEmail(email)) return json({ error: 'bad-email' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);

  const pi = await stripe('/v1/payment_intents', 'POST', {
    amount: String(DAY_PASS_PENCE),
    currency: 'gbp',
    'automatic_payment_methods[enabled]': 'true',
    receipt_email: email,
    description: `The Quarter — Day Pass (${date})`,
    'metadata[kind]': 'day-pass',
    'metadata[email]': email,
    'metadata[name]': name,
    'metadata[company]': company,
    'metadata[date]': date,
  });
  if (pi?.error || !pi?.client_secret) return json({ error: 'stripe', detail: pi?.error?.message }, 502);
  return json({ clientSecret: pi.client_secret });
}
