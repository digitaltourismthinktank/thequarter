/**
 * The Quarter — members' physical post / mail handling (member + admin).
 *
 * Mail arrives at the lodge; staff log it against a member; the member is notified and chooses
 * what happens — scan & email (free, with explicit permission to open), forward by post (£7.50,
 * 1st class, to the address on their profile), or collect. Staff then settle it.
 *
 * Same safe shape as checkin.mjs / bookings.mjs: this function holds the Airtable + Stripe secrets
 * and verifies the caller's Memberstack token. A member only ever sees / acts on their OWN post;
 * logging + settling is gated by the admin domain check. The browser never touches Airtable.
 *
 * The Post table is addressed BY NAME (it's user-created, so we don't hold its field IDs) — reads
 * come back keyed by field name, writes use { typecast: true }. Create it in the "The Quarter —
 * Ops" base with the fields named in PF below.
 */

import memberstackAdmin from '@memberstack/admin';
import { verifyMember, memberEmail, memberName, isAdmin, tokenFromRequest } from './_member.mjs';
import { listRecords, createRecord, updateRecord, esc, airtableReady, BASE } from './_airtable.mjs';
import { londonNow } from './_time.mjs';
import { pushToEmail, pushToAdmins } from './_push.mjs';
import { sendEmail, emailShell, escapeHtml, notifyAdmins } from './_email.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_KEY; // for the attachment content-upload API
const FORWARD_FEE_PENCE = 750; // £7.50 to forward by 1st class post
// Attachment field IDs on the Post table (for direct dashboard uploads via Airtable's content API).
const POST_FIELD_ID = { scan: 'fldCO27cMvPh3wppP', photo: 'fld5tY0i3z2Za7YVh' };

// The mail table in the Ops base. Addressed by its stable table ID (its display name is free to
// change); `byName: true` on reads just means "return fields keyed by NAME" (we read PF.* names).
const POST = 'tblpYalqRYkaGnLXp';
// Field NAMES in the Post table (create these columns exactly).
const PF = {
  item: 'Item', // primary — a human label, e.g. "Letter · Riva Savant"
  email: 'Member email',
  name: 'Member name',
  company: 'Company',
  type: 'Type', // single select: Letter / Large letter / Parcel
  tags: 'Tags', // multiple select: Looks official / Signed-for / Recorded/tracked / Time-sensitive
  sender: 'Sender',
  arrived: 'Arrived', // date
  status: 'Status', // single select: Waiting / To scan / Scanned / To forward / Posted / To collect / Collected
  handling: 'Handling', // single select: Scan / Forward / Collect
  photo: 'Photo', // attachment (envelope cover)
  scan: 'Scan', // attachment (PDF)
  fwdAddr: 'Forward address', // long text (snapshotted)
  fwdPaid: 'Forward paid', // checkbox
  photoReq: 'Photo requested', // checkbox
  postedOn: 'Posted on', // date
  collectedOn: 'Collected on', // date
  notes: 'Notes', // long text
  loggedBy: 'Logged by', // text (staff email)
  notified: 'Notified', // checkbox
};

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

// ---- Stripe (raw fetch, form-encoded — mirrors room-booking.mjs; no SDK in this repo) ----
async function stripe(path, method, form, idem) {
  const headers = { authorization: `Bearer ${STRIPE_SECRET}`, 'content-type': 'application/x-www-form-urlencoded' };
  if (idem) headers['Idempotency-Key'] = idem;
  const res = await fetch(`https://api.stripe.com${path}`, { method, headers, body: form ? new URLSearchParams(form).toString() : undefined });
  return res.json();
}
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

