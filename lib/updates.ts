/**
 * The Quarter — the "what's new" log for admins.
 *
 * Add a new entry to the TOP of UPDATES whenever something worth telling the team about ships.
 * The admin app shows a pop-over the first time each admin opens it after a new entry (keyed on
 * the newest id, remembered in localStorage), and the whole list is browsable any time from
 * Admin → Screens & resources → "What's new". Keep entries plain-English and member-facing — the
 * point is that the team can read what changed without anyone having to explain it.
 */

export interface Update {
  /** Stable, unique — also the "seen" marker. Convention: YYYY-MM-DD-short-slug. */
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  items: string[];
}

export const UPDATES: Update[] = [
  {
    id: '2026-07-21-entrance-transport',
    date: '2026-07-21',
    title: 'Entrance screen: the week at a glance, weather & live transport',
    items: [
      'The lobby screen now shows the whole week’s busyness, not just how today feels.',
      'Canterbury weather sits by the clock, with a heads-up when rain is on the way.',
      'Live Canterbury West/East train and bus-station departures (switches on once the rail & bus data keys are approved).',
      'The scheduled announcement now runs along the top as a headline, and the room layout no longer collapses on the older screen.',
    ],
  },
  {
    id: '2026-07-21-reception-signage',
    date: '2026-07-21',
    title: 'Reception kiosk & printable signage',
    items: [
      'A shared iPad screen at reception (/reception) checks anyone in by name — members or guests — with no login.',
      'A printable signage set (/signage): check-in, guest sign-in and rewards posters, in A4 or A6, plus a counter card.',
      'All of it grouped sensibly under Admin → Screens & resources.',
    ],
  },
  {
    id: '2026-07-21-planned-attended',
    date: '2026-07-21',
    title: 'Reserved days now count as attendance',
    items: [
      'When a member reserves a day, it counts as being in — their day is spent automatically, so they needn’t tap check-in.',
      'Physical check-in is now just for walk-ins. Cancelling a day credits it straight back to their balance (never called a “refund”).',
      'A space-wide message now reaches everyone expected that day, not only those already at a desk.',
      'Fixed a hole where a plan member with an un-set balance could check in for free.',
    ],
  },
  {
    id: '2026-07-21-notifications-prefs',
    date: '2026-07-21',
    title: 'Notification preferences',
    items: [
      'Members choose their channels in the account area — friendly email updates and space-wide announcements, independently.',
      'The essentials (receipts, bookings, plan changes) always send.',
    ],
  },
  {
    id: '2026-07-21-admin-comms',
    date: '2026-07-21',
    title: 'Admin: comms & members tidy-up',
    items: [
      'To-Do emails now show a preview before they send — no more sending on the first click — and there’s a one-tap “mark all as welcomed” to clear the backlog.',
      'The To-Do shows people’s names again (it was showing the plan), and “everyone on a plan” counts real plans plus anyone holding day passes.',
      'Meeting-room hours are editable on the member list, can be set to zero, and there’s a “reset all to standard”.',
      'The old Access-check tool has been retired now entry is gated.',
    ],
  },
  {
    id: '2026-07-21-emails-plans',
    date: '2026-07-21',
    title: 'Emails & plans polish',
    items: [
      'Thank-you and welcome emails refreshed: a smart “on Friday / recently” date, the correct Google review link, a friendlier sign-off, and the Arke water note.',
      'Every public plan now shows a comparable per-day cost (Citizen included).',
    ],
  },
];

export const LATEST_UPDATE_ID = UPDATES.length ? UPDATES[0].id : '';
