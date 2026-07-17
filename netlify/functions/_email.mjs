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
 * From: no-reply@notifications.thequarter.work (a verified Resend domain).
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const FROM = 'The Quarter <no-reply@notifications.thequarter.work>';
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
        <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#b08a3e;font-weight:700;">The Quarter</div>
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#2b2620;">${esc(title)}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 28px;font-size:15px;line-height:1.6;color:#4a4235;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 32px 26px;border-top:1px solid #ece3d2;font-size:12px;line-height:1.5;color:#8a8172;">
        The Quarter · 1st &amp; 2nd Floor, 27–28 Burgate, Canterbury, Kent CT1 2HA<br/>
        <a href="mailto:info@thequarter.work" style="color:#b08a3e;">info@thequarter.work</a> · 01227 202 227 · Mon–Fri 09:00–17:30
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** Absolute site origin for deep-links in emails (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.work').replace(/\/$/, '');

/**
 * One shared admin/ops notification. Emails the ops inbox (info@thequarter.work — the reliable
 * channel; admins are ordinary members flagged only by email domain, so there is no admin push
 * store) with a consistent subject, an optional detail list, and a button that deep-links to the
 * right admin tab (e.g. link '/admin/#partners'). Best-effort — sendEmail never throws, so a
 * missing notification can never block or fail the underlying booking/payment/redemption.
 *
 * @param {string} kind    short category, e.g. 'New member', 'Reward redeemed', 'Room booked'
 * @param {string} summary one-line summary, e.g. 'jo@x.com · Resident'
 * @param {{ link?: string, rows?: Array<[string,string]|string> }} [opts]
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
    <p style="margin:18px 0 0;"><a href="${href}" style="display:inline-block;background:#2b2620;color:#fffdf8;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">Open in admin →</a></p>`;
  return sendEmail({
    to: OPS_EMAIL,
    subject: `[The Quarter] ${kind} — ${String(summary).slice(0, 90)}`,
    html: emailShell(kind, body, `${kind}: ${summary}`),
  });
}

/** Escape helper re-exported for templates that interpolate user content. */
export { esc as escapeHtml };
