/**
 * The Quarter — native meeting-room booking + payment (public, paid).
 *
 * The marketing meeting rooms (The Knight's Tale, The Chapter House) and the phone
 * pods (The Bell Tower, The Scriptorium) can be booked and paid for by ANYONE — no
 * membership needed. The flow is company-led:
 *
 *   POST {action:'quote',  spaceId, date, pkg, people, lunch}      → { amountPence, lines, start, end }
 *   POST {action:'intent', spaceId, date, pkg, people, lunch,
 *         company, name, email}                                     → { clientSecret, amountPence, lines }
 *
 * Price is ALWAYS computed here from the space's own record (never trusted from the
 * client). The Airtable booking is created by the Stripe webhook on
 * payment_intent.succeeded (metadata.kind==='room-booking') so a booking only ever
 * exists once money is taken. Apple Pay + cards come from automatic_payment_methods.
 *
 * ASSUMPTIONS (flagged for Nick's review):
 *  - Members pay the same listed price (no free/included meeting-room time wired).
 *  - Packages: am 09:00–13:00, pm 13:30–17:30, full 09:00–17:30. Pods book a single
 *    hour at the £21.60 day-pass rate (no lunch, no quiet-day discount).
 *  - Quiet-day 20% off HIRE on Mon/Wed/Fri (meeting rooms only); lunch stays full.
 *
 * Env: STRIPE_SECRET_KEY (PaymentIntents: Write), Airtable (via _airtable).
 */
import { listRecords, listAllRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { BUSINESS, hhmmToMin, londonWallClockToISO, isoToLondonMin, londonNow } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL, fmtDateTime } from './_email.mjs';
import { pushToEmail } from './_push.mjs';
import { isRecurringBlockRule, recurringBlockOccurrences } from './_privatisation.mjs';
import { roomHoursCap, memberRoomDiscount, planSlugForMember } from './_entitlement.mjs';
import { ensureDayForDate } from './checkin.mjs';

/* Free meeting-room hours are per plan and live in _entitlement.mjs, which both this path
   and the dashboard's bookings.mjs now share. Pods are free and never counted. */

/** Free meeting-room hours belong to a PLAN. A member with no plan connection (pay-as-you-go
 *  account) earns no free hours — they pay (and earn the give-back) like a guest. Mirrors the
 *  dashboard's `(member.planConnections?.length ?? 0) > 0` signal exactly. */
const hasPlan = (m) => (m?.planConnections?.length ?? 0) > 0;

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

// --- Pricing (£, inc VAT). Names normalised so a straight/curly apostrophe or
//     case difference in Airtable never breaks the match. ---------------------
const norm = (s) => String(s ?? '').toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, ' ').trim();
const ROOM_PRICE = {
  "the knight's tale": { half: 144, full: 240 },
  'the chapter house': { half: 90, full: 150 },
};
const POD_RATE = 21.6;
const LUNCH_PER_HEAD = 12;
const QUIET_DAYS = [1, 3, 5]; // Mon, Wed, Fri (0=Sun)
const QUIET_DISCOUNT = 0.2;

