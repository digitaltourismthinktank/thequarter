/**
 * The Quarter — invite a friend to an event.
 *
 * Friends of members are how a place like this grows, so the whole design is about removing
 * friction from the friend's side rather than ours. They get an email, they tap one link,
 * they are in — no account, no password, no app. The RSVP page reads a token from the query
 * string, which also means no dynamic route and nothing for the static export to trip over.
 *
 * POST {action:'invite'}  (member token) → email a friend about an event
 * GET  ?token=…                           → what the friend's page needs to render
 * POST {action:'accept', token, name}     → the friend is coming; tell the member who asked
 *
 * The invite token is SIGNED. An earlier version wasn't, on the reasoning that the worst a
 * forged token could do was add a name to a guest list. That reasoning was wrong: `accept`
 * also emails the inviter, and the inviter's address came out of the token — so anyone
 * could mint a token naming any victim and make our DMARC-passing domain deliver mail to
 * them, with attacker-chosen text in the subject, at any rate they liked. Signing closes
 * it; the subject no longer interpolates guest input either.
 */
import { verifyMember, memberEmail, memberName, tokenFromRequest } from './_member.mjs';
import { listRecords, listAllRecords, createRecord, updateRecord, T, F, airtableReady, esc } from './_airtable.mjs';
import { sendEmail, emailShell, escapeHtml, fmtDateLong, OPS_EMAIL, SITE_URL } from './_email.mjs';
import { createHmac, timingSafeEqual } from 'node:crypto';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const lower = (s) => String(s || '').trim().toLowerCase();

const RSVP = { event: 'Event', email: 'Member email', name: 'Name', status: 'Status' };

/* HMAC-signed. Falls back to the Memberstack secret so there is no new env var to forget —
   any long-lived server secret works, it only needs to be stable and not public. */
const SIGNING_SECRET = process.env.INVITE_SECRET || process.env.MEMBERSTACK_SECRET_KEY || '';

const sign = (payload) => createHmac('sha256', SIGNING_SECRET).update(payload).digest('base64url').slice(0, 32);

