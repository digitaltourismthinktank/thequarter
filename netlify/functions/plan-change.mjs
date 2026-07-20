/**
 * The Quarter — native in-dashboard plan change (switch / pause / resume).
 *
 * POST {action:'switch', priceId}  → move the member's live subscription to a new
 *                                    price (prorated). Also clears any pause.
 * POST {action:'pause'}            → pause_collection {behavior:'void'} — billing
 *                                    stops and the day balance freezes (no £0 plan).
 * POST {action:'resume'}           → clear pause_collection; billing + days resume.
 *
 * We verify the member's Memberstack token, find their Stripe customer + active
 * subscription, and drive Stripe only. The Stripe webhook (customer.subscription.
 * updated) then re-tags the member's Memberstack plan + day balance, so plan state
 * always flows through the one sync path.
 *
 * Requires Netlify env: MEMBERSTACK_SECRET_KEY, STRIPE_SECRET_KEY (Subscriptions:
 * Write, Customers: Read). Returns 503 until both are set.
 */
import memberstackAdmin from '@memberstack/admin';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';
import { pushToEmail, pushToAdmins } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

/** Notify ops (info@) + the member about a plan change. Best-effort (no-op without Resend). */
async function notifyPlanChange(member, email, what) {
  const fn = String(member?.customFields?.['first-name'] || '').trim();
  const memberCopy = {
    paused: 'Your membership is paused — billing has stopped and your remaining days are frozen, safe for when you’re back. Resume any time from your account.',
    resumed: 'Welcome back — your membership is active again, a fresh billing cycle starts today, and your frozen days have carried over.',
    switched: 'Your plan change is set — it takes effect at your next renewal, with no mid-cycle charge.',
  }[what];
  const subject = { paused: 'Your membership is paused', resumed: 'Welcome back', switched: 'Your plan change is set' }[what];
  await sendEmail({
    to: OPS_EMAIL,
    subject: `Plan change — ${what} (${email})`,
    html: emailShell('Plan change', `<p><strong>${escapeHtml(email)}</strong> — ${escapeHtml(what)} their plan.</p>`, `A member ${what} their plan`),
  });
  await pushToAdmins({ title: 'Plan change', body: `${email} · ${what}`, url: '/admin/' });
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject,
    html: emailShell(what === 'resumed' ? 'Welcome back' : 'All set', `<p>Hi${fn ? ` ${escapeHtml(fn)}` : ''},</p><p>${escapeHtml(memberCopy)}</p>`, memberCopy),
  });
}

/**
 * Prices we permit switching to — never trust a client-supplied price blindly.
 * Mirrors PLAN_STRIPE_PRICE in lib/plans.ts (monthly + annual for the three core
 * plans, plus the annual-only Hybrid Office).
 */
