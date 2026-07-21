/**
 * The Quarter — Check-in API + day-usage ledger.
 *
 * GET  ?action=today           (member token) → today's status + day balance + planned days
 * POST {action:'checkin', length:'Full'|'Half'}        → check in for TODAY (deducts a day)
 * POST {action:'reserve', date, length}                → reserve a future weekday ("Tomorrow"); no deduct
 * POST {action:'cancel', id}                           → cancel an own Planned reservation
 *
 * Check-ins (Airtable) are the usage ledger. The member's day balance lives in
 * Memberstack `days-remaining`; check-in decrements it, the Stripe webhook resets it
 * on renewal. Citizen (unlimited) records the visit but never decrements.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, addDays, isoToLondonDate } from './_time.mjs';
import { allowanceForMember } from './_quarter-sync.mjs';
import { awardPoints, checkinBonusesThisMonth, earnBoostForMember, CHECKIN_BONUS, CHECKIN_QUIET_BONUS, CHECKIN_BONUS_CAP } from './_rewards.mjs';
import { isQuietDay } from './_busyness.mjs';
import { isClosedDay } from './_holidays.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL, fmtDateLong } from './_email.mjs';
import { pushToEmail, pushToAdmins } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

/** Weekend (Sat/Sun) for a YYYY-MM-DD — weekend access is by request, not a given. */
const isWeekend = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
};
/** A half day's period ('am'|'pm') is stored in the Check-in's Notes field as 'AM'/'PM'. */
const periodFromNotes = (n) => {
  const s = String(n || '').trim().toUpperCase();
  return s === 'AM' ? 'am' : s === 'PM' ? 'pm' : null;
};
async function sendWeekendRequestEmails({ email, name, date }) {
  const when = fmtDateLong(date);
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject: 'Your weekend access request',
    html: emailShell(
      'Weekend access — request received',
      `<p>Hi ${escapeHtml(name)},</p><p>Thanks — we’ve logged your request to come in on <strong>${escapeHtml(when)}</strong>. Weekends aren’t always staffed, so this one isn’t automatic — we’ll confirm by email as soon as we can.</p>`,
      'We’ve received your weekend access request',
    ),
  });
  await pushToEmail(email, { title: 'Request received', body: "We'll confirm your weekend access soon.", url: '/dashboard/' });
  await sendEmail({
    to: OPS_EMAIL,
    subject: `Weekend access requested — ${when} (${name})`,
    html: emailShell('Weekend access requested', `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) has requested weekend access for <strong>${escapeHtml(when)}</strong>.</p><p>Approve or decline in Admin → Today.</p>`, 'A member requested weekend access'),
  });
  await pushToAdmins({ title: 'New weekend request', body: `${name} · ${when}`, url: '/admin/' });
}

function parseDays(raw) {
  if (raw == null || String(raw).toLowerCase() === 'unlimited') return null;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

async function setDays(memberId, value) {
  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: memberId, data: { customFields: { 'days-remaining': value } } });
}

/** A member's check-in records for a given date (any status). */
async function checkinsFor(email, dateStr) {
  return listRecords(T.checkins, {
    filterByFormula: `AND(LOWER({Member email})='${esc(email)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(dateStr)}')`,
  });
}

