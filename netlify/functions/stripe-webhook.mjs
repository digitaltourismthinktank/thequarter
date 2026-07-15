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
import memberstackAdmin from '@memberstack/admin';
import {
  renewMember,
  formatDate,
  setMemberPlan,
  targetPlanForPrice,
  PAUSED_PLAN_ID,
  PLAN_ALLOWANCE,
  daysUsedThisCycle,
  getMemberSync,
  stampSync,
} from './_quarter-sync.mjs';
import { pointsForGBP, appendLedger, WELCOME_BONUS, creditReferral, CARNET_AMOUNT_TO_PASSES } from './_rewards.mjs';
import { listRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonWallClockToISO } from './_time.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SIM_KEY = process.env.SIM_KEY;

// New-member join bonus (Quarter Rewards) — scaled by plan, awarded ONCE per member.
const JOIN_BONUS = { visitor: 250, resident: 500, citizen: 1000 };
const PRICE_TO_PLAN = {
  price_0PgRo1w5GSGOu4zJdycNlCpy: 'visitor',
  price_0Tn4ucw5GSGOu4zJ7UqWhlO8: 'visitor',
  price_0PgRphw5GSGOu4zJ0dnCFwjp: 'resident',
  price_0Tn4Nmw5GSGOu4zJwV8L1Imz: 'resident',
  price_0PgS1pw5GSGOu4zJQpVlN6Gm: 'citizen',
  price_0Tn4MXw5GSGOu4zJLe6oAQEu: 'citizen',
  // Hybrid Office (annual-only). No join bonus (deliberately absent from JOIN_BONUS), but it
  // IS a native member join — listing it here lets the first-invoice "member-not-ready" retry
  // cover a hybrid join that lost the account-creation race (it maps to no bonus, so welcome=0).
  price_0OtrBRw5GSGOu4zJC3vsROvC: 'hybrid-office',
};

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
 * Finalise a paid room booking: create the Airtable booking (once — idempotent on
 * the PaymentIntent id stored in Notes) and email the guest + ops. Best-effort
 * emails never block the booking. Metadata is set by room-booking.mjs.
 */
async function finaliseRoomBooking(pi) {
  if (!airtableReady()) return { skipped: 'no-airtable' };
  const m = pi.metadata || {};
  const piId = pi.id || '';
  if (!m.spaceId || !m.date || !m.start || !m.end) return { skipped: 'bad-metadata' };

  // Idempotency: a webhook retry must not double-book. The PaymentIntent id lives
  // in the booking's Notes; if a confirmed booking for this space/date already
  // carries it, we're done.
  const dayRecs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(m.date)}', {Status}='Confirmed')`,
  });
  const dup = dayRecs.find((r) => {
    const sp = r.fields[F.bookings.space];
    return Array.isArray(sp) && sp.includes(m.spaceId) && String(r.fields[F.bookings.notes] || '').includes(piId);
  });
  if (dup) return { skipped: 'duplicate', id: dup.id };

  const total = (pi.amount ?? 0) / 100;
  const people = Number(m.people) || 1;
  const lunch = m.lunch === 'yes';
  const notes = [`Paid booking · ${piId}`, `£${total.toFixed(2)} inc VAT`, `${people} ${people === 1 ? 'person' : 'people'}`, lunch ? 'Lunch added' : 'No lunch']
    .filter(Boolean)
    .join(' · ');

  const rec = await createRecord(
    T.bookings,
    {
      [F.bookings.title]: `${m.start}–${m.end} · ${m.company || m.name || 'Booking'}`,
      [F.bookings.space]: [m.spaceId],
      [F.bookings.date]: m.date,
      [F.bookings.start]: londonWallClockToISO(m.date, m.start),
      [F.bookings.end]: londonWallClockToISO(m.date, m.end),
      [F.bookings.kind]: 'Company',
      [F.bookings.email]: m.email || '',
      [F.bookings.name]: m.name || '',
      [F.bookings.company]: m.company || '',
      [F.bookings.status]: 'Confirmed',
      [F.bookings.source]: 'Web',
      [F.bookings.notes]: notes,
    },
    { typecast: true },
  );

  await sendRoomBookingEmails({ m, total, people, lunch });
  return { created: rec?.id || null };
}

