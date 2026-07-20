/**
 * The Quarter — transactional email (Resend).
 *
 * One tiny wrapper the functions share: sendEmail() posts to Resend, and
 * emailShell() wraps body HTML in a consistent, on-brand layout. Everything is a
 * no-op (returns { skipped:true }) when RESEND_API_KEY is unset, so local/dev and
 * un-configured environments never throw — email is best-effort, never blocking a
 * booking or a payment.
 *
 * Env: RESEND_API_KEY (secret — set in Netlify only, never committed).
 *      RESEND_FROM (optional) — overrides the From address.
 * From: info@thequarter.work. NOTE: emails from any other brand/domain do NOT come from
 * here — check Memberstack (account + password-reset emails), Crisp and Stripe, whose
 * sender identities are configured in those dashboards, not in this repo.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Every email we send comes from The Quarter, never from another brand. Overridable via
 * RESEND_FROM so the address can be changed without a deploy — but the domain MUST be a
 * verified sending domain in the Resend account or Resend rejects the send.
 */
export const FROM = process.env.RESEND_FROM || 'The Quarter <info@thequarter.work>';
/** Operations inbox — all admin/ops notifications (bookings, requests, plan changes, etc.) land here. */
export const OPS_EMAIL = 'info@thequarter.work';

export function emailReady() {
  return !!RESEND_API_KEY;
}

/**
 * Send one email via Resend. Never throws — returns a small result object.
 * @param {{ to: string|string[], subject: string, html: string, replyTo?: string }} opts
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY unset — skipping', { to, subject });
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: data?.id ?? null, error: res.ok ? null : data };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Wrap body HTML in The Quarter's email shell (inline styles only — email clients
 * strip <style>). `preheader` is the hidden inbox-preview line.
 */
export function emailShell(title, bodyHtml, preheader = '') {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2620;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;padding:28px 0;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fffdf8;border:1px solid #ece3d2;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:26px 32px 8px;">
        <img src="${SITE_URL}/brand/logo-wordmark-black.png" alt="The Quarter" width="132" style="display:block;height:auto;width:132px;border:0;margin:0 0 10px;" />
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#2b2620;">${esc(title)}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 28px;font-size:15px;line-height:1.6;color:#4a4235;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 32px 26px;border-top:1px solid #ece3d2;font-size:12px;line-height:1.5;color:#8a8172;">
        The Quarter · 1st &amp; 2nd Floor, 27–28 Burgate, Canterbury, Kent CT1 2HA<br/>
        <a href="mailto:info@thequarter.work" style="color:#b08a3e;">info@thequarter.work</a> · 01227 202 227 · Mon–Fri 09:00–17:30<br/>
        <span style="color:#a49b8c;">The Quarter is operated by SE1 Media Ltd, trading as the Digital Tourism Think Tank.</span>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** Absolute site origin for deep-links in emails (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.work').replace(/\/$/, '');

/**
 * Format a date the European long way — "Monday 20 July 2026" — for every email.
 * Accepts a 'YYYY-MM-DD' string (treated as a London calendar day), an ISO
 * timestamp, or a Date. Falls back to the raw input if it can't be parsed.
 */
export function fmtDateLong(input) {
  try {
    const d =
      typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
        ? new Date(`${input}T12:00:00Z`) // noon UTC → same calendar day in London year-round
        : input instanceof Date
          ? input
          : new Date(input);
    if (Number.isNaN(d.getTime())) return String(input ?? '');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
  } catch {
    return String(input ?? '');
  }
}

/** "Monday 20 July 2026 · 09:00–17:30" (times optional). One consistent shape for all emails. */
export function fmtDateTime(input, start, end) {
  const day = fmtDateLong(input);
  if (start && end) return `${day} · ${start}–${end}`;
  if (start) return `${day} · ${start}`;
  return day;
}

/**
 * A tiny email-safe "where it sits in the day" bar for a booking. Renders the
 * business day (08:00–18:00) as a faint track with the booked slot filled in gold,
 * so ops can see the day filling up at a glance. startMin/endMin are minutes from
 * midnight (London wall-clock). Pure nested tables + % widths — no CSS an email
 * client would strip. Returns '' if the inputs aren't usable.
 */
export function dayBar(startMin, endMin) {
  const OPEN = 8 * 60;
  const CLOSE = 18 * 60;
  const SPAN = CLOSE - OPEN;
  const s0 = Number(startMin);
  const e0 = Number(endMin);
  if (!Number.isFinite(s0) || !Number.isFinite(e0) || e0 <= s0) return '';
  const s = Math.max(OPEN, Math.min(CLOSE, s0));
  const e = Math.max(s, Math.min(CLOSE, e0));
  const pre = Math.max(0, Math.round(((s - OPEN) / SPAN) * 100));
  const mid = Math.max(3, Math.round(((e - s) / SPAN) * 100));
  const post = Math.max(0, 100 - pre - mid);
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 2px;border-collapse:collapse;table-layout:fixed;background:#efe7d6;border-radius:6px;">
    <tr style="height:12px;line-height:12px;">
      <td style="width:${pre}%;"></td>
      <td style="width:${mid}%;background:#c99a3a;border-radius:6px;font-size:0;">&nbsp;</td>
      <td style="width:${post}%;"></td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr style="font-size:11px;color:#8a8172;">
      <td align="left">08:00</td><td align="center">13:00</td><td align="right">18:00</td>
    </tr>
  </table>`;
}

/**
 * One shared admin/ops notification. Emails the ops inbox (info@thequarter.work — the reliable
 * channel; admins are ordinary members flagged only by email domain, so there is no admin push
 * store) with a consistent subject, an optional detail list, and a button that deep-links to the
 * right admin tab (e.g. link '/admin/#partners'). Best-effort — sendEmail never throws, so a
 * missing notification can never block or fail the underlying booking/payment/redemption.
 *
 * @param {string} kind    short category, e.g. 'New member', 'Reward redeemed', 'Room booked'
 * @param {string} summary one-line summary, e.g. 'jo@x.com · Resident'
 * @param {{ link?: string, rows?: Array<[string,string]|string>, extraHtml?: string }} [opts]
 *   extraHtml is trusted HTML (already escaped by the caller) inserted before the button —
 *   e.g. a dayBar() timeline for a booking.
 */
export async function notifyAdmins(kind, summary, opts = {}) {
  const link = opts.link || '/admin/';
  const href = `${SITE_URL}${link.startsWith('/') ? link : `/${link}`}`;
  const rowsHtml = Array.isArray(opts.rows) && opts.rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;font-size:14px;color:#4a4235;">${opts.rows
        .map((r) =>
          Array.isArray(r)
            ? `<tr><td style="padding:2px 14px 2px 0;color:#8a8172;">${esc(r[0])}</td><td style="padding:2px 0;">${esc(r[1])}</td></tr>`
            : `<tr><td colspan="2" style="padding:2px 0;">${esc(r)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const body = `
    <p style="margin:0 0 4px;">${esc(summary)}</p>
    ${rowsHtml}
    ${opts.extraHtml || ''}
    <p style="margin:18px 0 0;"><a href="${href}" style="display:inline-block;background:#2b2620;color:#fffdf8;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">Open in admin →</a></p>`;
  return sendEmail({
    to: OPS_EMAIL,
    subject: `[The Quarter] ${kind} — ${String(summary).slice(0, 90)}`,
    html: emailShell(kind, body, `${kind}: ${summary}`),
  });
}

/** Escape helper re-exported for templates that interpolate user content. */
export { esc as escapeHtml };