const PACKAGES = {
  am: { label: 'Morning · 09:00–13:00', start: '09:00', end: '13:00', span: 'half' },
  pm: { label: 'Afternoon · 13:30–17:30', start: '13:30', end: '17:30', span: 'half' },
  full: { label: 'Full day · 09:00–17:30', start: '09:00', end: '17:30', span: 'full' },
};

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function stripe(path, method, form, idempotencyKey) {
  const headers = { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' };
  // A stable key means a retried one-tap charge returns the SAME PaymentIntent — never a second charge.
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  return res.json();
}

/** The member's Stripe customer (prefer one carrying a subscription) — for saved-card pay. */
async function findCustomerId(email) {
  if (!email) return null;
  const customers = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=10`, 'GET');
  const list = customers?.data || [];
  if (!list.length) return null;
  for (const c of list) {
    const subs = await stripe(`/v1/subscriptions?customer=${c.id}&status=all&limit=1`, 'GET');
    if (subs?.data?.length) return c.id;
  }
  return list[0].id;
}

/** The saved card to offer for one-tap: the customer's default, else their most recent card. */
async function defaultCard(customerId) {
  if (!customerId) return null;
  const cust = await stripe(`/v1/customers/${customerId}`, 'GET');
  const defPm = cust?.invoice_settings?.default_payment_method;
  const pms = await stripe(`/v1/payment_methods?customer=${customerId}&type=card&limit=10`, 'GET');
  const cards = pms?.data || [];
  if (!cards.length) return null;
  const chosen = cards.find((p) => p.id === defPm) || cards[0];
  return { id: chosen.id, brand: chosen.card?.brand || 'card', last4: chosen.card?.last4 || '' };
}

/** London weekday (0=Sun) for a YYYY-MM-DD date — stable regardless of server TZ. */
const weekdayOf = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

async function getSpace(spaceId) {
  const recs = await listRecords(T.spaces, { filterByFormula: `RECORD_ID()='${esc(spaceId)}'`, maxRecords: 1 });
  const r = recs[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.fields[F.spaces.name],
    type: r.fields[F.spaces.type] || '',
    bookable: !!r.fields[F.spaces.bookable],
  };
}

/**
 * Confirmed bookings occupying a space on a date. Concrete dated rows come straight from Airtable;
 * indefinite recurring-Block RULE rows (which live only on their start date) are excluded here and
 * re-added as expanded occurrences, so a recurring block keeps a room un-bookable on every future
 * weekday — a paid booking can't slip past it.
 */
async function bookingsForSpaceDate(spaceId, dateStr) {
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}', {Status}='Confirmed')`,
  });
  const dated = recs.filter((r) => {
    if (isRecurringBlockRule(r)) return false;
    const sp = r.fields[F.bookings.space];
    return Array.isArray(sp) && sp.includes(spaceId);
  });
  const blockRecs = await listAllRecords(T.bookings, {
    filterByFormula: `AND({Status}='Confirmed', OR({Kind}='Block', {Kind}='External'))`,
  });
  const occ = recurringBlockOccurrences(blockRecs, dateStr)
    .map((o) => o.record)
    .filter((r) => {
      const sp = r.fields[F.bookings.space];
      return Array.isArray(sp) && sp.includes(spaceId);
    });
  return [...dated, ...occ];
}

/** Standard meeting-room hourly rate = the full-day price ÷ 8. */
const roomHourlyRate = (price) => round2(price.full / 8);

/**
 * Resolve the time window + price for a request. Returns { error } or
 * { start, end, amountPence, lines, span, isPod }.
 *
 * `memberRate` (optional): when a plan member books meeting-room time beyond their included hours,
 * they pay PER HOUR at their plan's member rate instead of a full-day/half-day package — the room's
 * standard hourly rate less their tier discount (Visitor 25% / Resident 33% / Citizen 50%). No
 * quiet-day discount stacks on top (the member rate already beats it); lunch is unchanged.
 */