async function sendRoomBookingEmails({ m, total, people, lunch }) {
  const when = `${m.date} · ${m.start}–${m.end}`;
  const rows = `
    <p style="margin:0 0 6px;"><strong>${escapeHtml(m.spaceName || 'Room')}</strong></p>
    <p style="margin:0 0 6px;">${escapeHtml(when)}</p>
    <p style="margin:0 0 6px;">${people} ${people === 1 ? 'person' : 'people'}${lunch ? ' · lunch added' : ''}</p>
    <p style="margin:0 0 6px;">Total paid: <strong>£${total.toFixed(2)}</strong> (inc VAT)</p>`;
  if (m.email) {
    await sendEmail({
      to: m.email,
      subject: `Your booking is confirmed — ${m.spaceName || 'The Quarter'}`,
      replyTo: OPS_EMAIL,
      html: emailShell(
        'Your booking is confirmed',
        `<p>Thank you${m.name ? `, ${escapeHtml(m.name)}` : ''} — your room is booked.</p>${rows}<p style="margin:12px 0 0;">We look forward to seeing you. Any changes, just reply to this email or give us a call.</p>`,
        'Your Quarter room booking is confirmed',
      ),
    });
  }
  await sendEmail({
    to: OPS_EMAIL,
    subject: `New room booking — ${m.spaceName || 'Room'} (${m.company || m.name || 'guest'})`,
    html: emailShell(
      'New room booking',
      `${rows}<p style="margin:12px 0 0;">Company: ${escapeHtml(m.company || '—')}<br/>Contact: ${escapeHtml(m.name || '—')} · ${escapeHtml(m.email || '—')}</p>`,
      'A new room booking was just paid',
    ),
  });
}

/**
 * Finalise a paid Day Pass (guest — no member record). Records a Check-in row for the
 * chosen day (idempotent on the PaymentIntent id) and emails the guest + ops.
 */
async function finaliseDayPass(pi) {
  if (!airtableReady()) return { skipped: 'no-airtable' };
  const m = pi.metadata || {};
  const piId = pi.id || '';
  const date = m.date || '';
  const email = m.email || pi.receipt_email || '';
  if (!date) return { skipped: 'bad-metadata' };
  const dayRecs = await listRecords(T.checkins, { filterByFormula: `DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(date)}'` });
  if (dayRecs.some((r) => String(r.fields[F.checkins.notes] || '').includes(piId))) return { skipped: 'duplicate' };
  const total = (pi.amount ?? 0) / 100;
  const rec = await createRecord(
    T.checkins,
    {
      [F.checkins.email]: email,
      [F.checkins.name]: m.name || '',
      [F.checkins.date]: date,
      [F.checkins.length]: 'Full',
      [F.checkins.status]: 'Paid',
      [F.checkins.source]: 'Web',
      [F.checkins.notes]: `Day Pass · ${piId} · £${total.toFixed(2)}`,
    },
    { typecast: true },
  );
  await sendDayPassEmails({ email, name: m.name || '', date, total });
  return { created: rec?.id || null };
}

async function sendDayPassEmails({ email, name, date, total }) {
  const body = `
    <p style="margin:0 0 6px;"><strong>Day Pass</strong> · ${escapeHtml(date)}</p>
    <p style="margin:0 0 6px;">Total paid: <strong>£${total.toFixed(2)}</strong> (inc VAT)</p>`;
  if (email) {
    await sendEmail({
      to: email,
      replyTo: OPS_EMAIL,
      subject: 'Your Day Pass is booked — The Quarter',
      html: emailShell(
        'Your Day Pass is booked',
        `<p>Thanks${name ? `, ${escapeHtml(name)}` : ''} — you’re in for ${escapeHtml(date)}.</p>${body}<p style="margin:12px 0 0;">Come up to the 1st &amp; 2nd floors, 27–28 Burgate — breakfast, coffee and a desk are waiting. Just let the team know you have a Day Pass.</p>`,
        'Your Quarter Day Pass is booked',
      ),
    });
  }
  await sendEmail({
    to: OPS_EMAIL,
    subject: `New Day Pass — ${name || email || 'guest'} (${date})`,
    html: emailShell('New Day Pass', `${body}<p style="margin:12px 0 0;">Guest: ${escapeHtml(name || '—')} · ${escapeHtml(email || '—')}</p>`, 'A Day Pass was just paid'),
  });
}

