/**
 * The Quarter — team-room privatisation (custom Stripe subscription, billed quarterly).
 *
 *   POST {action:'quote',    roomSlug, frequency}                       → { monthly, quarterly, lines }
 *   POST {action:'checkout', roomSlug, frequency, days[], startDate,
 *         company, name, email, members}                                → { url }   (Stripe Checkout)
 *
 * Only ONE of the two rooms may be privatised at a time (so two open workspaces
 * always remain). Price is computed server-side (never trusted from the client),
 * the monthly figure billed 3-monthly. Checkout runs in subscription mode against a
 * price created on the fly; the subscription trials until the chosen start date so
 * the first quarterly invoice lands then. The webhook records the privatisation +
 * blocks the room on checkout.session.completed (metadata.kind==='privatisation').
 *
 * Env: STRIPE_SECRET_KEY (Prices/Checkout/Subscriptions: Write), Airtable.
 */
import { listRecords, T, F, airtableReady, esc } from './_airtable.mjs';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const ROOMS = {
  'the-hop-yard': { name: 'The Hop Yard', capacity: 7, monthly: { one: 588, two: 966, all: 1806 } },
  'the-vineyard': { name: 'The Vineyard', capacity: 6, monthly: { one: 504, two: 828, all: 1548 } },
};
const FREQ_DAYS = { one: 1, two: 2, all: 5 };
const FREQ_LABEL = { one: 'one day a week', two: 'two days a week', all: 'every working day' };
const QUARTERLY = 3;
const MIN_MEMBERS = 5;

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

/** Any confirmed privatisation currently on the books (the one-at-a-time lock). */
async function activePrivatisation() {
  const recs = await listRecords(T.bookings, { filterByFormula: `AND({Status}='Confirmed', {Kind}='Privatisation')` });
  return recs[0] || null;
}