const ALLOWED_PRICES = new Set([
  'price_0PgRo1w5GSGOu4zJdycNlCpy', // Visitor monthly
  'price_0Tn4ucw5GSGOu4zJ7UqWhlO8', // Visitor annual
  'price_0PgRphw5GSGOu4zJ0dnCFwjp', // Resident monthly
  'price_0Tn4Nmw5GSGOu4zJwV8L1Imz', // Resident annual
  'price_0PgS1pw5GSGOu4zJQpVlN6Gm', // Citizen monthly
  'price_0Tn4MXw5GSGOu4zJLe6oAQEu', // Citizen annual
  'price_0OtrBRw5GSGOu4zJC3vsROvC', // Hybrid Office (annual)
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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

/**
 * Find the member's live membership subscription.
 *
 * Deliberately NOT restricted to status='active': a member part-way through a trial
 * (`trialing`) or behind on a payment (`past_due`/`unpaid`) still holds a real
 * subscription and must be able to pause it. The old active-only query returned
 * nothing for them, which surfaced as a flat "Something went wrong". Prefer a
 * genuinely active/trialing sub, otherwise fall back to any other live one.
 */
const LIVE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];
async function findSubscription(email) {
  const customers = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=10`, 'GET');
  let fallback = null;
  for (const c of customers?.data || []) {
    const subs = await stripe(`/v1/subscriptions?customer=${c.id}&status=all&limit=10`, 'GET');
    for (const s of subs?.data || []) {
      if (s.status === 'active' || s.status === 'trialing') return s;
      if (LIVE_STATUSES.includes(s.status) && !fallback) fallback = s;
    }
  }
  return fallback;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!MS_SECRET || !STRIPE_SECRET) return json({ error: 'not-configured' }, 503);

  let token;
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
  let body = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }
  if (!token) token = body?.token;
  if (!token) return json({ error: 'missing-token' }, 401);

  const action = body?.action;
  if (!['switch', 'pause', 'resume'].includes(action)) return json({ error: 'unknown-action' }, 400);
  if (action === 'switch' && !ALLOWED_PRICES.has(body?.priceId)) return json({ error: 'bad-price' }, 400);

  try {
    const admin = memberstackAdmin.init(MS_SECRET);
    const verified = await admin.verifyToken({ token });
    if (!verified?.id) return json({ error: 'invalid-token' }, 401);
    const { data: member } = await admin.members.retrieve({ id: verified.id });
    const email = member?.auth?.email || member?.email;
    if (!email) return json({ error: 'no-email' }, 404);

    const sub = await findSubscription(email);
    if (!sub) return json({ error: 'no-subscription' }, 404);

    if (action === 'switch') {
      const item = sub.items?.data?.[0];
      if (!item) return json({ error: 'no-item' }, 409);
      // Apply the new plan at the member's NEXT renewal, with NO proration — flat
      // invoices, no mid-cycle maths. We drive this with a Stripe subscription
      // schedule: the current price runs to period end, then the new price takes over.
      let scheduleId = sub.schedule;
      if (!scheduleId) {
        const created = await stripe('/v1/subscription_schedules', 'POST', { from_subscription: sub.id });
        if (created?.error) return json({ error: 'stripe', detail: created.error.message }, 502);
        scheduleId = created.id;
      }
      const sched = await stripe(`/v1/subscription_schedules/${scheduleId}`, 'GET');
      const p0 = sched?.phases?.[0];
      if (!p0?.items?.[0]) return json({ error: 'no-phase' }, 502);
      const curPrice = typeof p0.items[0].price === 'string' ? p0.items[0].price : p0.items[0].price?.id;
      const updated = await stripe(`/v1/subscription_schedules/${scheduleId}`, 'POST', {
        end_behavior: 'release',
        proration_behavior: 'none',
        'phases[0][items][0][price]': curPrice,
        'phases[0][items][0][quantity]': String(p0.items[0].quantity || 1),
        'phases[0][start_date]': String(p0.start_date),
        'phases[0][end_date]': String(p0.end_date),
        'phases[1][items][0][price]': body.priceId,
        'phases[1][items][0][quantity]': '1',
        'phases[1][iterations]': '1',
      });
      if (updated?.error) return json({ error: 'stripe', detail: updated.error.message }, 502);
      await notifyPlanChange(member, email, 'switched');
      return json({ ok: true, effective: 'next-renewal' });
    }

    if (action === 'pause') {
      const updated = await stripe(`/v1/subscriptions/${sub.id}`, 'POST', { 'pause_collection[behavior]': 'void' });
      if (updated?.error) return json({ error: 'stripe', detail: updated.error.message }, 502);
      await notifyPlanChange(member, email, 'paused');
      return json({ ok: true, paused: true });
    }

    // resume — clear the pause AND restart the billing cycle from today, so they
    // don't wait until the old renewal date to come back. No proration; their frozen
    // rollover days carry over into the fresh cycle.
    const updated = await stripe(`/v1/subscriptions/${sub.id}`, 'POST', {
      pause_collection: '',
      billing_cycle_anchor: 'now',
      proration_behavior: 'none',
    });
    if (updated?.error) return json({ error: 'stripe', detail: updated.error.message }, 502);
    await notifyPlanChange(member, email, 'resumed');
    return json({ ok: true, paused: false });
  } catch (err) {
    return json({ error: 'failed', detail: String(err?.message || err) }, 500);
  }
}