const normName = (s) => String(s ?? '').toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();
async function spaceIdByName(name) {
  const recs = await listRecords(T.spaces, {});
  const m = recs.find((r) => normName(r.fields[F.spaces.name]) === normName(name));
  return m?.id || null;
}

/**
 * Finalise a team-room privatisation: record it (once — idempotent on the Checkout
 * session id in Notes), link the room, and email the company + ops. The record is a
 * single 'Privatisation' marker; generating the recurring weekly room blocks (so the
 * room reads as unavailable on those weekdays) is an admin/scheduled follow-up.
 */
async function finalisePrivatisation(m, refId, toEmail) {
  if (!airtableReady()) return { skipped: 'no-airtable' };
  const existing = await listRecords(T.bookings, { filterByFormula: `AND({Status}='Confirmed', {Kind}='Privatisation')` });
  if (existing.some((r) => String(r.fields[F.bookings.notes] || '').includes(refId))) return { skipped: 'duplicate' };

  const spaceId = await spaceIdByName(m.roomName || '');
  const notes = [`Privatisation · ${refId}`, `${m.frequency || ''} (${m.days || 'full week'})`, `${m.members || '?'} members`, `from ${m.startDate || ''}`].join(' · ');
  const fields = {
    [F.bookings.title]: `Privatisation · ${m.company || m.roomName || ''}`,
    [F.bookings.kind]: 'Privatisation',
    [F.bookings.company]: m.company || '',
    [F.bookings.email]: m.email || toEmail || '',
    [F.bookings.name]: m.name || '',
    [F.bookings.status]: 'Confirmed',
    [F.bookings.source]: 'Web',
    [F.bookings.recurring]: true,
    [F.bookings.notes]: notes,
  };
  if (m.startDate) fields[F.bookings.date] = m.startDate;
  if (spaceId) fields[F.bookings.space] = [spaceId];
  const rec = await createRecord(T.bookings, fields, { typecast: true });
  await sendPrivatisationEmails(m, m.email || toEmail || '');
  return { created: rec?.id || null, space: spaceId };
}

async function sendPrivatisationEmails(m, toEmail) {
  const to = m.email || toEmail || '';
  const body = `
    <p style="margin:0 0 6px;"><strong>${escapeHtml(m.roomName || 'Team room')}</strong> · ${escapeHtml(m.frequency || '')}</p>
    <p style="margin:0 0 6px;">Days: ${escapeHtml(m.days || 'full week')}</p>
    <p style="margin:0 0 6px;">Starts: ${escapeHtml(m.startDate || '')}</p>
    <p style="margin:0 0 6px;">Members: ${escapeHtml(String(m.members || ''))}</p>
    <p style="margin:0 0 6px;">Invoiced quarterly.</p>`;
  if (to) {
    await sendEmail({
      to,
      replyTo: OPS_EMAIL,
      subject: `Your team room is reserved — ${m.roomName || 'The Quarter'}`,
      html: emailShell(
        'Your team room is reserved',
        `<p>Thank you${m.name ? `, ${escapeHtml(m.name)}` : ''} — ${escapeHtml(m.company || 'your company')} is set up.</p>${body}<p style="margin:12px 0 0;">We’ll be in touch to get your team’s accounts ready. Any questions, just reply.</p>`,
        'Your Quarter team room is reserved',
      ),
    });
  }
  await sendEmail({
    to: OPS_EMAIL,
    subject: `New privatisation — ${m.roomName || ''} (${m.company || ''})`,
    html: emailShell('New privatisation', `${body}<p style="margin:12px 0 0;">Company: ${escapeHtml(m.company || '')}<br/>Contact: ${escapeHtml(m.name || '')} · ${escapeHtml(to)}</p>`, 'A team room was just privatised'),
  });
}

const memberFirstName = (member) => String(member?.customFields?.['first-name'] || '').trim();

async function sendWelcomeEmail(email, member) {
  const fn = memberFirstName(member);
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject: 'Welcome to The Quarter',
    html: emailShell(
      'Welcome to The Quarter',
      `<p>Hi${fn ? ` ${escapeHtml(fn)}` : ''},</p><p>Welcome — we’re so glad you’re here. Your membership is live: pop in for breakfast, take any free desk, and say hello. Your Quarter Rewards start earning from your very first visit.</p>`,
      'Welcome to The Quarter',
    ),
  });
}

