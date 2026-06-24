/**
 * The Quarter — one-click Stripe billing portal.
 *
 * Flow: the logged-in member's dashboard POSTs their Memberstack token here.
 * We verify it server-side (Memberstack Admin, secret key), look up the member's
 * email, find their Stripe customer, and create a one-time billing-portal session
 * so they land straight in their portal — no Stripe login / email code.
 *
 * Requires Netlify env vars: MEMBERSTACK_SECRET_KEY, STRIPE_SECRET_KEY.
 * Until both are set it returns 503 and the dashboard falls back to the generic
 * Stripe billing-portal link.
 */
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const SITE_URL = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.netlify.app').replace(/\/$/, '');

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!MS_SECRET || !STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  // Read the member token from the Authorization header or JSON body.
  let token;
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    try {
      token = (await req.json())?.token;
    } catch {
      /* no body */
    }
  }
  if (!token) return json({ error: 'missing-token' }, 401);

  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const verified = await admin.verifyToken({ token });
    if (!verified?.id) return json({ error: 'invalid-token' }, 401);

    const { data: member } = await admin.members.retrieve({ id: verified.id });
    const email = member?.auth?.email || member?.email;
    if (!email) return json({ error: 'no-email' }, 404);

    const customers = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=10`, 'GET');
    const list = customers?.data || [];
    if (list.length === 0) return json({ error: 'no-customer' }, 404);
    // Prefer a customer that actually has a subscription — Stripe can hold several
    // customers with the same email, and only one carries the membership.
    let customerId = list[0].id;
    for (const c of list) {
      const subs = await stripe(`/v1/subscriptions?customer=${c.id}&status=all&limit=1`, 'GET');
      if (subs?.data?.length) {
        customerId = c.id;
        break;
      }
    }

    const portalForm = {
      customer: customerId,
      return_url: `${SITE_URL}/dashboard/`,
    };
    // Optional: use the specific Stripe billing-portal configuration (defines
    // which plans members can switch between).
    if (process.env.STRIPE_BILLING_PORTAL_CONFIG) {
      portalForm.configuration = process.env.STRIPE_BILLING_PORTAL_CONFIG;
    }
    const session = await stripe('/v1/billing_portal/sessions', 'POST', portalForm);
    if (!session?.url) return json({ error: 'no-session', detail: session?.error?.message }, 502);

    return json({ url: session.url });
  } catch (err) {
    return json({ error: 'verify-failed', detail: String(err?.message || err) }, 401);
  }
}