export default async function handler(req) {
  try {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

  if (req.method === 'GET') {
    const action = new URL(req.url).searchParams.get('action');
    const vm = await verifyMember(tokenFromRequest(req, null));
    if (!vm.ok) return json({ error: vm.reason }, 401);

    // Booking PIN for kiosk identification — generate + store on first request.
    if (action === 'pin') {
      const m = vm.member;
      let pin = m.metaData?.bookingPin;
      if (!pin) {
        pin = String(Math.floor(100000 + Math.random() * 900000));
        const admin = memberstackAdmin.init(MS_SECRET);
        await admin.members.update({ id: m.id, data: { metaData: { ...(m.metaData || {}), bookingPin: pin } } });
      }
      return json({ pin });
    }

    if (action !== 'today') return json({ error: 'unknown-action' }, 400);
    const email = (memberEmail(vm.member) || '').toLowerCase();
    const today = londonNow().dateStr;
    const recs = await checkinsFor(email, today);
    const active = recs.find((r) => r.fields[F.checkins.status] === 'Checked-in');
    const planned = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Planned', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    // A paid Day Pass (written by the Stripe webhook, keyed on the buyer's email) is a
    // reserved day too — once they create an account with the same email it should show
    // as already-booked, not vanish. Surface Status 'Paid' rows alongside Planned ones.
    const paidPasses = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Paid', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    const requested = await listRecords(T.checkins, {
      filterByFormula: `AND(LOWER({Member email})='${esc(email)}', {Status}='Requested', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')>='${today}')`,
      sort: [{ field: 'Date' }],
    });
    // Merge planned + paid into one upcoming list, de-duped by date (Planned wins if a
    // date has both); skip today when they've already checked in so it isn't listed twice.
    const upcoming = [];
    const seenDates = new Set();
    for (const r of [...planned, ...paidPasses]) {
      const d = isoToLondonDate(r.fields[F.checkins.date]);
      if (seenDates.has(d)) continue;
      if (d === today && active) continue;
      seenDates.add(d);
      const len = r.fields[F.checkins.length];
      const kind = r.fields[F.checkins.status] === 'Paid' ? 'pass' : 'reserved';
      // Period only for a member's own half-day reservation (a paid pass's Notes hold pass metadata).
      upcoming.push({ id: r.id, date: d, length: len, kind, period: len === 'Half' && kind !== 'pass' ? periodFromNotes(r.fields[F.checkins.notes]) : null });
    }
    upcoming.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return json({
      date: today,
      checkedIn: !!active,
      length: active ? active.fields[F.checkins.length] : null,
      period: active && active.fields[F.checkins.length] === 'Half' ? periodFromNotes(active.fields[F.checkins.notes]) : null,
      balance: vm.member.customFields?.['days-remaining'] ?? null,
      planned: upcoming,
      requested: requested.map((r) => ({
        id: r.id,
        date: isoToLondonDate(r.fields[F.checkins.date]),
        length: r.fields[F.checkins.length],
        period: r.fields[F.checkins.length] === 'Half' ? periodFromNotes(r.fields[F.checkins.notes]) : null,
      })),
    });
  }

  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const email = (memberEmail(me) || '').toLowerCase();
  const name = memberName(me);
  const length = body.length === 'Half' ? 'Half' : 'Full';
  const cost = length === 'Half' ? 0.5 : 1;
  // Half days carry a morning/afternoon so staff know when to expect the member. Stored in
  // the Notes field as 'AM'/'PM' (no Airtable schema change); empty for full days.
  const periodNote = length === 'Half' ? (String(body.period).toLowerCase() === 'pm' ? 'PM' : 'AM') : '';
  const unlimited = allowanceForMember(me) === null;
  // A plan is what entitles you to be here. allowanceForMember returns null for unlimited
  // (Citizen) or a number for a metered plan; undefined means NO plan at all. That last
  // case was the hole: with no plan and no days-remaining field, the allowance block below
  // never fired (there were no days to run out of), so a no-plan account could check in and
  // reserve days for free, indefinitely — which is exactly how someone with neither a
  // membership nor a day pass ended up in the who's-in list.
  const hasPlan = allowanceForMember(me) !== undefined;
  const carnetState = me.metaData?.carnet || {};
  const carnetPasses = Math.max(0, Number(carnetState.remaining) || 0);
  const carnetLiveOn = (d) => carnetPasses > 0 && !(carnetState.expires && carnetState.expires < d);

  // Check in for TODAY (deducts unless unlimited). Idempotent per day.
  if (body.action === 'checkin') {
    const today = londonNow().dateStr;
    // Bank-holiday / seasonal closures block a check-in. Weekends are by REQUEST —
    // you can only check in if staff approved your request (a Planned record exists).
    if (await isClosedDay(today)) return json({ error: 'closed-day' }, 400);
    const recs = await checkinsFor(email, today);
    if (isWeekend(today)) {
      const approved = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
      const pending = recs.find((r) => r.fields[F.checkins.status] === 'Requested');
      if (!approved) return json({ error: pending ? 'weekend-pending' : 'weekend-request' }, 400);
    }
    const already = recs.find((r) => r.fields[F.checkins.status] === 'Checked-in');
    if (already) {
      return json({ ok: true, alreadyCheckedIn: true, balance: me.customFields?.['days-remaining'] ?? null });
    }

    // Entitlement. You may check in only if you have a plan, a paid day pass for today, or a
    // carnet pass to spend. A staff-approved weekend Planned record also counts (handled
    // above). Without one of these, checking in was silently free.
    const paidPassToday = recs.some((r) => r.fields[F.checkins.status] === 'Paid');
    const approvedToday = recs.some((r) => r.fields[F.checkins.status] === 'Planned');
    if (!hasPlan && !carnetLiveOn(today) && !paidPassToday && !approvedToday) {
      return json({ error: 'needs-plan-or-pass' }, 400);
    }

    // Spend the plan's days first, and only fall back to a carnet pass once they're gone.
    //
    // That ordering is what a member expects — the days are already paid for this month and
    // expire with it, whereas carnet passes are theirs to keep — but until now there was no
    // fallback at all: check-in only ever looked at `days-remaining`, so someone holding ten
    // paid passes was still told "no days left" and had to go and find a different button on
    // a different card to use one. Being refused entry while holding passes you bought is
    // the worst version of this, so the fallback is automatic and the response says which
    // was spent.
    const current = parseDays(me.customFields?.['days-remaining']);
    const outOfDays = !unlimited && current !== null && current < cost;

    const carnet = me.metaData?.carnet || {};
    const passesLeft = Math.max(0, Number(carnet.remaining) || 0);
    const carnetLive = passesLeft > 0 && !(carnet.expires && carnet.expires < today);
    // Spend a carnet pass when a plan member has run out of days, AND when a member with no
    // plan and no paid pass is here on a carnet — otherwise the gate above would let them in
    // but nothing would be spent, which is the free check-in all over again.
    const useCarnet = (outOfDays || (!hasPlan && !paidPassToday)) && carnetLive;

    if (outOfDays && !useCarnet) {
      return json({ error: 'no-allowance' }, 400);
    }

    // Deduct from the Memberstack balance (unless unlimited, or paying with a pass).
    let newBalance = me.customFields?.['days-remaining'] ?? null;
    if (!unlimited && !useCarnet) {
      const next = current === null ? null : Math.max(0, current - cost);
      if (next !== null) {
        newBalance = String(next);
        await setDays(me.id, newBalance);
      }
    }
    // A carnet pass covers a whole day, so a half day still costs one — there is no half
    // pass. Worth surfacing to the member rather than quietly charging a full one.
    let carnetRemaining = null;
    if (useCarnet) {
      carnetRemaining = passesLeft - 1;
      const msAdmin = memberstackAdmin.init(MS_SECRET);
      await msAdmin.members.update({
        id: me.id,
        data: { metaData: { ...(me.metaData || {}), carnet: { ...carnet, remaining: carnetRemaining } } },
      });
    }

    // Flip an existing Planned record to Checked-in, else create one.
    const planned = recs.find((r) => r.fields[F.checkins.status] === 'Planned');
    if (planned) {
      await updateRecord(T.checkins, planned.id, {
        [F.checkins.status]: 'Checked-in',
        [F.checkins.length]: length,
        [F.checkins.notes]: periodNote,
        [F.checkins.dayCost]: unlimited || useCarnet ? 0 : cost,
        [F.checkins.source]: 'Self',
        ...(useCarnet ? { [F.checkins.notes]: `${periodNote ? periodNote + ' · ' : ''}Carnet pass` } : {}),
      });
    } else {
      await createRecord(T.checkins, {
        [F.checkins.ref]: `${name} · ${today}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: today,
        [F.checkins.length]: length,
        [F.checkins.notes]: periodNote,
        [F.checkins.dayCost]: unlimited ? 0 : cost,
        [F.checkins.status]: 'Checked-in',
        [F.checkins.source]: 'Self',
      });
    }
    // Award Quarter Rewards points for being in (quiet days earn double; monthly cap).
    let pointsAwarded = 0;
    try {
      const used = await checkinBonusesThisMonth(email, today.slice(0, 7));
      if (used < CHECKIN_BONUS_CAP) {
        const quiet = isQuietDay(today);
        // The member's earned level gives a gentle boost to the base bonus.
        const mult = earnBoostForMember(me);
        pointsAwarded = Math.round((quiet ? CHECKIN_QUIET_BONUS : CHECKIN_BONUS) * mult);
        await awardPoints(me, pointsAwarded, quiet ? 'checkin-quiet' : 'checkin', today);
      }
    } catch {
      /* points are best-effort; never block a check-in */
    }
    return json({ ok: true, balance: newBalance, pointsAwarded, usedCarnet: useCarnet, carnetRemaining });
  }

  // Reserve a future day. No deduction until they actually check in. Weekends are
  // allowed for members (the app asks them to confirm); bank holidays are not.
  if (body.action === 'reserve') {
    const date = body.date || addDays(londonNow().dateStr, 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad-date' }, 400);
    if (await isClosedDay(date)) return json({ error: 'closed-day' }, 400);
    const existing = await checkinsFor(email, date);
    if (existing.some((r) => r.fields[F.checkins.status] !== 'Cancelled')) {
      return json({ ok: true, alreadyReserved: true });
    }
    // Same gate as a live check-in: reserving is only meaningful if you could actually
    // attend. A no-plan account with no carnet would otherwise plan days it can never use
    // and show up in the admin who's-in list as expected. A future paid day pass already
    // exists as a row, so it short-circuits above and never reaches here.
    if (!hasPlan && !carnetLiveOn(date)) {
      return json({ error: 'needs-plan-or-pass' }, 400);
    }
    // Weekends are by request (not a given): create a 'Requested' record + notify staff.
    // Weekdays reserve straight to 'Planned'.
    const weekend = isWeekend(date);
    const rec = await createRecord(
      T.checkins,
      {
        [F.checkins.ref]: `${name} · ${date}`,
        [F.checkins.email]: email,
        [F.checkins.name]: name,
        [F.checkins.date]: date,
        [F.checkins.length]: length,
        [F.checkins.notes]: periodNote,
        [F.checkins.dayCost]: 0,
        [F.checkins.status]: weekend ? 'Requested' : 'Planned',
        [F.checkins.source]: 'Self',
      },
      { typecast: true },
    );
    if (weekend) await sendWeekendRequestEmails({ email, name, date });
    return json({ ok: true, id: rec.id, requested: weekend });
  }

  // Cancel an own Planned reservation.
  if (body.action === 'cancel') {
    if (!body.id) return json({ error: 'missing-id' }, 400);
    const recs = await listRecords(T.checkins, { filterByFormula: `RECORD_ID()='${esc(body.id)}'`, maxRecords: 1 });
    const r = recs[0];
    if (!r) return json({ error: 'not-found' }, 404);
    if (String(r.fields[F.checkins.email] || '').toLowerCase() !== email) return json({ error: 'forbidden' }, 403);
    const st = r.fields[F.checkins.status];
    if (st !== 'Planned' && st !== 'Requested') return json({ error: 'only-planned-cancellable' }, 400);
    await updateRecord(T.checkins, body.id, { [F.checkins.status]: 'Cancelled' });
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: 'server' }, 500);
  }
}
