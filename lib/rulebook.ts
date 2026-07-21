/**
 * The Quarter — what the system does on its own.
 *
 * WHY THIS FILE. After building a lot of automation quickly it stopped being possible to
 * answer "what happens when someone books a room?" without reading the code. That's a bad
 * place to be: nobody can spot a missing email, and nobody can tell a member with confidence
 * what they'll receive. This is the reference, rendered at /admin/rules.
 *
 * It is a HAND-MAINTAINED MIRROR of the Netlify functions — it cannot be generated, so it can
 * drift. Every row carries the file it came from: if you change a function's side-effects,
 * change its row here in the same commit. A wrong rule book is worse than none, because the
 * team will trust it.
 *
 * Compiled from a full read of netlify/functions/*.mjs, verified line by line.
 */

export interface RuleRow {
  /** What the member, guest or admin does. */
  trigger: string;
  /** Which function handles it — where to look. */
  source: string;
  /** Email to the member/buyer, or null. */
  member?: string | null;
  /** Email to info@thequarter.work, or null. */
  ops?: string | null;
  /** Web push, and to whom. */
  push?: string | null;
  /** What is written or changed. */
  records?: string | null;
  /** Rewards points effect. */
  points?: string | null;
  /** Anything else worth knowing — limits, refusals, gotchas. */
  notes?: string | null;
}

export interface RuleSection {
  title: string;
  blurb?: string;
  rows: RuleRow[];
}

/** Things that are true of every row above, so they aren't repeated forty times. */
export const RULE_FACTS: { label: string; value: string }[] = [
  { label: 'Emails come from', value: 'The Quarter <no-reply@notifications.thequarter.work> — set by RESEND_FROM' },
  { label: 'Ops emails go to', value: 'info@thequarter.work — every admin/ops email lands here' },
  { label: 'Ops subject shape', value: '[The Quarter] {kind} — {summary}' },
  { label: 'Email never blocks', value: 'A send failure is logged and swallowed; it can never fail a booking or payment' },
  { label: 'If Resend is not configured', value: 'Every email silently skips — no error, no retry' },
  {
    label: 'Admin push reaches',
    value: 'Only staff who signed in as a member on an @thinkdigital.travel address AND enabled notifications. Otherwise it silently does nothing — email to info@ is the reliable channel.',
  },
  { label: 'Dates in emails', value: 'European long form — "Monday 20 July 2026"' },
];

