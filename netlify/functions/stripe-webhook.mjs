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
import {
  renewMember,
  formatDate,
  setMemberPlan,
  targetPlanForPrice,
  PAUSED_PLAN_ID,
  getMemberSync,
  stampSync,
} from './_quarter-sync.mjs';

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

/**
 * Process one Stripe event and return a compact summary (for the debug ring).
 *
 * Stale-event guard: Stripe doesn't guarantee delivery order and retries failed
 * events, so we stamp each member with the time/id of the last event we applied
 * and skip any event that's older (or a duplicate). This makes the member always
 * reflect the LATEST change, whatever order events arrive in.
 */
async function handleEvent(event) {
  const obj = event?.data?.object || {};
  const type = event?.type;
  const created = event?.created || 0;
  const eventId = event?.id;
  const base = { at: created, id: eventId, type };

  // Resolve the member email for the event types we handle.
  let email = null;
  if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
    email = obj.customer_email || (await emailFromCustomer(obj.customer));
  } else if (type === 'customer.subscription.created' || type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
    email = await emailFromCustomer(obj.customer);
  } else {
    return { ...base, ignored: true };
  }
  if (!email) return { ...base, noEmail: true };

  // Stale-event guard.
  const { member, lastSyncAt, lastEventId, metaData } = await getMemberSync(MS_SECRET, email);
  if (!member) return { ...base, email, noMember: true };
  if (eventId && eventId === lastEventId) return { ...base, email, skipped: 'duplicate' };
  if (created < lastSyncAt) return { ...base, email, skipped: 'stale', lastSyncAt };

  let applied = {};
  if (type === 'customer.subscription.deleted') {
    await renewMember(MS_SECRET, email, { renewalDate: '', lapse: true });
    applied = { lapsed: true };
  } else if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
    // Only a genuine renewal (billing_reason 'subscription_cycle') resets the day
    // balance, with rollover. Plan-change prorations (subscription_update/create)
    // are handled by the subscription.* events; for those we just refresh the date.
    const line = obj.lines?.data?.[0];
    const isRenewal = obj.billing_reason === 'subscription_cycle';
    await renewMember(MS_SECRET, email, {
      renewalDate: formatDate(line?.period?.end || obj.period_end),
      resetDays: isRenewal,
    });
    applied = { billingReason: obj.billing_reason, resetDays: isRenewal };
  } else {
    // customer.subscription.created / updated
    const price = obj.items?.data?.[0]?.price;
    const target = targetPlanForPrice(price?.id, price?.unit_amount);
    if (target === PAUSED_PLAN_ID) {
      await setMemberPlan(MS_SECRET, email, PAUSED_PLAN_ID); // pause: freeze days
      applied = { target, paused: true };
    } else {
      let changed = false;
      if (target) {
        const r = await setMemberPlan(MS_SECRET, email, target);
        changed = (r?.added?.length || 0) > 0;
      }
      // On an actual plan change, set days to the NEW plan's allowance (flat, no
      // rollover); otherwise just refresh the renewal date.
      await renewMember(MS_SECRET, email, { renewalDate: formatDate(obj.current_period_end), resetDays: changed, flat: true });
      applied = { target, changed };
    }
  }

  await stampSync(MS_SECRET, member.id, metaData, created, eventId);
  return { ...base, email, ...applied };
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