const encode = (o) => {
  const payload = Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

const decode = (t) => {
  try {
    const [payload, mac] = String(t || '').split('.');
    if (!payload || !mac || !SIGNING_SECRET) return null;
    const expected = sign(payload);
    // Constant-time, and length-checked first because timingSafeEqual throws on a mismatch.
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

async function eventById(id) {
  const [r] = await listRecords(T.events, { filterByFormula: `RECORD_ID()='${esc(id)}'`, maxRecords: 1 });
  if (!r) return null;
  return {
    id: r.id,
    title: r.fields[F.events.title] || 'An evening at The Quarter',
    start: r.fields[F.events.start] || null,
    end: r.fields[F.events.end] || null,
    location: r.fields[F.events.location] || 'The Kentish Pantry',
    description: r.fields[F.events.description] || '',
    published: !!r.fields[F.events.published],
  };
}

const when = (ev) => (ev?.start ? fmtDateLong(ev.start) : '');

export default async function handler(req) {
  if (!airtableReady()) return json({ error: 'not-configured' }, 503);
  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  /* ------------------------------------------------- the friend's page (public) ---- */
  if (req.method === 'GET') {
    const data = decode(url.searchParams.get('token'));
    if (!data?.e) return json({ error: 'bad-token' }, 400);
    const ev = await eventById(data.e);
    if (!ev || !ev.published) return json({ error: 'not-found' }, 404);
    return json({ ok: true, event: ev, invitedBy: data.n || 'a member of The Quarter' });
  }

  /* ------------------------------------------------------- a member invites ------- */
  if (body.action === 'invite') {
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: vm.reason }, 401);

    const friendEmail = lower(body.email);
    if (!friendEmail.includes('@')) return json({ error: 'bad-email' }, 400);
    const ev = await eventById(body.eventId);
    if (!ev || !ev.published) return json({ error: 'no-event' }, 404);

    const inviter = memberName(vm.member) || 'A member';
    const inviterEmail = memberEmail(vm.member);
    // Self-invites are almost always a typo, and the "your friend is coming" email landing
    // in your own inbox reads as a bug.
    if (friendEmail === lower(inviterEmail)) return json({ error: 'thats-you' }, 400);

    const token = encode({ e: ev.id, n: inviter, m: inviterEmail });
    const link = `${SITE_URL}/invite?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: friendEmail,
      subject: `${inviter} has invited you to The Quarter`,
      replyTo: OPS_EMAIL,
      html: emailShell(
        `${inviter} has invited you`,
        `<p style="margin:0 0 14px;">Hello,</p>
         <p style="margin:0 0 14px;"><strong>${escapeHtml(inviter)}</strong> has invited you to join them at an evening at The Quarter, our co-working space on Burgate in Canterbury.</p>
         <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#faf5ea;border-radius:12px;"><tr><td style="padding:16px 18px;">
           <div style="font-size:17px;font-weight:700;color:#2b2620;margin:0 0 4px;">${escapeHtml(ev.title)}</div>
           <div style="font-size:14px;color:#6b6355;">${escapeHtml(when(ev))}${ev.location ? ` · ${escapeHtml(ev.location)}` : ''}</div>
         </td></tr></table>
         ${ev.description ? `<p style="margin:0 0 14px;">${escapeHtml(ev.description)}</p>` : ''}
         <p style="margin:0 0 14px;">You would be our guest — food and drinks are on us. It is a relaxed evening, and a good way to meet people working nearby.</p>
         <p style="margin:22px 0 8px;"><a href="${link}" style="display:inline-block;background:#1e1a15;color:#faf7f0;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;font-size:15px;">Let us know you are coming</a></p>
         <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#8a8172;">Guest places are offered as a courtesy and are limited by space, so we may occasionally have to say no — we would always let you know in good time.</p>`,
        `${inviter} has invited you to ${ev.title}`,
      ),
    });

    return json({ ok: true, invited: friendEmail });
  }

  /* ---------------------------------------------- the friend says yes (public) ---- */
  if (body.action === 'accept') {
    const data = decode(body.token);
    if (!data?.e) return json({ error: 'bad-token' }, 400);
    const ev = await eventById(data.e);
    if (!ev || !ev.published) return json({ error: 'not-found' }, 404);

    const guestEmail = lower(body.email);
    const guestName = String(body.name || '').trim().slice(0, 80);
    if (!guestEmail.includes('@') || !guestName) return json({ error: 'missing-details' }, 400);

    // Same table as a member RSVP so the guest simply appears on the list. The inviter is
    // recorded in the Name so admin sees who vouched for whom without a schema change.
    const rows = await listAllRecords(T.rsvps, { byName: true });
    const existing = rows.find(
      (r) => Array.isArray(r.fields[RSVP.event]) && r.fields[RSVP.event].includes(ev.id) && lower(r.fields[RSVP.email]) === guestEmail,
    );
    const label = `${guestName} (guest of ${data.n || 'a member'})`;
    if (existing) {
      await updateRecord(T.rsvps, existing.id, { [RSVP.status]: 'Going', [RSVP.name]: label }, { typecast: true });
    } else {
      await createRecord(T.rsvps, { [RSVP.event]: [ev.id], [RSVP.email]: guestEmail, [RSVP.name]: label, [RSVP.status]: 'Going' }, { typecast: true });
    }

    // Telling the member their friend accepted is the part that makes anyone do this twice.
    if (data.m) {
      await sendEmail({
        to: data.m,
        // Guest-supplied text stays out of the subject — it is the part a recipient sees
        // before deciding anything, and it is not ours to let a stranger write.
        subject: `Your guest is coming to ${ev.title}`,
        replyTo: OPS_EMAIL,
        html: emailShell(
          'Your guest is coming',
          `<p style="margin:0 0 14px;">Good news — <strong>${escapeHtml(guestName)}</strong> has accepted your invitation to <strong>${escapeHtml(ev.title)}</strong>.</p>
           <p style="margin:0 0 14px;">${escapeHtml(when(ev))}${ev.location ? ` · ${escapeHtml(ev.location)}` : ''}</p>
           <p style="margin:0 0 14px;">We will look after them. Thank you for bringing someone along — it is how most people find us.</p>`,
          `${guestName} accepted your invitation`,
        ),
      });
    }

    // And ops, so the kitchen caters for the right number.
    await sendEmail({
      to: OPS_EMAIL,
      subject: `[The Quarter] Guest RSVP — ${guestName} for ${ev.title}`,
      html: emailShell('A guest is coming', `<p><strong>${escapeHtml(label)}</strong> — ${escapeHtml(guestEmail)}</p><p>${escapeHtml(ev.title)} · ${escapeHtml(when(ev))}</p>`),
    });

    return json({ ok: true, event: ev });
  }

  return json({ error: 'unknown-action' }, 400);
}
