/**
 * The Quarter — daily renewal cron for MANUALLY-MANAGED memberships.
 *
 * Stripe members renew via their subscription (stripe-webhook.mjs). Members the
 * admin bills manually (bank transfer / cash / comp) have NO Stripe subscription,
 * so nothing resets their monthly day balance. This scheduled function fills that
 * gap: once a day it finds every member flagged metaData.manualBilling === true
 * whose customFields['renewal-date'] is due (≤ today, Europe/London) and renews
 * them — resetting days to their (override-aware) allowance with rollover and
 * rolling the renewal date forward one month.
 *
 * Netlify scheduled function (Functions v2): the default export is the handler and
 * `export const config = { schedule }` registers the cron. Runs daily.
 *
 * Safety:
 *  - It NEVER touches Stripe-managed members — they lack the manualBilling flag.
 *  - Idempotent: it only acts when a member is due, and it advances the renewal
 *    date into the future, so a same-day re-run (or a second daily fire) is a no-op.
 *  - Each member is wrapped in try/catch, so one failure can't stop the batch.
 *
 * Env: MEMBERSTACK_SECRET_KEY.
 */
import memberstackAdmin from '@memberstack/admin';
import { renewMember, formatDate } from './_quarter-sync.mjs';
import { londonNow } from './_time.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;

const planIdOf = (c) => (typeof c === 'string' ? c : c?.planId);

/** Parse a 'DD/MM/YYYY' renewal date → { y, m, d }, or null if malformed. */
function parseRenewal(s) {
  const mtch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!mtch) return null;
  const d = +mtch[1];
  const m = +mtch[2];
  const y = +mtch[3];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** A comparable YYYYMMDD integer for a {y,m,d}. */
const numOf = (y, m, d) => y * 10000 + m * 100 + d;

export default async function handler() {
  if (!MS_SECRET) return new Response(JSON.stringify({ error: 'not-configured' }), { status: 503 });

  const admin = memberstackAdmin.init(MS_SECRET);
  const today = londonNow().dateStr; // 'YYYY-MM-DD'
  const [ty, tm, td] = today.split('-').map(Number);
  const todayNum = numOf(ty, tm, td);

  let scanned = 0;
  let renewed = 0;
  let failed = 0;

  let after;
  for (let i = 0; i < 50; i += 1) {
    let res;
    try {
      res = await admin.members.list({ limit: 100, after });
    } catch (e) {
      console.error('[renew-cron] member list failed', e);
      break;
    }
    const data = res?.data || [];
    for (const m of data) {
      scanned += 1;
      try {
        if (m.metaData?.manualBilling !== true) continue; // Stripe-managed members never touched
        const renewal = parseRenewal(m.customFields?.['renewal-date']);
        if (!renewal) continue; // no/garbled renewal date → nothing to do
        if (numOf(renewal.y, renewal.m, renewal.d) > todayNum) continue; // not due yet

        const email = m.auth?.email || m.email || null;
        if (!email) continue;

        // Advance the renewal date one month at a time from its own anniversary until it is
        // strictly in the future — so it can't re-fire today and the day-of-month is preserved.
        let ny = renewal.y;
        let nm = renewal.m;
        let guard = 0;
        do {
          nm += 1;
          if (nm > 12) {
            nm = 1;
            ny += 1;
          }
          guard += 1;
        } while (numOf(ny, nm, renewal.d) <= todayNum && guard < 240);
        // Normalise via a Date (clamps e.g. 31st into a 30-day month) and format DD/MM/YYYY.
        const nextRenewal = formatDate(Math.floor(Date.UTC(ny, nm - 1, renewal.d, 12) / 1000));

        const r = await renewMember(MS_SECRET, email, { renewalDate: nextRenewal, resetDays: true });
        if (r?.ok) renewed += 1;
        else failed += 1;
      } catch (e) {
        failed += 1;
        console.error('[renew-cron] member failed', m?.id, e);
      }
    }
    if (!res?.hasNextPage || data.length === 0) break;
    after = res?.endCursor;
  }

  const summary = { scanned, renewed, failed, date: today };
  console.log('[renew-cron]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { status: 200, headers: { 'content-type': 'application/json' } });
}

// Netlify: run once a day. The handler is idempotent (only acts on due members and
// rolls the date forward), so the exact fire time doesn't matter.
export const config = { schedule: '@daily' };
