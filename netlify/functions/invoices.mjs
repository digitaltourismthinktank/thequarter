/**
 * The Quarter — member billing self-service (invoices + card update).
 *
 * GET  (member token)                         → { invoices: [...] }  (their Stripe invoices)
 * POST {action:'setup-intent'}                → { clientSecret }      (to add/replace a card via Stripe Elements)
 * POST {action:'set-default', paymentMethodId}→ { ok }               (make the new card the default + clear any payment flag)
 *
 * The card number is only ever entered into Stripe's own iframe on the client
 * (Stripe Elements) — this server never sees it. Requires MEMBERSTACK_SECRET_KEY
 * and STRIPE_SECRET_KEY (Invoices: Read, Customers: Write, SetupIntents: Write).
 */
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function stripe(path, method, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

/** The customer that carries the membership (prefer one with a subscription). */
async function findCustomerId(email) {
  const customers = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=10`, 'GET');
  const list = customers?.data || [];
  if (!list.length) return null;
  for (const c of list) {
    const subs = await stripe(`/v1/subscriptions?customer=${c.id}&status=all&limit=1`, 'GET');
    if (subs?.data?.length) return c.id;
  }
  return list[0].id;
}

export default async function handler(req) {
  if (!MS_SECRET || !STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  let token;
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
  let body = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      /* no body */
    }
  }
  if (!token) token = body?.token;
  if (!token) return json({ error: 'missing-token' }, 401);

  let member;
  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const verified = await admin.verifyToken({ token });
    if (!verified?.id) return json({ error: 'invalid-token' }, 401);
    const r = await admin.members.retrieve({ id: verified.id });
    member = r?.data;
  } catch (err) {
    return json({ error: 'verify-failed', detail: String(err?.message || err) }, 401);
  }
  const email = member?.auth?.email || member?.email;
  if (!email) return json({ error: 'no-email' }, 404);

  const customerId = await findCustomerId(email);
  if (!customerId) return json({ error: 'no-customer' }, 404);

  // --- List invoices ---
  if (req.method === 'GET') {
    const inv = await stripe(`/v1/invoices?customer=${customerId}&limit=24`, 'GET');
    const invoices = (inv?.data || []).map((i) => ({
      id: i.id,
      number: i.number || null,
      created: i.created ? i.created * 1000 : null,
      total: (i.total ?? i.amount_paid ?? 0) / 100,
      currency: (i.currency || 'gbp').toUpperCase(),
      status: i.status || 'open',
      pdf: i.invoice_pdf || null,
      url: i.hosted_invoice_url || null,
    }));
    return json({ invoices });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  // --- Start a card update: a SetupIntent the client confirms with Stripe Elements ---
  if (body.action === 'setup-intent') {
    const si = await stripe('/v1/setup_intents', 'POST', { customer: customerId, 'payment_method_types[0]': 'card' });
    if (si?.error || !si?.client_secret) return json({ error: 'stripe', detail: si?.error?.message }, 502);
    return json({ clientSecret: si.client_secret });
  }

  // --- Make the just-added card the default (customer + subscription), clear payment flag ---
  if (body.action === 'set-default') {
    const pm = body.paymentMethodId;
    if (!pm) return json({ error: 'missing-pm' }, 400);
    const cust = await stripe(`/v1/customers/${customerId}`, 'POST', { 'invoice_settings[default_payment_method]': pm });
    if (cust?.error) return json({ error: 'stripe', detail: cust.error.message }, 502);
    // Point the active subscription at the new card too.
    const subs = await stripe(`/v1/subscriptions?customer=${customerId}&status=active&limit=1`, 'GET');
    const sub = subs?.data?.[0];
    if (sub) await stripe(`/v1/subscriptions/${sub.id}`, 'POST', { default_payment_method: pm });
    // Clear any payment-issue flag — they've just fixed their card.
    if (member?.metaData?.paymentIssue) {
      const meta = { ...(member.metaData || {}) };
      delete meta.paymentIssue;
      const admin = memberstackAdmin.init(MS_SECRET);
      await admin.members.update({ id: member.id, data: { metaData: meta } });
    }
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
}
