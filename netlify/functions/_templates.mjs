/**
 * The Quarter — the emails the team sends by hand.
 *
 * Distinct from the automatic ones (booking confirmations, weekend approvals) which live
 * with the function that triggers them. These are chosen and sent by a person from the
 * admin Comms tab, so they are defined as data: one place to read the words, change them,
 * and see at a glance what we say to members.
 *
 * Two properties drive the safety rules and are worth understanding before adding one:
 *
 *   kind: 'operational' — something the recipient needs in order to use what they bought
 *         (how the door works, an event they already RSVP'd to). No unsubscribe required.
 *   kind: 'marketing'   — promotion, however friendly. Under UK PECR these need a clear
 *         way out, so the shell appends an unsubscribe line and the send skips anyone who
 *         has opted out. Getting this wrong is a legal problem, not a taste one.
 *
 *   once: true — may only ever be sent to a given person once (the welcome, the rewards
 *         introduction). Enforced server-side against a stamp on the member's record, not
 *         by the admin remembering.
 */

import { emailShell, escapeHtml, SITE_URL } from './_email.mjs';
import { londonNow } from './_time.mjs';

const p = (html) => `<p style="margin:0 0 14px;">${html}</p>`;
const h = (t) => `<p style="margin:22px 0 8px;font-size:15px;font-weight:700;color:#2b2620;">${escapeHtml(t)}</p>`;
const ul = (items) =>
  `<ul style="margin:0 0 14px;padding-left:20px;">${items.map((i) => `<li style="margin:0 0 7px;">${i}</li>`).join('')}</ul>`;
const button = (href, label) =>
  `<p style="margin:22px 0 8px;"><a href="${href}" style="display:inline-block;background:#1e1a15;color:#faf7f0;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;font-size:15px;">${escapeHtml(label)}</a></p>`;
const quiet = (html) => `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#8a8172;">${html}</p>`;

/** First name if we have one, otherwise something that still reads like a person wrote it. */
const hi = (name) => {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first ? `Hi ${escapeHtml(first)},` : 'Hello,';
};

/* Rewards and plan language reused across templates, so a change lands everywhere. */
const REWARDS_LINE =
  'Every time you check in you earn Quarter Points, more on a quiet day, and they turn into real things: a coffee at Burgate, an evening at Corkk.';

/**
 * A natural, TIME-AWARE reference to when someone visited: "today", "yesterday", "on Friday"
 * for this past week, or "recently" for anything older — so a thank-you sent a fortnight late
 * never claims "on Friday". Returns '' when there's no date to work from.
 */
function visitWhen(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const today = londonNow().dateStr;
  if (dateStr === today) return 'today';
  const d = Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10));
  const t = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const diff = Math.round((t - d) / 86400000);
  if (diff === 1) return 'yesterday';
  if (diff >= 2 && diff <= 6) return `on ${new Date(d).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}`;
  return 'recently';
}
const thankLine = (c) => {
  const w = visitWhen(c.visitDate);
  return `Thank you for your day with us at The Quarter${w ? ` ${w}` : ''}. It was good to have you here.`;
};