async function sendPaymentFailedEmail(email, member) {
  const fn = memberFirstName(member);
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject: 'A quick note about your payment',
    html: emailShell(
      'We couldn’t take your payment',
      `<p>Hi${fn ? ` ${escapeHtml(fn)}` : ''},</p><p>Your latest payment didn’t go through — usually just a card that’s expired or changed. Pop into your account and update your card, and you’re all set. Any trouble at all, simply reply to this email.</p>`,
      'Please update your payment card',
    ),
  });
}

/**
 * Read a privatisation subscription's metadata off an invoice, tolerant of BOTH the
 * pre-Basil shape (invoice.subscription_details) and the Basil+ shape
 * (invoice.parent.subscription_details), so a Stripe API-version change can't silently
 * stop privatisations finalising. Returns the metadata only when kind==='privatisation'.
 */
function invoicePrivatisationMeta(inv) {
  const md = inv?.subscription_details?.metadata || inv?.parent?.subscription_details?.metadata || null;
  return md && md.kind === 'privatisation' ? md : null;
}
/** The subscription id an invoice belongs to (both invoice shapes). */
const invoiceSubscriptionId = (inv) => inv?.subscription || inv?.parent?.subscription_details?.subscription || '';

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

  // Paid room booking (public — the payer may be a non-member). Finalise it before
  // the member-resolution path below so it never depends on a Memberstack record.
  if (type === 'payment_intent.succeeded' && obj?.metadata?.kind === 'room-booking') {
    return { ...base, roomBooking: await finaliseRoomBooking(obj) };
  }

  // Native Day Pass (guest — no member record). Record the day + email before the member path.
  if (type === 'payment_intent.succeeded' && obj?.metadata?.kind === 'day-pass') {
    return { ...base, dayPass: await finaliseDayPass(obj) };
  }

  // Team-room privatisation (public, company-led — no member record). Legacy Checkout
  // session path…
  if (type === 'checkout.session.completed' && obj?.metadata?.kind === 'privatisation') {
    return { ...base, privatisation: await finalisePrivatisation(obj.metadata || {}, obj.id || '', obj.customer_details?.email || obj.customer_email || '') };
  }
  // …and the embedded (in-site) path. A privatisation subscription's invoices must NEVER
  // fall through to the member path below: the buyer's Stripe customer may be shared with
  // their own membership, and a privatisation invoice (or its failure) would then corrupt
  // that member's plan/day balance. Finalise on the first paid invoice; swallow the rest.
  if (type === 'invoice.paid' || type === 'invoice.payment_succeeded' || type === 'invoice.payment_failed') {
    const pm = invoicePrivatisationMeta(obj);
    if (pm) {
      if (type === 'invoice.payment_failed') return { ...base, ignored: 'privatisation-invoice-failed' };
      return { ...base, privatisation: await finalisePrivatisation(pm, invoiceSubscriptionId(obj) || obj.id || '', obj.customer_email || '') };
    }
  }
  // Privatisation subscription lifecycle events (created/updated/deleted) — likewise never
  // touch a member (same shared-customer hazard); the invoice branch above does the work.
  if (
    (type === 'customer.subscription.created' || type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') &&
    obj?.metadata?.kind === 'privatisation'
  ) {
    return { ...base, ignored: 'privatisation-subscription' };
  }

  // Resolve the member email for the event types we handle.
  let email = null;
  if (type === 'invoice.paid' || type === 'invoice.payment_succeeded' || type === 'invoice.payment_failed') {
    email = obj.customer_email || (await emailFromCustomer(obj.customer));
  } else if (type === 'customer.subscription.created' || type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
    email = await emailFromCustomer(obj.customer);
  } else if (type === 'checkout.session.completed') {
    email = obj.customer_details?.email || obj.customer_email || (await emailFromCustomer(obj.customer));
  } else if (type === 'payment_intent.succeeded' && obj?.metadata?.kind === 'carnet') {
    email = obj.metadata?.email || null;
  } else {
    return { ...base, ignored: true };
  }
  if (!email) return { ...base, noEmail: true };

  // Stale-event guard.
  const { member, lastSyncAt, lastEventId, metaData } = await getMemberSync(MS_SECRET, email);
  if (!member) {
    // Native member-plan join pays first, then creates the Memberstack account. If the
    // first invoice lands before the account exists, retry (non-200) so Stripe redelivers
    // once it does. Scope to KNOWN member-plan prices only — never retry for privatisation
    // (a company, not a member) or any other non-member subscription.
    const invPrice = obj.lines?.data?.[0]?.price?.id;
    if (
      (type === 'invoice.paid' || type === 'invoice.payment_succeeded') &&
      obj.billing_reason === 'subscription_create' &&
      invPrice &&
      PRICE_TO_PLAN[invPrice]
    ) {
      throw new Error('member-not-ready');
    }
    // Buy-then-join carnet: passes can be bought before the account is created, so the PI may
    // land before the member exists. Retry (non-200) so Stripe redelivers once the account (same
    // email) is created — then the carnet block below credits the passes into their wallet.
    if (type === 'payment_intent.succeeded' && obj?.metadata?.kind === 'carnet') {
      throw new Error('member-not-ready-carnet');
    }
    return { ...base, email, noMember: true };
  }

  // Native carnet top-up (additive) — handled BEFORE the last-write-wins stale guard. That
  // guard is correct for STATE syncs (plan/days) but would wrongly DROP an out-of-order
  // additive credit (a carnet PI delivered after a later member event). Idempotency is by the
  // PaymentIntent id, kept in a small scalar metaData marker so a redelivery can't double-
  // credit. lastSyncAt/lastEventId are preserved untouched, so this out-of-order event never
  // rewinds the state-sync stamp.
  if (type === 'payment_intent.succeeded' && obj?.metadata?.kind === 'carnet') {
    const piId = obj.id || '';
    const passes = Number(obj.metadata?.passes) || 0;
    if (passes <= 0) return { ...base, email, carnet: 'no-passes' };
    const seen = String(metaData?.carnetRefs || '');
    if (piId && seen.includes(piId)) return { ...base, email, carnet: 'duplicate' };
    const c = metaData?.carnet || {};
    const remaining = (Number(c.remaining) || 0) + passes;
    const total = (Number(c.total) || 0) + passes;
    const expires = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const spend = pointsForGBP((obj.amount ?? 0) / 100);
    const cur = Math.max(0, Math.round(Number(metaData?.points) || 0));
    const life = Math.max(0, Math.round(Number(metaData?.lifetimePoints) || cur));
    const carnetRefs = ((seen ? seen + '|' : '') + piId).split('|').slice(-12).join('|');
    // Money-critical write first (idempotent via the carnetRefs marker); if it throws we let
    // Stripe retry — the marker wasn't written, so there is no double-credit.
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({
      id: member.id,
      data: { metaData: { ...(metaData || {}), carnet: { remaining, total, expires }, points: cur + spend, lifetimePoints: life + spend, carnetRefs } },
    });
    // Audit row is best-effort (it can never re-credit — the balance already moved above).
    if (spend > 0) {
      try {
        await appendLedger(email, spend, 'spend', piId);
      } catch {
        /* ignore */
      }
    }
    return { ...base, email, carnetNative: passes, spend };
  }

  if (eventId && eventId === lastEventId) return { ...base, email, skipped: 'duplicate' };
  if (created < lastSyncAt) return { ...base, email, skipped: 'stale', lastSyncAt };

  let applied = {};
  // metaData we'll stamp at the end; the invoice branch folds earned points into it so
  // we never do two competing metaData writes (which would clobber each other).
  let earnMeta = metaData;
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
    // Quarter Rewards: spend points on every real paid invoice (2% give-back), plus a
    // one-off welcome bonus on the first subscription invoice. Folded into earnMeta so
    // the stampSync below writes points + sync stamp in one go.
    const amount = (obj.amount_paid ?? obj.total ?? 0) / 100;
    const spend = pointsForGBP(amount);
    // New-member join bonus: scaled by plan, awarded ONCE per member (metaData flag guards it).
    const isFirstInvoice = obj.billing_reason === 'subscription_create';
    let welcome = 0;
    if (isFirstInvoice && !metaData?.joinBonusAwarded) {
      const joinPlan = PRICE_TO_PLAN[line?.price?.id] || '';
      welcome = JOIN_BONUS[joinPlan] || 0;
    }
    if (spend > 0) await appendLedger(email, spend, 'spend', obj.id || '');
    if (welcome > 0) await appendLedger(email, welcome, 'welcome', obj.id || '');
    // First paid plan → credit whoever referred this member (no-op if not referred) + welcome email.
    if (isFirstInvoice) await creditReferral(email);
    if (isFirstInvoice) await sendWelcomeEmail(email, member);
    // A successful payment always clears any prior payment-issue flag.
    const cur = Math.max(0, Math.round(Number(metaData?.points) || 0));
    const life = Math.max(0, Math.round(Number(metaData?.lifetimePoints) || cur));
    earnMeta = { ...(metaData || {}), paymentIssue: false, points: cur + spend + welcome, lifetimePoints: life + spend + welcome, ...(welcome > 0 ? { joinBonusAwarded: true } : {}) };
    applied = { billingReason: obj.billing_reason, resetDays: isRenewal, spend, welcome };
  } else if (type === 'invoice.payment_failed') {
    // Card declined / payment failed — flag the member so both they and admin see it,
    // and the app can ask them to update their card before changing plan.
    earnMeta = { ...(metaData || {}), paymentIssue: true };
    applied = { paymentFailed: true };
    await sendPaymentFailedEmail(email, member); // dunning nudge (best-effort)
  } else if (type === 'checkout.session.completed') {
    // Day-pass carnet purchase (one-off). Top up balance, reset the 12-month expiry,
    // and earn spend points. amount_total maps to a bundle via config (provisional).
    const amount = obj.amount_total ?? 0;
    const passes = CARNET_AMOUNT_TO_PASSES[amount] || 0;
    if (passes > 0) {
      const c = member.metaData?.carnet || {};
      const remaining = (Number(c.remaining) || 0) + passes;
      const total = (Number(c.total) || 0) + passes;
      const expires = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      const spend = pointsForGBP(amount / 100);
      if (spend > 0) await appendLedger(email, spend, 'spend', obj.id || '');
      const cur = Math.max(0, Math.round(Number(metaData?.points) || 0));
      const life = Math.max(0, Math.round(Number(metaData?.lifetimePoints) || cur));
      earnMeta = { ...(metaData || {}), carnet: { remaining, total, expires }, points: cur + spend, lifetimePoints: life + spend };
      applied = { carnet: passes, spend };
    } else {
      applied = { checkout: 'no-carnet-match', amount };
    }
  } else {
    // customer.subscription.created / updated
    const price = obj.items?.data?.[0]?.price;
    // Native Stripe pause (pause_collection) OR the legacy £0 "Pause" price both
    // map to the frozen Paused plan; clearing pause_collection resumes the real plan.
    const nativePaused = !!obj.pause_collection;
    const target = nativePaused ? PAUSED_PLAN_ID : targetPlanForPrice(price?.id, price?.unit_amount);
    if (target === PAUSED_PLAN_ID) {
      await setMemberPlan(MS_SECRET, email, PAUSED_PLAN_ID); // pause: freeze days
      applied = { target, paused: true };
    } else {
      // Usage-aware switch: new days = new plan's allowance − days already used this
      // cycle. `member` here is PRE-retag, so it still has the old plan + balance.
      const used = daysUsedThisCycle(member);
      let changed = false;
      if (target) {
        const r = await setMemberPlan(MS_SECRET, email, target);
        changed = (r?.added?.length || 0) > 0;
      }
      if (changed && target) {
        const newAllowance = PLAN_ALLOWANCE[target];
        const explicitDays =
          newAllowance === null ? 'Unlimited' : newAllowance === undefined ? undefined : String(Math.max(0, newAllowance - used));
        await renewMember(MS_SECRET, email, { renewalDate: formatDate(obj.current_period_end), explicitDays });
      } else {
        await renewMember(MS_SECRET, email, { renewalDate: formatDate(obj.current_period_end), resetDays: false });
      }
      applied = { target, changed, used };
    }
  }

  await stampSync(MS_SECRET, member.id, earnMeta, created, eventId);
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