export const RULE_SECTIONS: RuleSection[] = [
  {
    title: 'Coming in',
    blurb: 'Check-ins, reservations and day passes.',
    rows: [
      {
        trigger: 'Member checks in for today',
        source: 'checkin.mjs · action:"checkin"',
        member: null,
        ops: null,
        push: 'Only if the points cross a level — "You reached a new level"',
        records: 'Flips a Planned row to Checked-in, or creates one',
        points: '+10, or +20 on a quiet day, × their level boost. Capped at 12 counted check-ins a month.',
        notes:
          'Spends a plan day first. If plan days are gone it spends a carnet pass instead and says so — a pass covers a whole day, even for a half day. Blocked on closed days, and on weekends unless already approved.',
      },
      {
        trigger: 'Member reserves a future weekday',
        source: 'checkin.mjs · action:"reserve"',
        records: 'Check-in row, status Planned',
        notes: 'No day is deducted until they actually check in.',
      },
      {
        trigger: 'Member requests a weekend day',
        source: 'checkin.mjs · action:"reserve" on Sat/Sun',
        member: '"Your weekend access request"',
        ops: '"Weekend access requested — {date} ({name})"',
        push: 'Member: "Request received" · Admins: "New weekend request"',
        records: 'Check-in row, status Requested',
        notes: 'Appears in the admin weekend-requests panel, which polls every 60s and chimes when a new one lands.',
      },
      {
        trigger: 'Admin approves or declines a weekend request',
        source: 'admin.mjs',
        member: 'Approved or declined notice',
        push: 'Member',
        records: 'Status → Planned or Cancelled',
      },
      {
        trigger: 'Member cancels their own reservation',
        source: 'checkin.mjs · action:"cancel"',
        records: 'Status → Cancelled',
        notes: 'Only Planned and Requested days can be cancelled. If the day had already been spent (a same-day cancel), it is credited straight back to their balance — never described as a refund.',
      },
      {
        trigger: 'Member spends a carnet pass directly',
        source: 'carnet.mjs · action:"use"',
        records: 'Check-in row, notes "Carnet pass"',
        points: 'Same as a normal check-in',
      },
    ],
  },
  {
    title: 'Rooms and pods',
    blurb: 'Who may book what, and what it sets off.',
    rows: [
      {
        trigger: 'Member books a room or pod (dashboard)',
        source: 'bookings.mjs · action:"book"',
        ops: '"Room/pod booked — {name} · {room} · {date time}", with a timeline of where it sits in the day',
        records: 'Bookings row, Kind Member, Source Web',
        notes:
          'Refused if: the slot clashes, they already hold a space at that time, it is a meeting room and they have no plan, they have no access on that date, it would exceed their monthly hours, or a pod booking is over two hours.',
      },
      {
        trigger: 'Member amends a booking',
        source: 'bookings.mjs · action:"amend"',
        ops: '"Booking amended — …" with the timeline',
        records: 'Date, start, end and title updated in place',
        notes: 'Re-checks entitlement, excluding the booking being moved so it is not counted twice. Paid and recurring bookings are admin-only.',
      },
      {
        trigger: 'Member cancels a booking',
        source: 'bookings.mjs · action:"cancel"',
        ops: 'None — worth knowing, ops are told about bookings but not cancellations',
        records: 'Status → Cancelled',
        notes: 'The hours return to their monthly allowance immediately. Paid bookings cannot be self-cancelled — there is no refund path.',
      },
      {
        trigger: 'Guest or member pays for a room',
        source: 'room-booking.mjs → Stripe → stripe-webhook.mjs',
        member: 'Booking confirmation with the room, time and total',
        ops: 'Paid booking notice',
        push: 'Admins',
        records: 'Bookings row, Kind Company',
        points: 'Earned on the spend',
        notes: 'Quiet-day bookings take 20% off. Lunch is £12 a head.',
      },
    ],
  },
  {
    title: 'Entitlements',
    blurb: 'The rules the booking screen enforces. Change the numbers in _entitlement.mjs.',
    rows: [
      {
        trigger: 'Meeting-room hours per month',
        source: '_entitlement.mjs · PLAN_ROOM_HOURS',
        notes: 'Day Pass 0 · Hybrid Office 0 · Visitor 2 · Resident 4 · Citizen 8. Set a member’s own figure from their admin profile and it wins.',
      },
      {
        trigger: 'How hours are counted',
        source: '_entitlement.mjs · monthlyMeetingRoomHours',
        notes:
          'Summed live from confirmed bookings in the calendar month, not held as a counter. So cancelling returns the hours at once, and amending recalculates. Pods never count. Paid bookings never count.',
      },
      { trigger: 'Phone pods', source: '_entitlement.mjs · POD_MAX_HOURS', notes: 'Open to every plan and to day-pass holders. Two continuous hours per booking; longer is by arrangement.' },
      {
        trigger: 'Access on the day',
        source: '_entitlement.mjs · hasAccessOn',
        notes: 'A plan holder always has access. Someone without a plan may only book on dates they hold a paid day pass for.',
      },
    ],
  },
  {
    title: 'Money',
    blurb: 'Everything that touches Stripe.',
    rows: [
      {
        trigger: 'Someone buys a day pass',
        source: 'day-pass.mjs → stripe-webhook.mjs',
        member: 'Day pass confirmation with the date and arrival time',
        ops: 'Day pass sold',
        push: 'Admins',
        records: 'Check-in row, status Paid, for that date',
        points: 'Earned on the spend',
      },
      {
        trigger: 'Someone buys a carnet of day passes',
        source: 'carnet.mjs → stripe-webhook.mjs',
        member: '"Your day-pass carnet — N passes (£X)"',
        ops: 'Carnet sold',
        records: 'Carnet balance and expiry on their Memberstack record',
        points: 'Earned on the spend',
      },
      {
        trigger: 'Someone joins a plan',
        source: 'join.mjs / subscribe.mjs → stripe-webhook.mjs',
        member: 'Welcome',
        ops: 'New member',
        push: 'Admins',
        records: 'Plan tagged, day allowance set',
        points: 'Welcome bonus — Visitor 250, Resident 500, Citizen 1000. Hybrid gets none.',
      },
      {
        trigger: 'Monthly renewal',
        source: 'stripe-webhook.mjs · invoice paid',
        records: 'Day allowance reset, rollover applied',
        notes: 'Also re-tags the plan if it changed.',
      },
      {
        trigger: 'Member pauses',
        source: 'plan-change.mjs · action:"pause"',
        member: '"Your membership is paused"',
        records: 'Stripe collection paused, plan flipped to the frozen Paused state',
        notes:
          'Indefinite — it holds until they resume, not for one month. Invoices are still generated and immediately voided, so Stripe shows a "next invoice" that will never be charged.',
      },
      {
        trigger: 'Member resumes',
        source: 'plan-change.mjs · action:"resume"',
        member: '"Welcome back"',
        notes: 'Billing restarts from the day they return, not the old renewal date. Frozen rollover days carry over.',
      },
      { trigger: 'Member switches plan', source: 'plan-change.mjs · action:"switch"', member: '"Your plan change is set"', notes: 'Takes effect at the next renewal, not immediately.' },
      { trigger: 'A payment fails', source: 'stripe-webhook.mjs', member: 'Card problem notice', push: 'Admins', records: 'Flagged in admin as needing attention' },
    ],
  },
  {
    title: 'Rewards',
    rows: [
      { trigger: 'Points earned', source: '_rewards.mjs', notes: 'Check-in +10 (+20 quiet day), spend 1 per £1, referral, welcome bonus, annual prepay. Multiplied by level: Newbie 1.0, Regular 1.15, Family 1.3, Ambassador 1.5.' },
      { trigger: 'Member redeems a reward', source: 'rewards.mjs · redeem', member: 'Redemption with a verification link', ops: 'Redeemed', records: 'Redemption row; partner float decremented', points: 'Deducted' },
      { trigger: 'Level up', source: '_rewards.mjs', push: 'Member — "You reached a new level"' },
      { trigger: 'Birthday treat claimed', source: 'rewards.mjs', ops: 'Birthday claim', notes: 'Once a year, from the member card.' },
    ],
  },
  {
    title: 'Enquiries and visits',
    rows: [
      { trigger: 'Someone books a tour', source: 'tour.mjs', member: 'Tour confirmation', ops: 'Tour booked', push: 'Admins', records: 'Bookings row, Kind Tour — appears in the admin who’s-in pane' },
      { trigger: 'Someone sends an enquiry', source: 'enquiry.mjs', member: 'Acknowledgement', ops: 'New enquiry', push: 'Admins' },
      { trigger: 'A guest signs in at the kiosk', source: 'guests.mjs', ops: 'Guest arrived', records: 'Guest row — counts for the fire roll-call' },
      { trigger: 'Member RSVPs to an event', source: 'events.mjs · action:"rsvp"', records: 'RSVP row', notes: 'Shows on their Home, and in the admin attendee list.' },
    ],
  },
  {
    title: 'Emails the team sends by hand',
    blurb: 'Admin → Comms. Everything here is chosen by a person; nothing sends itself.',
    rows: [
      {
        trigger: 'Thank a day-pass visitor',
        source: 'comms.mjs · thanks-review / thanks-only',
        member: 'Thanks them for the day, and either asks for a Google review or does not',
        records: 'Stamps the Check-ins row so the to-do list stops asking',
        notes:
          'Two versions on purpose: send the plain thank-you when the day was less than perfect, so we never ask for a review we would regret. Dismissing the row also stamps it — an item you can only clear by acting becomes a guilt list.',
      },
      {
        trigger: 'Welcome a new member',
        source: 'comms.mjs · welcome',
        member: 'Door, hours, kitchen, etiquette',
        records: 'commsSent.welcome on their Memberstack record',
        notes: 'Once only, enforced server-side. Operational, so it reaches people who have unsubscribed.',
      },
      {
        trigger: 'Introduce Quarter Rewards',
        source: 'comms.mjs · rewards-intro',
        member: 'How earning, spending and levels work',
        records: 'commsSent.rewards-intro',
        notes: 'Once only. Appears in the to-do list once they have had the welcome.',
      },
      {
        trigger: 'Invite a group to an event',
        source: 'comms.mjs · event-invite',
        member: 'The event, and that food and drinks are on us',
        notes: 'Marketing — carries an unsubscribe link and skips anyone who has opted out.',
      },
      {
        trigger: 'Remind people who are coming',
        source: 'comms.mjs · event-reminder',
        member: 'Time, place, and a nudge to tell us if plans changed',
        notes: 'Operational — they already said yes, so opt-outs still receive it.',
      },
      { trigger: 'Write something one-off', source: 'comms.mjs · custom', member: 'Whatever you type, in the house style' },
      {
        trigger: 'Any group send',
        source: 'comms.mjs · send',
        notes:
          'Always asks the server who it would reach and shows the count before sending. Recipients are resolved server-side, so a stale tab cannot mail the wrong list. Sent one message per person via Resend batch — never a shared To header.',
      },
      {
        trigger: 'Someone unsubscribes',
        source: 'unsubscribe.mjs',
        records: 'emailOptOut on their Memberstack record',
        notes: 'Only stops marketing. Bookings, membership and events they said yes to still arrive.',
      },
      {
        trigger: 'Push to whoever is in today',
        source: 'comms.mjs · push',
        push: 'Everyone checked in today, or one named person',
        notes: 'For "there is cake in the Pantry", or a quiet word about locking up. Goes only to people who enabled notifications.',
      },
    ],
  },
  {
    title: 'Friends of members',
    rows: [
      {
        trigger: 'Member invites a friend to an event',
        source: 'invite.mjs · invite',
        member: 'The friend gets the event and a one-tap RSVP link',
        notes: 'No account needed. The link carries the event and who invited them.',
      },
      {
        trigger: 'The friend accepts',
        source: 'invite.mjs · accept',
        member: 'The member who invited them is told their friend is coming',
        ops: 'Guest RSVP, so the kitchen caters properly',
        records: 'An RSVP row named "Name (guest of Member)" — so the admin list shows who vouched for whom',
      },
    ],
  },
  {
    title: 'On a schedule',
    rows: [
      { trigger: 'Daily — renewals and rollover', source: 'renew-cron.mjs', notes: 'Runs @daily. Resets allowances that Stripe did not, and applies rollover.' },
      { trigger: 'Every 60 seconds — weekend requests', source: 'admin dashboard (client)', notes: 'The admin panel re-reads pending requests and chimes when the count rises. Only while an admin has the tab open.' },
    ],
  },
];