export const TEMPLATES = {
  /* ------------------------------------------------------------------ day pass ---- */
  'thanks-review': {
    id: 'thanks-review',
    name: 'Thank you + ask for a review',
    blurb: 'For a day-pass visitor. Thanks them, and asks for a Google review.',
    kind: 'marketing',
    audience: 'day-pass',
    subject: () => 'Thank you for working with us',
    body: (c) =>
      p(hi(c.name)) +
      p(thankLine(c)) +
      p(
        'We are a small, independent space and we grow almost entirely by word of mouth, so a review genuinely makes a difference to us. If you enjoyed your day, would you take a moment to say so?',
      ) +
      button(c.reviewUrl || 'https://share.google/3VD689O42JMQVZUg8', 'Leave a Google review') +
      h('While you are here') +
      p(REWARDS_LINE) +
      p(
        `If you are thinking of coming back, a <a href="${SITE_URL}/plans" style="color:#b08a3e;">plan</a> or a <a href="${SITE_URL}/plans" style="color:#b08a3e;">book of day passes</a> works out cheaper than paying day by day, and plans come with meeting-room time for you and your clients.`,
      ) +
      p('Either way, we hope to see you again 👋'),
  },

  'thanks-only': {
    id: 'thanks-only',
    name: 'Thank you (no review ask)',
    blurb: 'The same warmth without asking for a review — for anyone whose day was less than perfect.',
    kind: 'marketing',
    audience: 'day-pass',
    subject: () => 'Thank you for working with us',
    body: (c) =>
      p(hi(c.name)) +
      p(thankLine(c)) +
      p(
        'If anything about the day was not quite right, we would genuinely like to know. Just reply to this email and it comes straight to us at info@thequarter.work.',
      ) +
      h('While you are here') +
      p(REWARDS_LINE) +
      p(
        `If you are thinking of coming back, a <a href="${SITE_URL}/plans" style="color:#b08a3e;">plan</a> or a book of day passes works out cheaper than paying day by day.`,
      ) +
      p('We hope to see you again 👋'),
  },

  /* -------------------------------------------------------------------- welcome ---- */
  welcome: {
    id: 'welcome',
    name: 'Welcome — how everything works',
    blurb: 'The practical things a new member needs: door, hours, kitchen, etiquette.',
    kind: 'operational',
    audience: 'members',
    once: true,
    subject: () => 'Welcome to The Quarter — a few things to know',
    body: (c) =>
      p(hi(c.name)) +
      p('Welcome to The Quarter. Here are the few things worth knowing before your first full day.') +
      h('Getting in') +
      p(
        'You will have been given either a door code or a key card. If it is a code: place your palm flat on the keypad to wake it, enter the code, and press # at the end — the # matters. Your code is always on your dashboard if it goes out of your head.',
      ) +
      h('When you can come') +
      p(
        'Anyone on a plan can use The Quarter whenever they like. After 20:00 and at weekends we just ask you to arrange it first — in person, on the chat, or for weekends through your dashboard. It is almost always a yes.',
      ) +
      h('Help yourself') +
      p(
        'The kitchen is yours. Coffee, teas, soft drinks, yoghurts, cereals, and whatever pastries or cake are on the counter — all included. We would rather you treated it like your own kitchen than asked.',
      ) +
      p('Bringing lunch? The fridge is upstairs — label it clearly. Anything left over the weekend gets thrown out. You have been warned.') +
      p("We hope you enjoy the Arke filtered water. You'll find jugs upstairs and downstairs, and if you see one running a little low, please take a moment to refill it for the next person.") +
      h('The bit that keeps it pleasant') +
      p('We share the place, so a few small things:') +
      ul([
        'Washing up goes in the dishwasher — check it says <strong>dirty</strong> before you load it.',
        'Take the cork base off the bottom of a mug before it goes in.',
        'Hand towel is beside the sink. Tea towel lives under the sink — just open the door.',
        'If you make a mess in the kitchen, clear it up. That is the whole etiquette policy.',
      ]) +
      h('One more thing') +
      p(REWARDS_LINE) +
      button(`${SITE_URL}/dashboard`, 'Open your dashboard') +
      p('Anything at all, just ask — we are usually about.'),
  },

  'rewards-intro': {
    id: 'rewards-intro',
    name: 'Introducing Quarter Rewards',
    blurb: 'A warm explanation of how points work. Sent once, a few days after joining.',
    kind: 'marketing',
    audience: 'members',
    once: true,
    subject: () => 'A little thanks for turning up',
    body: (c) =>
      p(hi(c.name)) +
      p(
        'Now you have settled in, a word about Quarter Rewards — our way of saying thank you for being here, and for spending your money with our neighbours rather than a chain.',
      ) +
      h('Earning') +
      p(
        'You earn points simply by checking in, and <strong>double on a quiet day</strong> — Mondays and Fridays tend to be quieter, and spreading the week out makes the place better for everyone. You also earn on anything you spend with us.',
      ) +
      h('Spending') +
      p(
        'Points turn into real things from people around the corner: a coffee at Burgate, a glass or a whole evening at Corkk. No vouchers to print, you show your phone.',
      ) +
      h('Levels') +
      p(
        'The longer you are with us the faster you earn. Regular, Family and Ambassador each earn more than the last, and they carry a few small privileges of their own.',
      ) +
      button(`${SITE_URL}/rewards`, 'See your points') +
      p('If any of it is unclear, come and find us — we would rather explain it in person over a coffee.'),
  },

  /* --------------------------------------------------------------------- events ---- */
  'event-invite': {
    id: 'event-invite',
    name: 'Upcoming event — come along',
    blurb: 'Invites a group to the next event. Food and drinks on us.',
    kind: 'marketing',
    audience: 'event',
    subject: (c) => `${c.eventTitle || 'An evening at The Quarter'} — join us`,
    body: (c) =>
      p(hi(c.name)) +
      p(`We have something coming up and we would like you there.`) +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#faf5ea;border-radius:12px;"><tr><td style="padding:16px 18px;">
        <div style="font-size:17px;font-weight:700;color:#2b2620;margin:0 0 4px;">${escapeHtml(c.eventTitle || '')}</div>
        <div style="font-size:14px;color:#6b6355;">${escapeHtml(c.eventWhen || '')}${c.eventLocation ? ` · ${escapeHtml(c.eventLocation)}` : ''}</div>
      </td></tr></table>` +
      (c.eventBlurb ? p(escapeHtml(c.eventBlurb)) : '') +
      p(
        'As always, food and drinks are on us. It is a good chance to meet the people you have been sitting near all month, eat something decent, and widen your circle in Canterbury a little.',
      ) +
      button(`${SITE_URL}/whats-on`, 'Let us know you are coming') +
      p('No need to bring anything but yourself.'),
  },

  'event-reminder': {
    id: 'event-reminder',
    name: 'Event reminder (for people coming)',
    blurb: 'A short nudge to everyone who has already said yes.',
    kind: 'operational',
    audience: 'event-rsvps',
    subject: (c) => `See you at ${c.eventTitle || 'The Quarter'}`,
    body: (c) =>
      p(hi(c.name)) +
      p(`Just a reminder that you are coming to <strong>${escapeHtml(c.eventTitle || '')}</strong>.`) +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#faf5ea;border-radius:12px;"><tr><td style="padding:16px 18px;">
        <div style="font-size:14px;color:#6b6355;">${escapeHtml(c.eventWhen || '')}${c.eventLocation ? ` · ${escapeHtml(c.eventLocation)}` : ''}</div>
      </td></tr></table>` +
      p('Food and drinks are on us. If your plans have changed, just reply and let us know so we cater properly.') +
      p('See you there.'),
  },

  /* --------------------------------------------------------------------- custom ---- */
  custom: {
    id: 'custom',
    name: 'Write your own',
    blurb: 'A plain note in the house style — for anything that has no template.',
    // Marketing, deliberately. Free text aimed at a whole audience is the single most
    // likely thing here to carry promotion, and classing it operational would have let it
    // reach everyone who unsubscribed with no way out in the footer — every other route to
    // a mass promotional send is guarded, and this would have been the hole in that.
    kind: 'marketing',
    audience: 'any',
    subject: (c) => c.subject || 'A note from The Quarter',
    body: (c) =>
      p(hi(c.name)) +
      String(c.message || '')
        .split(/\n{2,}/)
        .map((para) => p(escapeHtml(para.trim()).replace(/\n/g, '<br/>')))
        .join('') +
      p('— The Quarter'),
  },
};

