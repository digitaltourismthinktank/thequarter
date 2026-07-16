/**
 * The Quarter — member self-service profile fields stored on Memberstack metaData.
 *
 * POST (member token) { bday?: 'MM-DD' | null, company?: string }
 *   bday    — birthday as month-day only (no year); captured at signup, optional.
 *   company — optional company for soft team grouping (CODE_BRIEF §15).
 *
 * metaData is free-form, so these need no Memberstack dashboard setup.
 */
import memberstackAdmin from '@memberstack/admin';
import { verifyMember, tokenFromRequest, memberEmail } from './_member.mjs';
import { sendEmail, emailShell, escapeHtml, OPS_EMAIL } from './_email.mjs';
import { pushToEmail } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

export default async function handler(req) {
  if (!MS_SECRET) return json({ error: 'not-configured' }, 503);
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  const meta = { ...(vm.member.metaData || {}) };
  if (body.bday === null) delete meta.bday;
  else if (typeof body.bday === 'string' && /^\d{2}-\d{2}$/.test(body.bday)) meta.bday = body.bday;
  if (typeof body.company === 'string') {
    const c = body.company.trim();
    if (c) meta.company = c;
    else delete meta.company;
  }
  // A VAT-invoice request — flagged for admin to action manually (our Stripe prices
  // are VAT-inclusive). Stamped with the request time; admin clears it when done.
  if (body.vatRequest === true) meta.vatRequested = new Date().toISOString();

  const admin = memberstackAdmin.init(MS_SECRET);
  await admin.members.update({ id: vm.member.id, data: { metaData: meta } });

  // Acknowledge a VAT-invoice request by email (member + ops). Best-effort.
  if (body.vatRequest === true) {
    const email = memberEmail(vm.member);
    const fn = String(vm.member?.customFields?.['first-name'] || '').trim();
    if (email) {
      await sendEmail({
        to: email,
        replyTo: OPS_EMAIL,
        subject: 'Your VAT invoice request',
        html: emailShell(
          'Your VAT invoice is on its way',
          `<p>Hi${fn ? ` ${escapeHtml(fn)}` : ''},</p><p>Thanks — we’ve logged your request for a VAT invoice. Our team will issue it within the next business day, to this email address.</p>`,
          'We’ve logged your VAT invoice request',
        ),
      });
      await pushToEmail(email, { title: 'Invoice request received', body: "We'll issue your VAT invoice within a business day.", url: '/plan/' });
    }
    await sendEmail({
      to: OPS_EMAIL,
      subject: `VAT invoice requested — ${email || vm.member.id}`,
      html: emailShell('VAT invoice requested', `<p><strong>${escapeHtml(email || '')}</strong> has requested a VAT invoice.</p>`, 'A member requested a VAT invoice'),
    });
    await pushToEmail(OPS_EMAIL, { title: 'VAT invoice requested', body: `${email || vm.member.id}`, url: '/admin/' });
  }

  return json({ ok: true, bday: meta.bday || null, company: meta.company || null, vatRequested: meta.vatRequested || null });
}