function priceRequest(space, { date, pkg, people, lunch, memberRate }) {
  const isPod = /pod/.test(norm(space.type));
  const heads = Math.max(1, Math.min(50, Number(people) || 1));
  const lines = [];

  let start;
  let end;
  let hire = 0;

  if (isPod) {
    // Pods: a single hour at the day-pass rate. pkg carries the start hour "HH:MM".
    start = /^\d{2}:\d{2}$/.test(pkg) ? pkg : '09:00';
    end = `${String(hhmmToMin(start) / 60 + 1).padStart(2, '0')}:00`;
    hire = POD_RATE;
    lines.push({ label: `${space.name} · ${start}–${end}`, amount: POD_RATE });
  } else {
    const p = PACKAGES[pkg];
    if (!p) return { error: 'bad-package' };
    const price = ROOM_PRICE[norm(space.name)];
    if (!price) return { error: 'no-price' };
    start = p.start;
    end = p.end;
    if (memberRate && memberRate.hours > 0) {
      // Member beyond their included hours: pay per hour at their tier rate, not a package —
      // but never more than the equivalent day rate, so a long booking can't cost more than a guest's.
      const rate = round2(roomHourlyRate(price) * (1 - memberRate.discount));
      const perHour = round2(memberRate.hours * rate);
      const packageEquiv = p.span === 'full' ? price.full : price.half;
      const pct = Math.round(memberRate.discount * 100);
      if (perHour <= packageEquiv) {
        hire = perHour;
        lines.push({ label: `${space.name} · ${memberRate.hours}h × £${rate.toFixed(2)}/hr · ${memberRate.tierLabel} rate (${pct}% off)`, amount: hire });
      } else {
        hire = packageEquiv;
        lines.push({ label: `${space.name} · ${p.label} · ${memberRate.tierLabel} rate (${pct}% off)`, amount: hire });
      }
    } else {
      hire = p.span === 'full' ? price.full : price.half;
      const quiet = QUIET_DAYS.includes(weekdayOf(date));
      lines.push({ label: `${space.name} · ${p.label}`, amount: hire });
      if (quiet) {
        const off = round2(hire * QUIET_DISCOUNT);
        hire = round2(hire - off);
        lines.push({ label: 'Quiet-day discount (20%)', amount: -off });
      }
    }
    if (lunch) {
      const lunchTotal = round2(heads * LUNCH_PER_HEAD);
      lines.push({ label: `Lunch · ${heads} × £${LUNCH_PER_HEAD}`, amount: lunchTotal });
    }
  }

  const total = lines.reduce((a, l) => a + l.amount, 0);
  return { start, end, span: isPod ? 'pod' : PACKAGES[pkg]?.span, isPod, amountPence: Math.round(round2(total) * 100), lines };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Slot must be a weekday, within hours, on the grid, and not a closed day. */
async function validate(date, start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'bad-date';
  const dow = weekdayOf(date);
  if (dow === 0 || dow === 6) return 'weekend'; // paid rooms are Mon–Fri only
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  if (!(s >= BUSINESS.openMin && e <= BUSINESS.closeMin && s < e)) return 'outside-hours';
  if (await isClosedDay(date)) return 'closed-day';
  return null;
}

async function isFree(spaceId, date, start, end) {
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  const existing = await bookingsForSpaceDate(spaceId, date);
  return !existing.some((r) => {
    const rs = isoToLondonMin(r.fields[F.bookings.start]);
    const re = isoToLondonMin(r.fields[F.bookings.end]);
    return s < re && e > rs;
  });
}

/** Hours the member has already booked in MEETING ROOMS (pods excluded) this calendar month. */
async function monthlyMeetingRoomHours(email, dateStr) {
  const ym = dateStr.slice(0, 7); // YYYY-MM
  const spaces = await listRecords(T.spaces, {});
  const meetingIds = new Set(spaces.filter((r) => !/pod/.test(norm(r.fields[F.spaces.type] || ''))).map((r) => r.id));
  const recs = await listRecords(T.bookings, {
    filterByFormula: `AND(LOWER({Member email})='${esc((email || '').toLowerCase())}', {Status}='Confirmed', DATETIME_FORMAT({Date}, 'YYYY-MM')='${esc(ym)}')`,
  });
  let hours = 0;
  for (const r of recs) {
    const sp = r.fields[F.bookings.space];
    if (!Array.isArray(sp) || !sp.length || !meetingIds.has(sp[0])) continue;
    // Only FREE member bookings consume the monthly allowance. A member's PAID booking
    // (kind 'Company') now carries their member email, so guard against it eating free hours.
    if (r.fields[F.bookings.kind] !== 'Member') continue;
    const s = isoToLondonMin(r.fields[F.bookings.start]);
    const e = isoToLondonMin(r.fields[F.bookings.end]);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) hours += (e - s) / 60;
  }
  return hours;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!STRIPE_SECRET || !airtableReady()) return json({ error: 'not-configured' }, 503);

  const body = await req.json().catch(() => ({}));
  const { action, spaceId, date, pkg, people, lunch } = body;

  // Member's free-hours status for the month (drives the free-vs-pay UI). No room needed.
  if (action === 'member-status') {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: 'auth' }, 401);
    const me = vm.member;
    const cap = roomHoursCap(me);
    // No plan → no free hours: report remaining:0 so the client's freeEligible is false and the
    // member is routed to the paid path (where they still earn the give-back).
    if (!hasPlan(me)) return json({ capHours: cap, usedHours: 0, remaining: 0 });
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);
    const used = await monthlyMeetingRoomHours(memberEmail(me), ref);
    return json({ capHours: cap, usedHours: round2(used), remaining: round2(Math.max(0, cap - used)) });
  }

  // Toggle whether the card entered for THIS payment gets saved (setup_future_usage), so the
  // "Save this card" checkbox can sit beside the card and still take effect before payment.
  if (action === 'set-save') {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: 'auth' }, 401);
    const pmiId = String(body.paymentIntentId || '').trim();
    if (!/^pi_[A-Za-z0-9_]+$/.test(pmiId)) return json({ error: 'bad-id' }, 400);
    const r = await stripe(`/v1/payment_intents/${pmiId}`, 'POST', { setup_future_usage: body.save ? 'off_session' : '' });
    return json({ ok: !r?.error });
  }

  if (!spaceId || !date) return json({ error: 'missing-params' }, 400);

  const space = await getSpace(spaceId);
  if (!space || !space.bookable) return json({ error: 'no-space' }, 404);

  // Tiered member pricing. A Visitor/Resident/Citizen booking meeting-room time beyond their
  // included hours (the client only routes them to the paid path once their free hours are used)
  // pays PER HOUR at their tier rate. Resolve the member once here and reuse for the intent
  // metadata below. Guests, no-plan accounts, other plans, and pods carry no memberRate and price
  // exactly as before. verifyMember is best-effort — a missing/invalid token just means "guest".
  const payer = action === 'quote' || action === 'intent' ? await verifyMember(tokenFromRequest(req, body)) : { ok: false };
  let memberRate = null;
  if (payer.ok && memberRoomDiscount(payer.member) > 0 && !/pod/.test(norm(space.type)) && ROOM_PRICE[norm(space.name)]) {
    const rs = String(body.start || '');
    const re = String(body.end || '');
    if (/^\d{2}:\d{2}$/.test(rs) && /^\d{2}:\d{2}$/.test(re) && hhmmToMin(re) > hhmmToMin(rs)) {
      const slug = planSlugForMember(payer.member);
      memberRate = {
        hours: round2((hhmmToMin(re) - hhmmToMin(rs)) / 60),
        discount: memberRoomDiscount(payer.member),
        tierLabel: slug ? slug[0].toUpperCase() + slug.slice(1) : 'Member',
      };
    }
  }

  const priced = priceRequest(space, { date, pkg, people, lunch, memberRate });
  if (priced.error) return json({ error: priced.error }, 400);

  // Meeting-room RECORD window: honour the caller's explicit start/end (the real
  // slot chosen in the picker) so the saved booking shows the true times. The
  // AMOUNT stays package-priced above (client can't move the £). Pods keep their
  // computed single-hour window.
  if (!priced.isPod) {
    const rs = String(body.start || '');
    const re = String(body.end || '');
    if (/^\d{2}:\d{2}$/.test(rs) && /^\d{2}:\d{2}$/.test(re) && hhmmToMin(re) > hhmmToMin(rs)) {
      priced.start = rs;
      priced.end = re;
    }
  }

  const invalid = await validate(date, priced.start, priced.end);
  if (invalid) return json({ error: invalid }, 400);

  if (!(await isFree(spaceId, date, priced.start, priced.end))) return json({ error: 'slot-taken' }, 409);

  if (action === 'quote') {
    // For a signed-in member, also surface their saved card so the client can offer one-tap pay —
    // unless they've turned Instant Book off (then we never touch their card).
    let savedCard = null;
    if (payer.ok && !payer.member?.metaData?.instantBookOff) {
      const custId = await findCustomerId(String(memberEmail(payer.member) || ''));
      savedCard = custId ? await defaultCard(custId) : null;
    }
    return json({ amountPence: priced.amountPence, lines: priced.lines, start: priced.start, end: priced.end, savedCard });
  }

  if (action === 'intent') {
    // A signed-in member (the dashboard's inline pay flow) needn't re-type their details: fall back
    // to their own email/name from the verified token. Guests still supply these on the public form.
    const email = String(body.email || '').trim() || (payer.ok ? String(memberEmail(payer.member) || '').trim() : '');
    const name = String(body.name || '').trim() || (payer.ok ? String(memberName(payer.member) || '').trim() : '');
    const company = String(body.company || '').trim() || (payer.ok ? 'Member booking' : '');
    const jobTitle = String(body.jobTitle || '').trim();
    const phone = String(body.phone || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad-email' }, 400);
    if (!company) return json({ error: 'missing-company' }, 400);
    if (priced.amountPence < 100) return json({ error: 'bad-amount' }, 400);

    // TEST COMP (secret, env-gated) — see day-pass.mjs. Skip Stripe and record + confirm this
    // room booking at £0 exactly as finaliseRoomBooking would (same T.bookings row, kind
    // 'Company', Confirmed) so it shows correctly in the admin Rooms view — with ' · TEST COMP'
    // in Notes so staff can find/delete it. NO rewards points are awarded on a comp (we return
    // before the member resolution below). INERT unless TEST_COMP_CODE is set AND body.test
    // matches it; the public can never trigger it, and the real PaymentIntent path is unchanged.
    const COMP = process.env.TEST_COMP_CODE;
    if (COMP && body.test === COMP) {
      const heads = Math.max(1, Number(people) || 1);
      const who = `${name}${jobTitle ? `, ${jobTitle}` : ''}`.trim();
      const notes = [
        'Comp booking',
        '£0.00 · TEST COMP',
        `${heads} ${heads === 1 ? 'person' : 'people'}`,
        lunch ? 'Lunch added' : 'No lunch',
        who ? `Contact: ${who}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      try {
        await createRecord(
          T.bookings,
          {
            [F.bookings.title]: `${priced.start}–${priced.end} · ${company || name || 'Booking'}`,
            [F.bookings.space]: [spaceId],
            [F.bookings.date]: date,
            [F.bookings.start]: londonWallClockToISO(date, priced.start),
            [F.bookings.end]: londonWallClockToISO(date, priced.end),
            [F.bookings.kind]: 'Company',
            [F.bookings.email]: email,
            [F.bookings.name]: name,
            [F.bookings.company]: company,
            [F.bookings.status]: 'Confirmed',
            [F.bookings.source]: 'Web',
            [F.bookings.notes]: notes,
          },
          { typecast: true },
        );
      } catch {
        /* record best-effort — never block the comp */
      }
      const when = fmtDateTime(date, priced.start, priced.end);
      await sendEmail({
        to: email,
        replyTo: OPS_EMAIL,
        subject: `Your booking (TEST) is confirmed — ${space.name || 'The Quarter'}`,
        html: emailShell(
          'Your booking (TEST) is confirmed',
          `<p>Thank you${name ? `, ${escapeHtml(name)}` : ''} — this is a £0 test booking.</p>
           <p style="margin:0 0 6px;"><strong>${escapeHtml(space.name || 'Room')}</strong></p>
           <p style="margin:0 0 6px;">${escapeHtml(when)}</p>
           <p style="margin:0 0 6px;">${heads} ${heads === 1 ? 'person' : 'people'}${lunch ? ' · lunch added' : ''}</p>
           <p style="margin:0 0 6px;">Total: <strong>£0.00</strong> · TEST COMP</p>`,
          'Your Quarter room booking (TEST) is confirmed',
        ),
      });
      await pushToEmail(email, { title: 'Booking confirmed', body: `${space.name || 'Room'} · ${when}`, url: '/dashboard/' });
      return json({ ok: true, comped: true });
    }

    // The payer resolved above (best-effort): attach their member id/email to the PI metadata so
    // the webhook awards the spend give-back and links the booking to them. NEVER hard-fails —
    // a guest (no/invalid token) simply carries no member metadata and pays exactly as before.
    const vm = payer;
    const memberMeta = vm.ok ? { 'metadata[memberId]': vm.member.id, 'metadata[memberEmail]': memberEmail(vm.member) || '' } : {};

    // Saved cards (members only): attach the Stripe customer so a card can be reused/saved.
    //  • savedPaymentMethod → charge that saved card NOW (member is present → on-session).
    //  • saveCard → save the newly-entered card to the customer for next time (with their consent).
    // Instant Book off → we neither reuse nor save their card (a normal card-entry payment).
    const instantOff = !!vm.member?.metaData?.instantBookOff;
    const customerId = vm.ok ? await findCustomerId(email) : null;
    const savedPm = vm.ok && !instantOff ? String(body.savedPaymentMethod || '').trim() : '';
    const saveCard = !instantOff && (body.saveCard === true || body.saveCard === 'true');

    const piParams = {
      amount: String(priced.amountPence),
      currency: 'gbp',
      'payment_method_types[0]': 'card',
      receipt_email: email,
      description: `${space.name} — ${date} (${company})`,
      'metadata[kind]': 'room-booking',
      'metadata[spaceId]': spaceId,
      'metadata[spaceName]': space.name || '',
      'metadata[date]': date,
      'metadata[start]': priced.start,
      'metadata[end]': priced.end,
      'metadata[people]': String(Math.max(1, Number(people) || 1)),
      'metadata[lunch]': lunch ? 'yes' : 'no',
      'metadata[company]': company,
      'metadata[name]': name,
      'metadata[jobTitle]': jobTitle,
      'metadata[phone]': phone,
      'metadata[email]': email,
      ...memberMeta,
      ...(customerId ? { customer: customerId } : {}),
    };
    if (savedPm && customerId) {
      // One-tap: confirm against the saved card right now. The member is present, so this is an
      // on-session charge (off_session defaults false) — if the bank wants SCA we get requires_action.
      piParams.payment_method = savedPm;
      piParams.confirm = 'true';
    } else if (customerId && saveCard) {
      // Keep the new card on file for faster booking next time.
      piParams.setup_future_usage = 'off_session';
    }

    // Idempotency for the one-tap charge only: same member + slot + amount within 24h → same PI.
    const idem = savedPm ? `room-${vm.ok ? vm.member.id : 'g'}-${spaceId}-${date}-${priced.start}-${priced.end}-${priced.amountPence}-${savedPm}` : undefined;
    const pi = await stripe('/v1/payment_intents', 'POST', piParams, idem);

    if (savedPm) {
      // Server-confirmed saved-card charge: report the outcome the client should act on.
      if (pi?.error) return json({ error: 'card-declined', detail: pi.error.message || '' }, 402);
      if (pi.status === 'succeeded' || pi.status === 'processing') return json({ ok: true, paid: true });
      if (pi.status === 'requires_action' && pi.client_secret) return json({ requiresAction: true, clientSecret: pi.client_secret });
      return json({ error: 'card-declined', detail: pi.last_payment_error?.message || '' }, 402);
    }
    if (pi?.error || !pi?.client_secret) return json({ error: 'stripe', detail: pi?.error?.message }, 502);
    return json({ clientSecret: pi.client_secret, amountPence: priced.amountPence, lines: priced.lines, start: priced.start, end: priced.end });
  }

  // Members book the two main meeting rooms free, up to their monthly hours cap
  // (metaData.meetingRoomHoursCap, default 4). Pods are free + never counted here.
  if (action === 'member-free') {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: 'auth' }, 401);
    const me = vm.member;
    // Free bookings (rooms and pods) are a membership benefit — a no-plan account can't take one.
    // The client routes them to the paid intent instead (where they still earn the give-back).
    if (!hasPlan(me)) return json({ error: 'no-plan' }, 400);
    const email = memberEmail(me);
    const hours = round2((hhmmToMin(priced.end) - hhmmToMin(priced.start)) / 60);
    // Pods are free + uncapped for members; meeting rooms enforce the monthly cap.
    let cap = null;
    let used = null;
    if (!priced.isPod) {
      cap = roomHoursCap(me);
      used = await monthlyMeetingRoomHours(email, date);
      if (used + hours > cap + 1e-6) {
        return json({ error: 'cap-exceeded', capHours: cap, usedHours: round2(used), remaining: round2(Math.max(0, cap - used)) });
      }
    }
    // A free member room/pod booking IS being in the office that day, so it books a co-working day
    // too (idempotent). A member with no days/passes is refused (needsDay) → the client sends them to
    // upgrade or buy a pass. Rooms are Mon–Fri, so the weekday day-spend always applies.
    const day = await ensureDayForDate(me, date, { source: 'Web', length: 'Full', block: true });
    if (day.blocked) return json({ error: day.reason || 'no-allowance', needsDay: true }, 402);
    const rec = await createRecord(
      T.bookings,
      {
        [F.bookings.title]: `${priced.start}–${priced.end} · ${memberName(me)}`,
        [F.bookings.space]: [spaceId],
        [F.bookings.date]: date,
        [F.bookings.start]: londonWallClockToISO(date, priced.start),
        [F.bookings.end]: londonWallClockToISO(date, priced.end),
        [F.bookings.kind]: 'Member',
        [F.bookings.email]: email,
        [F.bookings.name]: memberName(me),
        [F.bookings.status]: 'Confirmed',
        [F.bookings.source]: 'Web',
        [F.bookings.notes]: priced.isPod ? `Member pod booking · ${hours}h` : `Member free booking · ${hours}h (cap ${cap})`,
      },
      { typecast: true },
    );
    return json({ ok: true, id: rec?.id || null, remaining: cap != null ? round2(Math.max(0, cap - used - hours)) : null, capHours: cap });
  }

  return json({ error: 'unknown-action' }, 400);
}

// Exported for the webhook so it finalises bookings with the same field mapping.
export { londonWallClockToISO };