// ---- shaping ----
const attUrl = (v) => (Array.isArray(v) && v[0]?.url ? v[0].url : null);
/** The member's own view of an item. */
function shapeMine(r) {
  const f = r.fields || {};
  return {
    id: r.id,
    type: f[PF.type] || 'Letter',
    tags: Array.isArray(f[PF.tags]) ? f[PF.tags] : [],
    sender: f[PF.sender] || '',
    arrived: f[PF.arrived] || null,
    status: f[PF.status] || 'Waiting',
    handling: f[PF.handling] || null,
    photoUrl: attUrl(f[PF.photo]),
    scanUrl: attUrl(f[PF.scan]),
    photoRequested: !!f[PF.photoReq],
    postedOn: f[PF.postedOn] || null,
    collectedOn: f[PF.collectedOn] || null,
  };
}
/** The staff view — adds who it's for + forwarding detail. */
function shapeAdmin(r) {
  const f = r.fields || {};
  return {
    ...shapeMine(r),
    memberName: f[PF.name] || '',
    memberEmail: f[PF.email] || '',
    company: f[PF.company] || '',
    forwardAddress: f[PF.fwdAddr] || '',
    forwardPaid: !!f[PF.fwdPaid],
    notes: f[PF.notes] || '',
  };
}

const appendNote = (row, text) => [String(row.fields[PF.notes] || ''), text].filter(Boolean).join(' · ');

async function notifyStaffChoice(me, row, phrase) {
  const who = memberName(me);
  const type = row.fields[PF.type] || 'Item';
  try {
    await pushToAdmins({ title: 'Post — a member chose', body: `${who} ${phrase}`, url: '/admin/#post' });
  } catch {
    /* best-effort */
  }
  try {
    await notifyAdmins('Post — a member chose', `${who} ${phrase}`, {
      link: '/admin/#post',
      rows: [['Member', who], ['Item', type], ['Choice', phrase]],
    });
  } catch {
    /* best-effort */
  }
}

/** One record by id, or null. */
async function getRow(id) {
  const recs = await listRecords(POST, { byName: true, filterByFormula: `RECORD_ID()='${esc(id)}'`, maxRecords: 1 });
  return recs[0] || null;
}

