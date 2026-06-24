/**
 * The Quarter — Stripe → Memberstack sync (Part B).
 *
 * On a renewal (invoice.paid) we reset the member's day balance to their plan's
 * allowance (with rollover) and update their renewal date — removing the manual
 * reset. On subscription changes we refresh the renewal date; on cancellation we
 * lapse the balance. Keeps Memberstack in lockstep with Stripe.
 *
 * The day-reset + rollover rule lives in ./_quarter-sync.mjs (shared with the
 * sim-renewal test endpoint). Netlify env vars required: STRIPE_WEBHOOK_SECRET
 * (whsec_…), MEMBERSTACK_SECRET_KEY. STRIPE_SECRET_KEY (Customers: Read) resolves
 * a customer's email when the event doesn't include it.
 */
import crypto from 'node:crypto';
import { renewMember, formatDate, setMemberPlan, targetPlanForPrice, PAUSED_PLAN_ID } from './_quarter-sync.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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

async function handleEvent(event) {
  const obj = event?.data?.object || {};
  switch (event?.type) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const email = obj.customer_email || (await emailFromCustomer(obj.customer));
      if (!email) return;
      const line = obj.lines?.data?.[0];
      const price = line?.price;
      const target = targetPlanForPrice(price?.id, price?.unit_amount);
      // Keep the plan tag correct on payment too — covers a fresh subscription even
      // if customer.subscription.created isn't subscribed. Skip the £0 pause price.
      if (target && target !== PAUSED_PLAN_ID) await setMemberPlan(MS_SECRET, email, target);
      const renewalDate = formatDate(line?.period?.end || obj.period_end);
      await renewMember(MS_SECRET, email, { renewalDate, resetDays: true });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const email = await emailFromCustomer(obj.customer);
      if (!email) return;
      const price = obj.items?.data?.[0]?.price;
      const target = targetPlanForPrice(price?.id, price?.unit_amount);
      if (target === PAUSED_PLAN_ID) {
        // Paused (£0 plan): move to the Paused tier and freeze the day balance.
        await setMemberPlan(MS_SECRET, email, PAUSED_PLAN_ID);
        return;
      }
      if (target) await setMemberPlan(MS_SECRET, email, target); // plan switch → re-tag
      // Refresh renewal date only; the day balance resets on the actual payment.
      await renewMember(MS_SECRET, email, { renewalDate: formatDate(obj.current_period_end), resetDays: false });
      return;
    }
    case 'customer.subscription.deleted': {
      const email = await emailFromCustomer(obj.customer);
      if (!email) return;
      await renewMember(MS_SECRET, email, { renewalDate: '', lapse: true });
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
