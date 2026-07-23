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
    id: '2026-07-23-booking-post-hybrid',
    date: '2026-07-23',
    title: 'Clearer day-spending, post in the dashboard & the lobby board back',
    items: [
      'Booking a day ahead now spends the day (or a day pass) straight away, exactly like checking in — no more days quietly not coming off, and no booking past your allowance. Members see what each one costs and the points it earns, both on check-in and when they book ahead.',
      'Booking a meeting room or pod now also uses a co-working day for that date — being in for a meeting is being in the office — so a room or pod can’t be used to come in without a day. A day booked into next month draws from next month’s allowance.',
      'Fixed: a paid day pass now covers the whole day on its own — checking in no longer also takes a plan day on top of it.',
      'Your visits shows today’s booked day with a tick, and it can still be removed with the cross beside it (a day held by a room booking is released when you cancel the booking).',
      'Tapping check-in when you’re already booked in now says you’re already in — and lets you switch that day between a half and a full day right there, with the balance adjusted correctly.',
      'Post & Parcels lives in the dashboard: forward to the address on your profile and pay by card in-app, see an envelope photo or read a scan inline, and request a photo of any item.',
      'Hybrid Office members now see their included co-working day (one a month) on their dashboard, with a tap to book it.',
      'The lobby entrance screen’s transport board is back, rebuilt for the wide lobby display — bus departures now, with Canterbury West/East trains switching on once the rail key is confirmed.',
      'The phone app’s bottom bar now stays put while you scroll.',
    ],
  },
  {
    id: '2026-07-22-rooms-admin-tiered',
    date: '2026-07-22',
    title: 'Pay-as-you-go room top-ups + a tidier admin',
    items: [
      'Members who’ve used their included meeting-room hours can now book extra time, charged per hour at their plan’s member rate — Visitor 25%, Resident 50%, Citizen 75% off the standard rate — and pay for it right there in the dashboard.',
      'Faster paying: members can save a card and pay for extra room time in one tap next time (they always see which card, and can use a different one).',
      'Rooms & bookings has a new “By room” view: every meeting room and pod as its own lane across the week, with a By-room / By-day toggle.',
      'The member profile is grouped under three tabs — Membership & days, Rewards & points, Details & access — instead of one long scroll.',
      'The lobby entrance screen’s transport board is paused for a redesign, so it’s off the display for now.',
    ],
  },
  {
    id: '2026-07-21-entrance-transport',
    date: '2026-07-21',
    title: 'Entrance screen: the week at a glance, weather & live transport',
    items: [
      'The lobby screen now shows the whole week’s busyness, not just how today feels.',
      'Canterbury weather sits by the clock, with a heads-up when rain is on the way.',
      'Live Canterbury Bus Station departures — next hour, with route number and destination — running now from open bus-timetable data (no ongoing cost). Canterbury West/East train times switch on the moment the National Rail key is approved.',
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
];

export const LATEST_UPDATE_ID = UPDATES.length ? UPDATES[0].id : '';
