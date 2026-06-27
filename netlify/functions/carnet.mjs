/**
 * The Quarter — day-pass carnet (CODE_BRIEF §5).
 *
 * GET  (member token) → { carnet:{remaining,total,expires} }
 * POST {action:'use'}  → spend one pass on today's visit (check in, decrement remaining)
 *
 * carnet lives on Memberstack metaData; purchases top it up via the Stripe webhook.
 * A pass-use ties to a real check-in and earns the same check-in points as any visit.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { londonNow, isWeekday } from './_time.mjs';
import { isClosedDay } from './_holidays.mjs';
import { appendLedger, memberPoints, checkinBonusesThisMonth, CHECKIN_BONUS, CHECKIN_QUIET_BONUS, CHECKIN_BONUS_CAP } from './_rewards.mjs';
import { isQuietDay } from './_busyness.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

function carnetOf(m) {
  const c = m?.metaData?.carnet || {};
  return { remaining: Math.max(0, Number(c.remaining) || 0), total: Math.max(0, Number(c.total) || 0), expires: c.expires || null };
}

export default async function handler(req) {
  if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : null;
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);
  const me = vm.member;
  const email = memberEmail(me);

  if (req.method === 'GET') return json({ carnet: carnetOf(me) });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  if (body.action === 'use') {
    const c = carnetOf(me);
    const today = londonNow().dateStr;
    if (c.remaining <= 0) return json({ error: 'no-passes' }, 400);
    if (c.expires && c.expires < today) return json({ error: 'expired' }, 400);
    if (!isWeekday(today)) return json({ error: 'closed-weekend' }, 400);
    if (await isClosedDay(today)) return json({ error: 'closed-day' }, 400);

    const todays = await listRecords(T.checkins, {
      filterByFormula: `AND({Member email}='${esc(email)}', DATETIME_FORMAT({Date}, 'YYYY-MM-DD')='${esc(today)}', {Status}='Checked-in')`,
      maxRecords: 1,
    });
    if (todays[0]) return json({ error: 'already-in' }, 400);

    // Check-in points (monthly cap), folded with the carnet decrement into one write.
    let pts = 0;
    const used = await checkinBonusesThisMonth(email, today.slice(0, 7));
    if (used < CHECKIN_BONUS_CAP) {
      const quiet = isQuietDay(today);
      pts = quiet ? CHECKIN_QUIET_BONUS : CHECKIN_BONUS;
      await appendLedger(email, pts, quiet ? 'checkin-quiet' : 'checkin', today);
    }
    const newRemaining = c.remaining - 1;
    const admin = memberstackAdmin.init(MS_SECRET);
    await admin.members.update({
      id: me.id,
      data: { metaData: { ...(me.metaData || {}), carnet: { ...c, remaining: newRemaining }, points: memberPoints(me) + pts } },
    });
    await createRecord(T.checkins, {
      [F.checkins.ref]: `${memberName(me)} · ${today}`,
      [F.checkins.email]: email,
      [F.checkins.name]: memberName(me),
      [F.checkins.date]: today,
      [F.checkins.length]: 'Full',
      [F.checkins.dayCost]: 0,
      [F.checkins.status]: 'Checked-in',
      [F.checkins.source]: 'Self',
      [F.checkins.notes]: 'Carnet pass',
    });
    return json({ ok: true, carnet: { ...c, remaining: newRemaining }, pointsAwarded: pts });
  }

  return json({ error: 'unknown-action' }, 400);
}
