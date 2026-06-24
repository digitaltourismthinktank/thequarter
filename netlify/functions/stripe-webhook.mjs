/**
 * The Quarter — Stripe → Memberstack sync (Part B).
 *
 * On a renewal (invoice.paid) we reset the member's day balance to their plan's
 * allowance (with rollover) and update their renewal date. On subscription
 * changes we re-tag their Memberstack plan (incl. pause); on cancellation we
 * lapse the balance. Day-reset + rollover + re-tag rules live in ./_quarter-sync.mjs.
 *
 * Env: STRIPE_WEBHOOK_SECRET (whsec_…), MEMBERSTACK_SECRET_KEY, STRIPE_SECRET_KEY
 * (Customers: Read, to resolve a customer's email). SIM_KEY (optional) unlocks a
 * GET debug view of the most recent events this instance processed.
 */
import crypto from 'node:crypto';
import { renewMember, formatDate, setMemberPlan, targetPlanForPrice, PAUSED_PLAN_ID } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SIM_KEY = process.env.SIM_KEY;

// Best-effort in-memory ring of recently processed events (per warm instance),
// for debugging via GET ?key=SIM_KEY. Not durable — fine for live testing.
const recentEvents = [];
function remember(summary) {
  try {
    recentEvents.push(summary);
    while (recentEvents.length > 20) recentEvents.shift();
  } catch {
    /* ignore */
  }
}

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

/** Process one Stripe event and return a compact summary (for the debug ring). */
async function handleEvent(event) {
  const obj = event?.data?.object || {};
  const base = { at: event?.created, type: event?.type };

  switch (event?.type) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const email = obj.customer_email || (await emailFromCustomer(obj.customer));
      const line = obj.lines?.data?.[0];
      const price = line?.price;
      const target = targetPlanForPrice(price?.id, price?.unit_amount);
      let setResult = null;
      if (email && target && target !== PAUSED_PLAN_ID) setResult = await setMemberPlan(MS_SECRET, email, target);
      let renewResult = null;
      if (email) {
        renewResult = await renewMember(MS_SECRET, email, { renewalDate: formatDate(line?.period?.end || obj.period_end), resetDays: true });
      }
      return { ...base, customer: obj.customer, email, priceId: price?.id, amount: price?.unit_amount, target, setResult, renewResult };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const email = await emailFromCustomer(obj.customer);
      const price = obj.items?.data?.[0]?.price;
      const target = targetPlanForPrice(price?.id, price?.unit_amount);
      let result = null;
      if (email && target === PAUSED_PLAN_ID) {
        result = await setMemberPlan(MS_SECRET, email, PAUSED_PLAN_ID); // pause: freeze days
      } else {
        if (email && target) result = await setMemberPlan(MS_SECRET, email, target); // switch
        if (email) await renewMember(MS_SECRET, email, { renewalDate: formatDate(obj.current_period_end), resetDays: false });
      }
      return { ...base, customer: obj.customer, email, priceId: price?.id, amount: price?.unit_amount, target, result };
    }
    case 'customer.subscription.deleted': {
      const email = await emailFromCustomer(obj.customer);
      let result = null;
      if (email) result = await renewMember(MS_SECRET, email, { renewalDate: '', lapse: true });
      return { ...base, customer: obj.customer, email, result };
    }
    default:
      return { ...base, ignored: true };
  }
}

export default async function handler(req) {
  // Debug: GET with the sim key returns recent events this warm instance processed.
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (SIM_KEY && url.searchParams.get('key') === SIM_KEY) {
      return new Response(JSON.stringify({ count: recentEvents.length, events: recentEvents }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  }

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

  let summary;
  try {
    summary = await handleEvent(event);
  } catch (err) {
    remember({ at: event?.created, type: event?.type, error: String(err?.message || err) });
    console.error('[stripe-webhook]', err);
    return new Response(JSON.stringify({ error: 'handler-error' }), { status: 500 }); // let Stripe retry
  }
  remember(summary);
  return ok();
}
