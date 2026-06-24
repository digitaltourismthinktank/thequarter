/**
 * The Quarter — Stripe → Memberstack sync (Part B).
 *
 * On a renewal (invoice.paid) we reset the member's day balance to their plan's
 * allowance and update their renewal date — removing the manual reset. On
 * subscription changes we refresh the renewal date; on cancellation we lapse the
 * balance. Keeps Memberstack in lockstep with Stripe.
 *
 * Netlify env vars required: STRIPE_WEBHOOK_SECRET (whsec_…), MEMBERSTACK_SECRET_KEY.
 * Uses STRIPE_SECRET_KEY (Customers: Read) to resolve a customer's email when the
 * event doesn't include it.
 *
 * Plan allowances keyed by Memberstack plan id (null = unlimited). Citizen &
 * Resident are known; set MS_PLN_VISITOR / MS_PLN_HYBRID env vars (the pln_… ids)
 * to activate those — no code change needed. Day Pass is one-off (Typeform), so
 * it has no renewal here.
 */
import crypto from 'node:crypto';
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const PLAN_ALLOWANCE = {
  [process.env.MS_PLN_CITIZEN || 'pln_citizen-plan-q9oa04p9']: null, // unlimited
  [process.env.MS_PLN_RESIDENT || 'pln_resident-plan-mqjy0f6w']: 10,
  ...(process.env.MS_PLN_VISITOR ? { [process.env.MS_PLN_VISITOR]: 5 } : {}),
  ...(process.env.MS_PLN_HYBRID ? { [process.env.MS_PLN_HYBRID]: 12 } : {}),
};

function ok(body = { received: true }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function verifyStripeSignature(rawBody, header, secret) {
  if (!header) return false;
  const items = header.split(',').map((s) => s.trim());
  const t = items.find((i) => i.startsWith('t='))?.slice(2);
  const v1s = items.filter((i) => i.startsWith('v1=')).map((i) => i.slice(3));
  if (!t || v1s.length === 0) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const exp = Buffer.from(expected);
  return v1s.some((v) => {
    const got = Buffer.from(v);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return '';
  const d = new Date(unixSeconds * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

async function emailFromCustomer(customerId) {
  if (!customerId || !STRIPE_SECRET) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { authorization: `Bearer ${STRIPE_SECRET}` },
    });
    const c = await res.json();
    return c?.email || null;
  } catch {
    return null;
  }
}

/** Day allowance for a member from their Memberstack plan(s); null = unlimited. */
function allowanceForMember(member) {
  let found;
  for (const c of member?.planConnections || []) {
    if (c.planId in PLAN_ALLOWANCE) {
      const a = PLAN_ALLOWANCE[c.planId];
      if (a === null) return null; // unlimited wins
      if (found === undefined) found = a;
    }
  }
  return found;
}

async function syncMember(email, { renewal, resetDays, lapse }) {
  const admin = memberstackAdmin.init(MS_SECRET);
  let member;
  try {
    const r = await admin.members.retrieve({ email });
    member = r?.data;
  } catch {
    return; // not a member / lookup failed — ignore
  }
  if (!member) return;

  const fields = {};
  if (renewal !== undefined) fields['renewal-date'] = renewal;
  if (lapse) {
    fields['days-remaining'] = '0';
  } else if (resetDays) {
    const allowance = allowanceForMember(member);
    if (allowance === null) fields['days-remaining'] = 'Unlimited';
    else if (allowance !== undefined) fields['days-remaining'] = String(allowance);
  }
  if (Object.keys(fields).length === 0) return;
  await admin.members.update({ id: member.id, data: { customFields: fields } });
}

async function handleEvent(event) {
  const obj = event?.data?.object || {};
  switch (event?.type) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const email = obj.customer_email || (await emailFromCustomer(obj.customer));
      if (!email) return;
      const renewal = formatDate(obj.lines?.data?.[0]?.period?.end || obj.period_end);
      await syncMember(email, { renewal, resetDays: true });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const email = await emailFromCustomer(obj.customer);
      if (!email) return;
      // Refresh renewal date only; the day balance resets on the actual payment.
      await syncMember(email, { renewal: formatDate(obj.current_period_end) });
      return;
    }
    case 'customer.subscription.deleted': {
      const email = await emailFromCustomer(obj.customer);
      if (!email) return;
      await syncMember(email, { renewal: '', lapse: true });
      return;
    }
    default:
      return; // ignore other events
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!MS_SECRET || !WEBHOOK_SECRET) return new Response(JSON.stringify({ error: 'not-configured' }), { status: 503 });

  const rawBody = await req.text();
  if (!verifyStripeSignature(rawBody, req.headers.get('stripe-signature') || '', WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: 'bad-signature' }), { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'bad-json' }), { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error('[stripe-webhook]', err);
    return new Response(JSON.stringify({ error: 'handler-error' }), { status: 500 }); // let Stripe retry
  }
  return ok();
}
