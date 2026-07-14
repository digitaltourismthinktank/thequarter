/**
 * The Quarter — web push (VAPID). A graceful no-op until VAPID keys are set:
 *   VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY  (Netlify env; `npx web-push generate-vapid-keys`)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY          (same public key, for the client)
 *   VAPID_SUBJECT                         (optional; defaults to mailto:info@thequarter.work)
 *
 * Subscriptions live on the member's Memberstack metaData.pushSubscriptions.
 * web-push is imported lazily so a missing dep/keys never breaks module load.
 */
import { getMemberSync } from './_quarter-sync.mjs';

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:info@thequarter.work';

let wp = null;
let configured = false;
async function webpush() {
  if (wp) return wp;
  try {
    const mod = await import('web-push');
    wp = mod.default || mod;
    if (PUB && PRIV) {
      wp.setVapidDetails(SUBJECT, PUB, PRIV);
      configured = true;
    }
  } catch {
    wp = null;
  }
  return wp;
}

export function pushConfigured() {
  return !!(PUB && PRIV);
}

/** Send a payload to a list of subscriptions. Returns { sent, expired } or { skipped }. */
export async function sendPush(subscriptions, payload) {
  if (!pushConfigured() || !Array.isArray(subscriptions) || !subscriptions.length) return { skipped: true };
  const w = await webpush();
  if (!w || !configured) return { skipped: true };
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(subscriptions.map((s) => w.sendNotification(s, body)));
  const expired = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason?.statusCode === 404 || r.reason?.statusCode === 410)) expired.push(subscriptions[i]?.endpoint);
  });
  return { sent: results.filter((r) => r.status === 'fulfilled').length, expired };
}

export async function pushToMember(member, payload) {
  const subs = member?.metaData?.pushSubscriptions;
  return sendPush(Array.isArray(subs) ? subs : [], payload);
}

/** Look the member up by email (via the sync helper) and push to their devices. */
export async function pushToEmail(email, payload) {
  if (!pushConfigured()) return { skipped: true };
  const MS = process.env.MEMBERSTACK_SECRET_KEY;
  if (!MS || !email) return { skipped: true };
  try {
    const { member } = await getMemberSync(MS, email);
    return member ? pushToMember(member, payload) : { skipped: true };
  } catch {
    return { skipped: true };
  }
}