/** An unsubscribe line, appended to marketing sends only. */
function unsubscribeBlock(token) {
  if (!token) return '';
  return quiet(
    `You are getting this because you are part of The Quarter. If you would rather not receive occasional notes like this, <a href="${SITE_URL}/unsubscribe?t=${encodeURIComponent(token)}" style="color:#8a8172;">unsubscribe here</a> — it will not affect anything to do with your bookings or your membership.`,
  );
}

/**
 * Render a template to a finished email.
 * @param {string} id
 * @param {object} ctx  { name, email, visitDate, eventTitle, eventWhen, eventLocation, eventBlurb, subject, message, unsubToken, reviewUrl }
 */
export function renderTemplate(id, ctx = {}) {
  const t = TEMPLATES[id];
  if (!t) return null;
  const subject = typeof t.subject === 'function' ? t.subject(ctx) : String(t.subject || '');
  const inner = t.body(ctx) + (t.kind === 'marketing' ? unsubscribeBlock(ctx.unsubToken) : '');
  return { subject, html: emailShell(subject, inner, ctx.preheader || ''), kind: t.kind, once: !!t.once };
}

/** Everything the admin UI needs to list the templates, without shipping the HTML. */
export const TEMPLATE_INDEX = Object.values(TEMPLATES).map((t) => ({
  id: t.id,
  name: t.name,
  blurb: t.blurb,
  kind: t.kind,
  audience: t.audience,
  once: !!t.once,
}));
