/**
 * The Quarter — unsubscribe from the friendly emails.
 *
 * Deliberately unauthenticated and deliberately one-way. Someone clicking this link is
 * often on a phone, not signed in, and possibly annoyed; asking them to log in first is
 * how you turn an unsubscribe into a complaint. The token is a plain encoding of the
 * address, which is enough: the only thing it can do is stop marketing email to that
 * address, and knowing an address is not a secret worth protecting with a signature.
 *
 * It never touches operational mail. Booking confirmations, weekend approvals and event
 * reminders for something you already said yes to still arrive — those are the things you
 * asked for, and suppressing them would be a worse failure than the one we are preventing.
 *
 * GET  ?t=token   → who it is for (so the page can say the address back)
 * POST {t}        → opt out
 * POST {t, resubscribe:true} → opt back in
 */
import memberstackAdmin from '@memberstack/admin';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

const decode = (t) => {
  try {
    return String(Buffer.from(String(t || ''), 'base64url').toString('utf8')).trim().toLowerCase();
  } catch {
    return '';
  }
};

async function findByEmail(admin, email) {
  let after;
  for (let i = 0; i < 40; i += 1) {
    const res = await admin.members.list({ limit: 100, after });
    const hit = (res?.data || []).find((m) => String(m?.auth?.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (!res?.hasNextPage || !(res?.data || []).length) break;
    after = res?.endCursor;
  }
  return null;
}

export default async function handler(req) {
  if (!MS_SECRET) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const email = decode(body.t || url.searchParams.get('t'));
  if (!email || !email.includes('@')) return json({ error: 'bad-token' }, 400);

  if (req.method === 'GET') return json({ ok: true, email });

  const admin = memberstackAdmin.init(MS_SECRET);
  const m = await findByEmail(admin, email);
  // No member record — a day-pass buyer usually has no account — and there is nowhere to
  // store the objection yet. Saying "done" here would be a lie to the one person we most
  // owe the truth: they asked to be left alone and we would carry on. Say what is actually
  // true and give them a route that works, until a suppression list exists for addresses
  // with no member record.
  if (!m) return json({ ok: false, email, error: 'no-member-record' }, 200);

  const optOut = body.resubscribe !== true;
  await admin.members.update({ id: m.id, data: { metaData: { ...(m.metaData || {}), emailOptOut: optOut } } });
  return json({ ok: true, email, optOut });
}
