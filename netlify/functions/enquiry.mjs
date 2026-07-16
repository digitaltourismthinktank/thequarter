/**
 * The Quarter — website enquiry / contact form → email (Resend).
 *
 * Replaces the old Netlify Forms submit, which silently no-ops with a static
 * export. POST the form fields as JSON; we email ops (reply-to the sender) and send
 * the sender a short acknowledgement.
 *
 *   POST { name, email, room?, company?, preferred?, message?, formName?, bot-field? }
 *
 * Env: RESEND_API_KEY (via _email). No auth — it's a public contact form.
 */
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL, emailReady } from './_email.mjs';
import { pushToEmail } from './_push.mjs';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const b = await req.json().catch(() => ({}));

  // Honeypot: a filled bot-field means a bot — pretend success, send nothing.
  if (b['bot-field']) return json({ ok: true });

  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad-input' }, 400);
  if (!emailReady()) return json({ error: 'not-configured' }, 503);

  const formName = String(b.formName || 'enquiry');
  const kind = formName === 'contact' ? 'message' : 'enquiry';
  const fields = [
    ['Name', name],
    ['Email', email],
    ['Phone', b.phone],
    ['Room', b.room],
    ['Company', b.company],
    ['Preferred date & time', b.preferred],
    ['Message', b.message],
  ].filter(([, v]) => String(v || '').trim());

  const rows = fields.map(([k, v]) => `<p style="margin:0 0 6px;"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</p>`).join('');

  const ops = await sendEmail({
    to: OPS_EMAIL,
    replyTo: email,
    subject: `New ${kind} — ${String(b.room || b.company || name)}`,
    html: emailShell(`New website ${kind}`, rows, `A new ${kind} from the website`),
  });
  await pushToEmail(OPS_EMAIL, { title: 'New enquiry', body: `${name} · ${String(b.room || b.company || kind)}`, url: '/admin/' });

  // Acknowledge the sender (best-effort — never fails the submit).
  await sendEmail({
    to: email,
    replyTo: OPS_EMAIL,
    subject: 'Thanks — we’ve got your message',
    html: emailShell(
      'Thanks for getting in touch',
      `<p>Hi ${escapeHtml(name)},</p><p>Thanks for your ${kind} — we’ll be in touch within one working day. In the meantime, the kettle’s on.</p>`,
      'We’ve received your message',
    ),
  });

  return json({ ok: ops.ok !== false });
}