export default async function handler(req) {
  try {
    if (!airtableReady() || !MS_SECRET) return json({ error: 'not-configured' }, 503);

    // ---------- GET ----------
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const vm = await verifyMember(tokenFromRequest(req, null));
      if (!vm.ok) return json({ error: vm.reason }, 401);
      const email = (memberEmail(vm.member) || '').toLowerCase();

      if (action === 'mine') {
        const recs = await listRecords(POST, {
          byName: true,
          filterByFormula: `LOWER({Member email})='${esc(email)}'`,
          sort: [{ field: PF.arrived, direction: 'desc' }],
        });
        // Forwarding address lives on the member's profile (metaData), edited via member-profile.mjs.
        return json({ items: recs.map(shapeMine), forwardAddress: vm.member.metaData?.forwardAddress || '' });
      }
      if (action === 'queue') {
        if (!isAdmin(vm.member)) return json({ error: 'forbidden' }, 403);
        const recs = await listRecords(POST, {
          byName: true,
          filterByFormula: `NOT({Status}='Collected')`,
          sort: [{ field: PF.arrived, direction: 'desc' }],
        });
        return json({ items: recs.map(shapeAdmin) });
      }
      return json({ error: 'unknown-action' }, 400);
    }

    // ---------- POST ----------
    const body = await req.json().catch(() => ({}));
    const vm = await verifyMember(tokenFromRequest(req, body));
    if (!vm.ok) return json({ error: vm.reason }, 401);
    const me = vm.member;
    const email = (memberEmail(me) || '').toLowerCase();

    // ---- Member: choose what happens to an item ----
    if (body.action === 'choose') {
      if (!body.id) return json({ error: 'missing-id' }, 400);
      const row = await getRow(body.id);
      if (!row) return json({ error: 'not-found' }, 404);
      if (String(row.fields[PF.email] || '').toLowerCase() !== email && !isAdmin(me)) return json({ error: 'forbidden' }, 403);

      if (body.handling === 'collect') {
        await updateRecord(POST, row.id, { [PF.handling]: 'Collect', [PF.status]: 'To collect' }, { typecast: true });
        await notifyStaffChoice(me, row, 'will collect it');
        return json({ ok: true, status: 'To collect' });
      }

      if (body.handling === 'scan') {
        // Scanning means opening the envelope — require explicit permission, and keep the original.
        if (!body.permission) return json({ error: 'need-permission' }, 400);
        await updateRecord(
          POST,
          row.id,
          { [PF.handling]: 'Scan', [PF.status]: 'To scan', [PF.notes]: appendNote(row, 'Opening & scanning authorised by member') },
          { typecast: true },
        );
        await notifyStaffChoice(me, row, 'authorised opening & scanning');
        return json({ ok: true, status: 'To scan' });
      }

      if (body.handling === 'forward') {
        const addr = String(me.metaData?.forwardAddress || '').trim();
        if (!addr) return json({ error: 'no-forward-address' }, 400);
        if (!STRIPE_SECRET) return json({ error: 'not-configured' }, 503);
        // £7.50 on-session charge to the member's saved card (they're in the app tapping Forward).
        const customerId = await findCustomerId(email);
        const card = customerId ? await defaultCard(customerId) : null;
        if (!customerId || !card) return json({ error: 'no-card' }, 402);
        const pi = await stripe(
          '/v1/payment_intents',
          'POST',
          {
            amount: String(FORWARD_FEE_PENCE),
            currency: 'gbp',
            customer: customerId,
            payment_method: card.id,
            confirm: 'true',
            'payment_method_types[0]': 'card',
            description: `Post forwarding — ${memberName(me)}`,
            receipt_email: email,
            'metadata[kind]': 'post-forward',
            'metadata[memberEmail]': email,
            'metadata[postId]': row.id,
          },
          `postfwd-${row.id}`,
        );
        if (pi?.error) return json({ error: 'card-declined', detail: pi.error.message || '' }, 402);
        if (pi.status === 'requires_action' && pi.client_secret) return json({ requiresAction: true, clientSecret: pi.client_secret });
        if (pi.status !== 'succeeded' && pi.status !== 'processing') {
          return json({ error: 'card-declined', detail: pi.last_payment_error?.message || '' }, 402);
        }
        await updateRecord(
          POST,
          row.id,
          { [PF.handling]: 'Forward', [PF.status]: 'To forward', [PF.fwdAddr]: addr, [PF.fwdPaid]: true },
          { typecast: true },
        );
        await notifyStaffChoice(me, row, `paid £7.50 to forward → ${addr.split('\n')[0]}`);
        return json({ ok: true, status: 'To forward', paid: true });
      }

      return json({ error: 'bad-choice' }, 400);
    }

    // ---- Member: ask for a photo of the envelope (a light look-see, no opening) ----
    if (body.action === 'requestPhoto') {
      if (!body.id) return json({ error: 'missing-id' }, 400);
      const row = await getRow(body.id);
      if (!row) return json({ error: 'not-found' }, 404);
      if (String(row.fields[PF.email] || '').toLowerCase() !== email && !isAdmin(me)) return json({ error: 'forbidden' }, 403);
      await updateRecord(POST, row.id, { [PF.photoReq]: true }, { typecast: true });
      await notifyStaffChoice(me, row, 'asked for a photo of the envelope');
      return json({ ok: true });
    }

    // ---- Admin: log an incoming item, then notify the member ----
    if (body.action === 'log') {
      if (!isAdmin(me)) return json({ error: 'forbidden' }, 403);
      if (!body.memberId) return json({ error: 'missing-member' }, 400);
      const admin = memberstackAdmin.init(MS_SECRET);
      const r = await admin.members.retrieve({ id: body.memberId });
      const target = r?.data;
      if (!target) return json({ error: 'not-found' }, 404);
      const tEmail = (memberEmail(target) || '').toLowerCase();
      const tName = memberName(target);
      const company = target.metaData?.company || '';
      const type = ['Letter', 'Large letter', 'Parcel'].includes(body.type) ? body.type : 'Letter';
      const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string') : [];
      const sender = String(body.sender || '').trim();
      const today = londonNow().dateStr;

      await createRecord(
        POST,
        {
          [PF.item]: `${type} · ${tName}`,
          [PF.email]: tEmail,
          [PF.name]: tName,
          ...(company ? { [PF.company]: company } : {}),
          [PF.type]: type,
          ...(tags.length ? { [PF.tags]: tags } : {}),
          ...(sender ? { [PF.sender]: sender } : {}),
          [PF.arrived]: today,
          [PF.status]: 'Waiting',
          [PF.loggedBy]: (memberEmail(me) || '').toLowerCase(),
          [PF.notified]: true,
        },
        { typecast: true },
      );

      // Tell the member — push + email, both best-effort.
      try {
        await pushToEmail(tEmail, { title: "You've got post", body: 'Something arrived for you at The Quarter.', url: '/dashboard/' });
      } catch {
        /* best-effort */
      }
      try {
        await sendEmail({
          to: tEmail,
          subject: "You've got post at The Quarter",
          html: emailShell(
            "You've got post",
            `<p>Hi ${escapeHtml(tName.split(' ')[0] || 'there')},</p>
             <p>${escapeHtml(type)}${sender ? ` from ${escapeHtml(sender)}` : ''} arrived for you at The Quarter today.</p>
             <p>Open your dashboard to choose what happens next — <strong>scan &amp; email</strong> it to you (free), <strong>forward by post</strong> (£7.50, 1st class), or <strong>hold it for collection</strong>.</p>`,
            "You've got post at The Quarter",
          ),
        });
      } catch {
        /* best-effort */
      }
      return json({ ok: true });
    }

    // ---- Admin: settle an item (posted / collected / scanned) ----
    if (body.action === 'settle') {
      if (!isAdmin(me)) return json({ error: 'forbidden' }, 403);
      if (!body.id) return json({ error: 'missing-id' }, 400);
      const row = await getRow(body.id);
      if (!row) return json({ error: 'not-found' }, 404);
      const today = londonNow().dateStr;
      const to = body.to;
      const fields = {};
      if (to === 'posted') {
        fields[PF.status] = 'Posted';
        fields[PF.postedOn] = today;
        if (body.note) fields[PF.notes] = appendNote(row, String(body.note));
      } else if (to === 'collected') {
        fields[PF.status] = 'Collected';
        fields[PF.collectedOn] = today;
      } else if (to === 'scanned') {
        fields[PF.status] = 'Scanned';
      } else {
        return json({ error: 'bad-settle' }, 400);
      }
      await updateRecord(POST, row.id, fields, { typecast: true });
      // Let the member know it moved along.
      const label = to === 'posted' ? 'is on its way to you' : to === 'collected' ? 'is marked collected' : 'has been scanned — read it in the app';
      try {
        await pushToEmail(String(row.fields[PF.email] || ''), { title: 'Your post', body: `Your ${row.fields[PF.type] || 'item'} ${label}.`, url: '/dashboard/' });
      } catch {
        /* best-effort */
      }
      return json({ ok: true, status: fields[PF.status] });
    }

    // ---- Admin: upload a scan (PDF) or envelope photo straight from the dashboard ----
    if (body.action === 'uploadFile') {
      if (!isAdmin(me)) return json({ error: 'forbidden' }, 403);
      const fieldId = POST_FIELD_ID[body.kind];
      if (!body.id || !fieldId || !body.data) return json({ error: 'bad-upload' }, 400);
      // Airtable's content-upload API wants base64 (no data: prefix); it caps attachments ~5MB.
      if (String(body.data).length > 7_000_000) return json({ error: 'too-large' }, 413);
      const res = await fetch(`https://content.airtable.com/v0/${BASE}/${body.id}/${fieldId}/uploadAttachment`, {
        method: 'POST',
        headers: { authorization: `Bearer ${AIRTABLE_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          contentType: String(body.contentType || 'application/octet-stream'),
          filename: String(body.filename || (body.kind === 'photo' ? 'envelope' : 'scan')),
          file: String(body.data),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return json({ error: 'upload-failed', detail: detail.slice(0, 300) }, 502);
      }
      // A scan means it's ready to read — flip to Scanned and let the member know.
      if (body.kind === 'scan') {
        const row = await getRow(body.id);
        await updateRecord(POST, body.id, { [PF.status]: 'Scanned' }, { typecast: true });
        try {
          if (row) await pushToEmail(String(row.fields[PF.email] || ''), { title: 'Your post', body: 'Your item has been scanned — read it in the app.', url: '/dashboard/' });
        } catch {
          /* best-effort */
        }
      }
      return json({ ok: true });
    }

    return json({ error: 'unknown-action' }, 400);
  } catch (e) {
    return json({ error: 'server', detail: String(e?.message || e) }, 500);
  }
}