const midnightUnix = (dateStr) => Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!STRIPE_SECRET || !airtableReady()) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const { action, roomSlug, frequency } = body;
  const room = ROOMS[roomSlug];
  if (!room) return json({ error: 'bad-room' }, 400);
  const monthly = room.monthly[frequency];
  if (!monthly) return json({ error: 'bad-frequency' }, 400);
  const quarterly = monthly * QUARTERLY;

  if (action === 'quote') {
    return json({
      monthly,
      quarterly,
      lines: [
        { label: `${room.name} · ${FREQ_LABEL[frequency]}`, amount: monthly },
        { label: 'Billed quarterly (3 months)', amount: quarterly },
      ],
    });
  }

  // Embedded (in-site) privatisation checkout — charges the first quarter now via the
  // Payment Element, no redirect, no trial. Access starts on startDate via room blocks.
  if (action === 'subscribe') {
    const days = Array.isArray(body.days) ? body.days : [];
    const startDate = String(body.startDate || '');
    const company = String(body.company || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const jobTitle = String(body.jobTitle || '').trim();
    const phone = String(body.phone || '').trim();
    // Back-compat: keep a single 'name' for anything downstream that reads it.
    const name = String(body.name || '').trim() || `${firstName} ${lastName}`.trim();
    const email = String(body.email || '').trim().toLowerCase();
    const members = Number(body.members) || 0;
    if (!company) return json({ error: 'missing-company' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad-email' }, 400);
    if (members < MIN_MEMBERS) return json({ error: 'min-members' }, 400);
    if (members > room.capacity) return json({ error: 'over-capacity' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return json({ error: 'bad-date' }, 400);
    const need = FREQ_DAYS[frequency];
    if (days.length !== need) return json({ error: 'days-mismatch' }, 400);
    const active = await activePrivatisation();
    if (active) return json({ error: 'already-privatised' }, 409);

    const price = await stripe('/v1/prices', 'POST', {
      currency: 'gbp',
      unit_amount: String(Math.round(quarterly * 100)),
      'recurring[interval]': 'month',
      'recurring[interval_count]': '3',
      'product_data[name]': `${room.name} privatisation — ${FREQ_LABEL[frequency]}`,
    });
    if (price?.error || !price?.id) return json({ error: 'stripe-price', detail: price?.error?.message }, 502);

    let customerId = '';
    const found = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=1`, 'GET');
    if (found?.data?.[0]?.id) customerId = found.data[0].id;
    if (!customerId) {
      const cust = await stripe('/v1/customers', 'POST', { email, ...(name ? { name } : {}), ...(phone ? { phone } : {}) });
      if (cust?.error || !cust?.id) return json({ error: 'stripe', detail: cust?.error?.message }, 502);
      customerId = cust.id;
    }

    const sub = await stripe('/v1/subscriptions', 'POST', {
      customer: customerId,
      'items[0][price]': price.id,
      payment_behavior: 'default_incomplete',
      // Declare card + BACS Direct Debit so Stripe always mints a PaymentIntent
      // (and its client_secret). Both are enabled in the dashboard; currency is gbp.
      'payment_settings[payment_method_types][0]': 'card',
      'payment_settings[payment_method_types][1]': 'bacs_debit',
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'expand[0]': 'latest_invoice.payment_intent',
      'metadata[kind]': 'privatisation',
      'metadata[roomSlug]': roomSlug,
      'metadata[roomName]': room.name,
      'metadata[frequency]': frequency,
      'metadata[days]': days.join(','),
      'metadata[startDate]': startDate,
      'metadata[company]': company,
      'metadata[name]': name,
      'metadata[firstName]': firstName,
      'metadata[lastName]': lastName,
      'metadata[jobTitle]': jobTitle,
      'metadata[phone]': phone,
      'metadata[email]': email,
      'metadata[members]': String(members),
    });
    const clientSecret = sub?.latest_invoice?.payment_intent?.client_secret;
    if (sub?.error || !clientSecret) return json({ error: 'stripe', detail: sub?.error?.message || 'no-client-secret' }, 502);
    return json({ clientSecret, subscriptionId: sub.id });
  }

  if (action === 'checkout') {
    const days = Array.isArray(body.days) ? body.days : [];
    const startDate = String(body.startDate || '');
    const company = String(body.company || '').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const members = Number(body.members) || 0;

    if (!company) return json({ error: 'missing-company' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad-email' }, 400);
    if (members < MIN_MEMBERS) return json({ error: 'min-members' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return json({ error: 'bad-date' }, 400);
    // Frequency 'all' books the whole week; otherwise the chosen days must match.
    const need = FREQ_DAYS[frequency];
    if (frequency !== 'all' && days.length !== need) return json({ error: 'days-mismatch' }, 400);

    // One-at-a-time lock — refuse if either room is already privatised.
    const active = await activePrivatisation();
    if (active) return json({ error: 'already-privatised' }, 409);

    const origin = new URL(req.url).origin;
    // Create a bespoke quarterly price (product created inline).
    const price = await stripe('/v1/prices', 'POST', {
      currency: 'gbp',
      unit_amount: String(Math.round(quarterly * 100)),
      'recurring[interval]': 'month',
      'recurring[interval_count]': '3',
      'product_data[name]': `${room.name} privatisation — ${FREQ_LABEL[frequency]}`,
    });
    if (price?.error || !price?.id) return json({ error: 'stripe-price', detail: price?.error?.message }, 502);

    const startUnix = midnightUnix(startDate);
    const nowUnix = Math.floor(Date.now() / 1000);
    const form = {
      mode: 'subscription',
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
      customer_email: email,
      success_url: `${origin}/privatise/?done=1`,
      cancel_url: `${origin}/privatise/`,
      'metadata[kind]': 'privatisation',
      'metadata[roomSlug]': roomSlug,
      'metadata[roomName]': room.name,
      'metadata[frequency]': frequency,
      'metadata[days]': days.join(','),
      'metadata[startDate]': startDate,
      'metadata[company]': company,
      'metadata[name]': name,
      'metadata[email]': email,
      'metadata[members]': String(members),
      'subscription_data[metadata][kind]': 'privatisation',
      'subscription_data[metadata][roomSlug]': roomSlug,
      'subscription_data[metadata][company]': company,
    };
    // Trial until the chosen start date so the first quarterly invoice lands then
    // (only if it's in the future; otherwise bill immediately).
    if (startUnix > nowUnix + 3600) form['subscription_data[trial_end]'] = String(startUnix);

    const session = await stripe('/v1/checkout/sessions', 'POST', form);
    if (session?.error || !session?.url) return json({ error: 'stripe-session', detail: session?.error?.message }, 502);
    return json({ url: session.url });
  }

  return json({ error: 'unknown-action' }, 400);
}
