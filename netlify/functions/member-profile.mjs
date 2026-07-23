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
import { pushToEmail, pushToAdmins } from './_push.mjs';

const MS_SECRET = process.env.MEMBERSTACK_SECRET_KEY;
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

/* Mirrors lib/characters.ts. Duplicated deliberately: Netlify Functions are plain .mjs
   and can't import the TS module, and an allowlist is worth the duplication. */
const CHARACTER_IDS = ['knight', 'squire', 'yeoman', 'prioress', 'second-nun', 'monk', 'friar', 'merchant', 'clerk', 'lawyer', 'franklin', 'cook', 'shipman', 'physician', 'wife-of-bath', 'parson', 'plowman', 'miller', 'manciple', 'host'];

export default async function handler(req) {
  if (!MS_SECRET) return json({ error: 'not-configured' }, 503);
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const body = await req.json().catch(() => ({}));
  const vm = await verifyMember(tokenFromRequest(req, body));
  if (!vm.ok) return json({ error: vm.reason }, 401);

  const meta = { ...(vm.member.metaData || {}) };
  // NULL to clear, not delete — Memberstack merges metaData by key, so an omitted
  // key keeps its old value (it would reappear on refresh). Setting null clears it.
  if (body.bday === null) meta.bday = null;
  else if (typeof body.bday === 'string' && /^\d{2}-\d{2}$/.test(body.bday)) meta.bday = body.bday;
  if (typeof body.company === 'string') {
    const c = body.company.trim();
    meta.company = c || null;
  }
  // Optional self-service profile fields (all free-form metaData, cleared with an empty string).
  if (typeof body.phone === 'string') meta.phone = body.phone.trim() || null;
  if (typeof body.role === 'string') meta.role = body.role.trim() || null; // "what you do" — for intros/events
  if (typeof body.dietary === 'string') meta.dietary = body.dietary.trim() || null; // for catered events
  if (typeof body.forwardAddress === 'string') meta.forwardAddress = body.forwardAddress.trim() || null; // where to post mail on
  // Quarter Character — validated against the fixed set rather than stored free-form, so a
  // bad value can never reach the avatar renderer and blank someone's identity everywhere.
  if (typeof body.character === 'string') {
    meta.character = CHARACTER_IDS.includes(body.character) ? body.character : null;
  }
  // Notification preferences. Both are opt-OUTs (default false = opted in) so the friendly
  // extras keep reaching people who never touch this screen. They gate only non-essential
  // mail/pushes — receipts, bookings, plan changes and security always send regardless.
  //   emailOptOut — the news/events/updates emails (also set by the unsubscribe link)
  //   pushOptOut  — the space-wide announcement pushes ("we're celebrating…")
  if (typeof body.emailOptOut === 'boolean') meta.emailOptOut = body.emailOptOut;
  if (typeof body.pushOptOut === 'boolean') meta.pushOptOut = body.pushOptOut;
  // Instant book (one-tap saved-card pay). Opt-OUT: default off = feature ON. When true, we neither
  // offer nor charge their saved card for room/day-pass payments — read by room-booking.mjs.
  if (typeof body.instantBookOff === 'boolean') meta.instantBookOff = body.instantBookOff;

  // A VAT-invoice request — flagged for admin to action manually (our Stripe prices
  // are VAT-inclusive). Stamped with the request time; admin clears it when done.
  if (body.vatRequest === true) meta.vatRequested = new Date().toISOString();
  // A GDPR account & data deletion request. We DON'T hard-delete here: the card usually funds a
  // live subscription and data spans Stripe/Memberstack/Airtable, so it's flagged for the team to
  // action properly (cancel billing, erase, confirm). Stamped so admin sees and clears it.
  if (body.deletionRequest === true) meta.deletionRequested = new Date().toISOString();

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
    await pushToAdmins({ title: 'VAT invoice requested', body: `${email || vm.member.id}`, url: '/admin/' });
  }

  // Acknowledge a data-deletion request (member + ops). Best-effort. The team then processes it.
  if (body.deletionRequest === true) {
    const email = memberEmail(vm.member);
    const fn = String(vm.member?.customFields?.['first-name'] || '').trim();
    if (email) {
      await sendEmail({
        to: email,
        replyTo: OPS_EMAIL,
        subject: 'Your data deletion request',
        html: emailShell(
          'We’ve received your request',
          `<p>Hi${fn ? ` ${escapeHtml(fn)}` : ''},</p><p>We’ve logged your request to delete your account and data. Our team will action it and be in touch — if you have an active membership we’ll confirm the billing side with you first. You can cancel this request any time by replying to this email.</p>`,
          'We’ve logged your data deletion request',
        ),
      });
    }
    await sendEmail({
      to: OPS_EMAIL,
      subject: `⚠️ Data deletion requested — ${email || vm.member.id}`,
      html: emailShell(
        'Data deletion requested',
        `<p><strong>${escapeHtml(email || '')}</strong> (${escapeHtml(vm.member.id)}) has requested account &amp; data deletion.</p><p>Action: cancel any live subscription, detach the card, and erase across Stripe / Memberstack / Airtable, then confirm with them.</p>`,
        'A member requested account & data deletion',
      ),
    });
    await pushToAdmins({ title: 'Data deletion requested', body: `${email || vm.member.id}`, url: '/admin/' });
  }

  return json({
    ok: true,
    bday: meta.bday || null,
    company: meta.company || null,
    phone: meta.phone || null,
    role: meta.role || null,
    dietary: meta.dietary || null,
    vatRequested: meta.vatRequested || null,
    emailOptOut: meta.emailOptOut === true,
    pushOptOut: meta.pushOptOut === true,
    instantBookOff: meta.instantBookOff === true,
    deletionRequested: meta.deletionRequested || null,
  });
}
