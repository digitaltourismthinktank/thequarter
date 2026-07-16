/**
 * The Quarter — client API for the booking + check-in Netlify Functions.
 * Attaches the member's Memberstack JWT for authenticated calls. Client-only.
 */
import { getMemberToken } from './memberstack';
import { PREVIEW, previewCall } from './devMock';

const FN = '/.netlify/functions';

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

async function call<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, auth = true } = opts;
  // Local preview: serve canned data instead of the (absent) Netlify Functions.
  if (PREVIEW) {
    const mocked = previewCall(path, method);
    if (mocked) return mocked as ApiResult<T>;
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) {
    const t = await getMemberToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(`${FN}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { ok: false, status: 0, data: { error: 'network' } as T & { error?: string } };
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export interface Space {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
  capacityLabel: string | null;
  bookable: boolean;
  colour: string | null;
  floor: number | null;
}
export interface BusyRange {
  startMin: number;
  endMin: number;
}
export interface MyBooking {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  space: string | null;
  title: string;
  /** 'Member' = free self-cancellable booking; 'Company' = paid (no self-cancel — ops/refund). */
  kind: string;
}
export interface CheckinStatus {
  date: string;
  checkedIn: boolean;
  length: 'Full' | 'Half' | null;
  balance: string | null;
  planned: { id: string; date: string; length: 'Full' | 'Half'; kind?: 'pass' | 'reserved' }[];
  requested?: { id: string; date: string; length: 'Full' | 'Half' }[];
}

// Bookings
export const getSpaces = () => call<{ spaces: Space[] }>('bookings?action=spaces', { auth: false });
export const getAvailability = (space: string, date: string) =>
  call<{ openMin: number; closeMin: number; slotMin: number; busy: BusyRange[] }>(
    `bookings?action=availability&space=${encodeURIComponent(space)}&date=${date}`,
    { auth: false },
  );
export const getMyBookings = () => call<{ bookings: MyBooking[] }>('bookings?action=mine');
export const createBooking = (b: { spaceId: string; date: string; start: string; end: string }) =>
  call<{ ok: boolean; id: string }>('bookings', { method: 'POST', body: { action: 'book', ...b } });
export const cancelBooking = (bookingId: string) =>
  call<{ ok: boolean }>('bookings', { method: 'POST', body: { action: 'cancel', bookingId } });

// Native paid room booking (public — anyone can book + pay a meeting room / pod).
export interface RoomQuoteLine {
  label: string;
  amount: number;
}
export interface RoomQuote {
  amountPence: number;
  lines: RoomQuoteLine[];
  start: string;
  end: string;
}
export interface RoomIntent extends RoomQuote {
  clientSecret: string;
  /** TEST COMP: true when the server skipped Stripe and recorded the booking at £0. */
  comped?: boolean;
}
export interface RoomBookingInput {
  spaceId: string;
  date: string;
  /** Meeting rooms: 'am' | 'pm' | 'full' (derived from the chosen range). Pods: a start time 'HH:MM'. */
  pkg: string;
  /** The real chosen window ('HH:MM'). The AMOUNT is package-priced server-side; these
   *  record the true booked times. Omitted → the server falls back to the package times. */
  start?: string;
  end?: string;
  people?: number;
  lunch?: boolean;
  company?: string;
  name?: string;
  email?: string;
  /** Contact's phone (paid/company bookings). Carried into the Stripe PI metadata. */
  phone?: string;
  /** Contact's job title (paid/company bookings). Stored in the booking Notes. */
  jobTitle?: string;
  /** TEST COMP (secret, env-gated). When it matches the server's TEST_COMP_CODE the booking is
   *  recorded + confirmed at £0 without Stripe; otherwise ignored. Never set for normal users. */
  test?: string;
}
export const roomQuote = (b: RoomBookingInput) =>
  call<RoomQuote>('room-booking', { method: 'POST', auth: false, body: { action: 'quote', ...b } });
// Authed: attaches the member JWT when signed in so a PAYING member earns the give-back
// and the booking is linked to them. getMemberToken() returns null for guests, so a
// guest sends no token and still pays (and books) exactly as before.
export const roomIntent = (b: RoomBookingInput) =>
  call<RoomIntent>('room-booking', { method: 'POST', auth: true, body: { action: 'intent', ...b } });
// Member free-booking (two main rooms, capped) — needs the member token (auth).
export interface RoomMemberStatus {
  capHours: number;
  usedHours: number;
  remaining: number;
}
export const roomMemberStatus = (date?: string) =>
  call<RoomMemberStatus>('room-booking', { method: 'POST', body: { action: 'member-status', date } });
export const roomMemberFree = (b: RoomBookingInput) =>
  call<{ ok: boolean; id: string; remaining: number; capHours: number }>('room-booking', { method: 'POST', body: { action: 'member-free', ...b } });

// Team-room privatisation (custom Stripe subscription, billed quarterly).
export interface PrivatisationQuote {
  monthly: number;
  quarterly: number;
  lines: RoomQuoteLine[];
}
export const privatisationQuote = (b: { roomSlug: string; frequency: string }) =>
  call<PrivatisationQuote>('privatisation', { method: 'POST', auth: false, body: { action: 'quote', ...b } });
// Real-time per-weekday availability for a room + cadence + start date (public, no auth).
// Returns a { weekdayId: 'free' | 'taken' } map so the picker can grey out clashing days.
export const privatisationAvailability = (b: { roomSlug: string; frequency: string; weekdays: number[]; startDate: string }) =>
  call<{ ok: boolean; weekdays: Record<number, 'free' | 'taken'> }>('privatisation', {
    method: 'POST',
    auth: false,
    body: { action: 'availability', ...b },
  });
export const privatisationCheckout = (b: {
  roomSlug: string;
  frequency: string;
  days: number[];
  startDate: string;
  company: string;
  name: string;
  email: string;
  members: number;
}) => call<{ url: string }>('privatisation', { method: 'POST', auth: false, body: { action: 'checkout', ...b } });

// Embedded (in-site) privatisation — Stripe Elements, charges the first quarter now.
export const privatisationSubscribe = (b: {
  roomSlug: string;
  frequency: string;
  days: number[];
  startDate: string;
  company: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  phone?: string;
  email: string;
  members: number;
}) => call<{ clientSecret: string; subscriptionId: string }>('privatisation', { method: 'POST', auth: false, body: { action: 'subscribe', ...b } });

// Join with a chosen future start date (Stripe Checkout, trial-until start).
export const joinWithStartDate = (b: { plan: string; term: 'monthly' | 'annual'; startDate?: string; email?: string }) =>
  call<{ url: string }>('join', { method: 'POST', auth: false, body: b });

// Native in-site plan subscription (Stripe Elements — no Payment Links, no redirect out).
// Optional startDate (YYYY-MM-DD, future) dates the subscription forward: the server returns
// mode:'setup' (save the card now, Stripe charges at the start date) instead of mode:'payment'.
export const subscribeToPlan = (b: { plan: string; term: 'monthly' | 'annual'; email: string; name?: string; startDate?: string }) =>
  call<{ clientSecret: string; subscriptionId: string; customerId: string; mode?: 'payment' | 'setup'; message?: string }>('subscribe', {
    method: 'POST',
    auth: false,
    body: b,
  });

// Native Day Pass one-off checkout (£21.60 PaymentIntent — replaces the Typeform embed).
export const dayPassIntent = (b: { firstName: string; lastName: string; company?: string; email: string; date: string; arrival?: string; test?: string }) =>
  call<{ clientSecret: string; comped?: boolean }>('day-pass', { method: 'POST', auth: false, body: b });

// Native carnet purchase (member — in-site PaymentIntent for a bundle of day passes).
export const carnetIntent = (passes: number) =>
  call<{ clientSecret: string }>('carnet', { method: 'POST', body: { action: 'intent', passes } });

// Public carnet purchase (buy-then-join — no account yet). The guest's email rides in the
// Stripe PI metadata; the webhook credits the passes once they create an account with it.
export const carnetIntentPublic = (b: { passes: number; firstName: string; lastName: string; company?: string; email: string; test?: string }) =>
  call<{ clientSecret: string; comped?: boolean }>('carnet', { method: 'POST', auth: false, body: { action: 'intent', ...b } });

// Public perks shopfront — the live Airtable perks (display fields only, no auth).
export interface PublicPerk {
  partner: string;
  offer: string;
  category: string;
  days: string;
  icon: string;
}
export const getPublicPerks = () => call<{ perks: PublicPerk[] }>('perks?public=1', { auth: false });

// Public rewards shopfront — the live Airtable reward catalogue (display fields only,
// no member data). Powers the marketing /rewards "Treats" teaser.
export interface PublicReward {
  id: string;
  partner: string;
  title: string;
  cost: number;
  category: string;
  icon: string;
  hero: boolean;
}
export const getPublicRewards = () => call<{ rewards: PublicReward[] }>('rewards?public=1', { auth: false });

// Push notifications (member).
export const pushSubscribe = (subscription: unknown) =>
  call<{ ok: boolean; configured?: boolean }>('push', { method: 'POST', body: { action: 'subscribe', subscription } });
export const pushUnsubscribe = (endpoint: string) =>
  call<{ ok: boolean }>('push', { method: 'POST', body: { action: 'unsubscribe', endpoint } });
export const pushTest = () => call<{ ok: boolean }>('push', { method: 'POST', body: { action: 'test' } });

// Book a tour (public, free).
export interface TourSlot {
  time: string;
  available: boolean;
}
export const getTourSlots = (date: string) =>
  call<{ date: string; slots: TourSlot[]; closed?: boolean }>(`tour?date=${date}`, { auth: false });
export const bookTour = (b: { date: string; time: string; name: string; email: string; phone?: string; notes?: string }) =>
  call<{ ok: boolean }>('tour', { method: 'POST', auth: false, body: b });

// Check-in
export const getCheckinToday = () => call<CheckinStatus>('checkin?action=today');
export const checkInToday = (length: 'Full' | 'Half') =>
  call<{ ok: boolean; balance: string | null }>('checkin', { method: 'POST', body: { action: 'checkin', length } });
export const reserveDay = (date: string, length: 'Full' | 'Half') =>
  call<{ ok: boolean; requested?: boolean }>('checkin', { method: 'POST', body: { action: 'reserve', date, length } });
export const cancelReservation = (id: string) =>
  call<{ ok: boolean }>('checkin', { method: 'POST', body: { action: 'cancel', id } });

// ---- Admin (staff only; the function also enforces the @thinkdigital.travel gate) ----
export interface AdminMember {
  id: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  days: string | null;
  renewal: string | null;
  /** Per-member numeric allowance override (customFields['allowance-override']); null = none. */
  allowanceOverride: string | null;
  /** Effective monthly day allowance (override-aware); null = unlimited. */
  allowance: number | null;
  /** Admin-managed (non-Stripe): the renewal cron owns renewals, not the Stripe webhook. */
  manualBilling: boolean;
  /** Holds no managed plan tag (needs a plan assigned). */
  unassigned: boolean;
  doorCode: string | null;
  paused: boolean;
  bday: string | null;
  bdayClaimed: string | null;
  points: number;
  carnet: number;
  paymentIssue: boolean;
  vatRequested: string | null;
  company: string | null;
  phone: string | null;
}
export interface AdminReward {
  id: string;
  partner: string;
  title: string;
  cost: number;
  funding: string;
  category: string;
  icon: string;
  pos: string;
  hero: boolean;
  status: string;
  image: string | null;
}
export interface AdminFloat {
  id: string;
  partner: string;
  reward: string;
  balance: number;
  floatTotal: number;
  usesThisMonth: number;
  lastUsed: string | null;
  status: string;
}
export interface AdminBooking {
  id: string;
  space: string | null;
  startMin: number;
  endMin: number;
  kind: string;
  name: string | null;
  email: string | null;
  company?: string | null;
  holdUntil?: string | null;
  checkedIn?: boolean;
  releasable?: boolean;
  recurring?: string | null;
  released?: boolean;
  // Synthetic all-day privatisation rows (no Start/End): admin.mjs emits these per occupied
  // date from the Privatisation marker rows so a privatised room shows as occupied every day.
  allDay?: boolean;
  label?: string | null;
}
export interface AdminSpace {
  id: string;
  name: string;
  type: string;
  bookable: boolean;
}

export const adminGetMembers = () => call<{ members: AdminMember[] }>('admin?action=members');
export const adminGetSpaces = () => call<{ spaces: AdminSpace[] }>('admin?action=spaces');
export const adminGetCalendar = (date: string) => call<{ date: string; bookings: AdminBooking[] }>(`admin?action=calendar&date=${date}`);
export const adminBlock = (b: {
  spaceId: string;
  date: string;
  start: string;
  end: string;
  name?: string;
  notes?: string;
  recurring?: boolean;
  /** Weekly + no end date → one indefinite RULE row (calendar-expanded), not many dated rows. */
  indefinite?: boolean;
}) => call<{ ok: boolean; id?: string; detail?: string }>('admin', { method: 'POST', body: { action: 'block', ...b } });
export const adminExternal = (b: {
  spaceId: string;
  date: string;
  start: string;
  end: string;
  name?: string;
  notes?: string;
  recurring?: boolean;
  indefinite?: boolean;
}) => call<{ ok: boolean; id?: string; detail?: string }>('admin', { method: 'POST', body: { action: 'external', ...b } });
export const adminCompanyBooking = (b: {
  spaceId: string;
  date: string;
  start: string;
  end: string;
  company: string;
  /** Optional. Absent → a firm booking that is never auto-released. */
  holdUntil?: string;
  releasable?: boolean;
  recurring?: boolean;
  /** Weekly + no end date → one indefinite RULE row (calendar-expanded), not many dated rows. */
  indefinite?: boolean;
  notes?: string;
}) => call<{ ok: boolean; id?: string; detail?: string }>('admin', { method: 'POST', body: { action: 'company', ...b } });
export const adminCancel = (id: string) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'cancelBooking', id } });
// Close tours (independent of room blocks). Reopen via adminCancel(id).
export interface TourBlock {
  id: string;
  date: string;
  start: number;
  end: number;
  title: string;
}
export const adminGetTourBlocks = () => call<{ blocks: TourBlock[] }>('admin?action=tourBlocks');
export const adminBlockTours = (b: { date: string; start?: string; end?: string }) =>
  call<{ ok: boolean; id: string }>('admin', { method: 'POST', body: { action: 'blockTours', ...b } });
// Weekend access requests (members request; staff approve/decline).
export interface WeekendRequest {
  id: string;
  date: string;
  name: string;
  email: string;
  length: string;
}
export const adminGetWeekendRequests = () => call<{ requests: WeekendRequest[] }>('admin?action=weekendRequests');
export const adminApproveWeekend = (id: string) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'approveWeekend', id } });
export const adminDeclineWeekend = (id: string) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'declineWeekend', id } });
export const adminAdjustDays = (memberId: string, days: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'adjustDays', memberId, days } });
export const adminGrantPasses = (memberId: string, passes: number) =>
  call<{ ok: boolean; carnet: { remaining: number; total: number; expires: string } }>('admin', {
    method: 'POST',
    body: { action: 'grantPasses', memberId, passes },
  });
export const adminSetDoorCode = (memberId: string, code: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'setDoorCode', memberId, code } });
export const adminCheckinMember = (memberId: string, length: 'Full' | 'Half') =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'checkinMember', memberId, length } });
export const adminClaimBirthday = (memberId: string, claimed: boolean, date?: string) =>
  call<{ ok: boolean; bdayClaimed: string | null }>('admin', { method: 'POST', body: { action: 'claimBirthday', memberId, claimed, date } });
export const adminGetRewards = () => call<{ rewards: AdminReward[] }>('admin?action=rewards');
export const adminSaveReward = (r: Partial<AdminReward> & { id?: string }) =>
  call<{ ok: boolean; id: string }>('admin', { method: 'POST', body: { action: 'saveReward', ...r } });
export const adminDeleteReward = (id: string) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'deleteReward', id } });
export const adminGetPerksAll = () => call<{ perks: PerkItem[] }>('admin?action=perks');
export const adminSavePerk = (p: Partial<PerkItem> & { id?: string }) =>
  call<{ ok: boolean; id: string }>('admin', { method: 'POST', body: { action: 'savePerk', ...p } });
export const adminDeletePerk = (id: string) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'deletePerk', id } });
export const adminGetFloats = () => call<{ floats: AdminFloat[] }>('admin?action=floats');
export interface PayoutPartner {
  partner: string;
  owed: number;
  owedCount: number;
  paid: number;
  paidCount: number;
  lastAt: string | null;
}
export const adminGetPayouts = (month?: string) =>
  call<{ partners: PayoutPartner[] }>(`admin?action=payouts${month ? `&month=${encodeURIComponent(month)}` : ''}`);
export const adminMarkPaid = (partner: string, month?: string) =>
  call<{ ok: boolean; settled: number }>('admin', { method: 'POST', body: { action: 'markPaid', partner, month } });
export const adminTopUpFloat = (id: string, amount: number) =>
  call<{ ok: boolean; balance: number; floatTotal: number }>('admin', { method: 'POST', body: { action: 'topUpFloat', id, amount } });
// Enrol a new partner (creates a prepaid float; balance starts = floatTotal). The
// contact + bank fields are SENSITIVE — they go straight to the private Airtable via the
// server function and are never rendered publicly or logged.
export interface AdminPartnerInput {
  partner: string;
  reward?: string;
  fundingNote?: string;
  floatTotal?: number;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  payeeName?: string;
  sortCode?: string;
  accountNumber?: string;
}
export const adminCreatePartner = (input: AdminPartnerInput) =>
  call<{ ok: boolean; id: string }>('admin', { method: 'POST', body: { action: 'createPartner', ...input } });
export interface AdminCheckin {
  /** Airtable record id — present so the Today pane can undo/remove a check-in. */
  id?: string;
  name: string;
  length: string;
  status?: string;
  /** True for a paid Day Pass guest (Status 'Paid' / Source 'Web') — not a member. */
  dayPass?: boolean;
  email?: string;
  company?: string;
}
export const adminGetToday = (date: string) =>
  call<{ date: string; checkins: AdminCheckin[]; bookings: AdminBooking[] }>(`admin?action=today&date=${date}`);
// Undo/remove a check-in (cancels the row; refunds the day if it cost one and the member isn't unlimited).
export const adminRemoveCheckin = (id: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'removeCheckin', id } });
export interface MemberProfile {
  id: string;
  email: string;
  name: string;
  plan: string | null;
  paused: boolean;
  since: string | null;
  days: string | null;
  renewal: string | null;
  /** Per-member numeric allowance override (customFields['allowance-override']); null = none. */
  allowanceOverride: string | null;
  /** Effective monthly day allowance (override-aware); null = unlimited. */
  allowance: number | null;
  /** Admin-managed (non-Stripe): the renewal cron owns renewals, not the Stripe webhook. */
  manualBilling: boolean;
  /** Holds no managed plan tag. */
  unassigned: boolean;
  company: string | null;
  phone: string | null;
  bday: string | null;
  roomHoursCap: number | null;
  points: number;
  daysIn: number;
  rewardsRedeemed: number;
  pointsRedeemed: number;
  perksUsed: number;
  recentRedemptions: { reward: string; cost: number; at: string | null }[];
  recentLedger: { delta: number; reason: string; at: string | null }[];
}
export const adminGetMemberProfile = (id: string) =>
  call<MemberProfile>(`admin?action=memberProfile&id=${encodeURIComponent(id)}`);
export const adminAdjustPoints = (memberId: string, delta: number, reason: string) =>
  call<{ ok: boolean; balance: number }>('admin', { method: 'POST', body: { action: 'adjustPoints', memberId, delta, reason } });
export const adminRedeemForMember = (memberId: string, rewardId: string) =>
  call<{ ok: boolean; balance: number; reward: string }>('admin', { method: 'POST', body: { action: 'redeemForMember', memberId, rewardId } });
export const adminUpdateMember = (
  memberId: string,
  fields: { firstName?: string; lastName?: string; company?: string; phone?: string; meetingRoomHoursCap?: number | null },
) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'updateMember', memberId, ...fields } });
export const adminAssignPlan = (memberId: string, planId: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'assignPlan', memberId, planId } });
// Manually-managed (non-Stripe) membership: apply any subset of plan / renewal date /
// allowance-override / day balance, and mark the member manualBilling (renewal cron owns them).
// allowance: a number sets the per-member override; '' clears it back to the plan default.
export const adminUpdateMembership = (input: {
  memberId: string;
  planId?: string;
  renewalDate?: string;
  allowance?: number | '';
  days?: number | string;
}) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'updateMembership', ...input } });
// Renew a manually-managed member now: reset days (override-aware, with rollover) + advance the
// renewal date to one month from today.
export const adminRenewNow = (memberId: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'renewNow', memberId } });

// ---- Events ----
export interface QuarterEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  description: string | null;
  category: string | null;
  published?: boolean;
}
export const getUpcomingEvents = () => call<{ events: QuarterEvent[] }>('events?action=upcoming', { auth: false });
export const getPublishedEvents = () => call<{ events: QuarterEvent[] }>('events?action=published', { auth: false });
export const adminGetEvents = () => call<{ events: QuarterEvent[] }>('events?action=all');
export const adminCreateEvent = (e: Partial<QuarterEvent>) =>
  call<{ ok: boolean; id: string }>('events', { method: 'POST', body: { action: 'create', ...e } });
export const adminUpdateEvent = (id: string, e: Partial<QuarterEvent>) =>
  call<{ ok: boolean }>('events', { method: 'POST', body: { action: 'update', id, ...e } });
export const adminDeleteEvent = (id: string) =>
  call<{ ok: boolean }>('events', { method: 'POST', body: { action: 'delete', id } });

// ---- Entrance screen (public, no auth) ----
export interface ScreenSpace {
  id: string;
  name: string;
  type: string;
  capacityLabel: string | null;
  colour: string | null;
  bookable: boolean;
  floor: number | null;
}
export interface ScreenBooking {
  space: string | null;
  startMin: number;
  endMin: number;
  kind: string;
}
export const getTodayScreen = () =>
  call<{ date: string; nowMin: number; spaces: ScreenSpace[]; bookings: ScreenBooking[] }>('bookings?action=today', { auth: false });

// ---- Per-floor room-availability display (/screen?floor=1|2) — public, no auth ----
export interface FloorSpace {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
  capacityLabel: string | null;
  bookable: boolean;
  floor: number | null;
}
export interface FloorBooking {
  id: string;
  space: string | null;
  startMin: number;
  endMin: number;
  kind: string;
  /** Booker/company name for the on-site wall display; null → show "Reserved". */
  name: string | null;
  /** True when an un-checked-in room/pod hold has passed its release time (room free again). */
  released: boolean;
}
export interface FloorPrivatisation {
  space: string | null;
  /** Company/name a workspace is privatised for today; null → generic "Privatised". */
  name: string | null;
}
export interface FloorScreenData {
  date: string;
  nowMin: number;
  weekday: boolean;
  openMin: number;
  closeMin: number;
  slotMin: number;
  spaces: FloorSpace[];
  bookings: FloorBooking[];
  privatisations: FloorPrivatisation[];
}
export const getFloorScreen = (floor: number) =>
  call<FloorScreenData>(`bookings?action=floor&floor=${floor}`, { auth: false });

// ---- Kiosk (per-room iPad) ----
export const getMyPin = () => call<{ pin: string }>('checkin?action=pin');

export interface KioskRoom {
  date: string;
  nowMin: number;
  weekday: boolean;
  openMin: number;
  closeMin: number;
  space: { id: string; name: string; type: string; capacityLabel: string | null; bookable: boolean };
  bookings: {
    id: string;
    startMin: number;
    endMin: number;
    kind: string;
    company: string | null;
    holdUntil: string | null;
    checkedIn: boolean;
    releasable: boolean;
    released: boolean;
  }[];
}
export const kioskRoom = (id: string) => call<KioskRoom>(`kiosk?action=room&id=${encodeURIComponent(id)}`, { auth: false });
export const kioskBook = (b: { spaceId: string; date: string; start: string; end: string; pin: string }) =>
  call<{ ok: boolean; member?: string }>('kiosk', { method: 'POST', body: { action: 'book', ...b }, auth: false });
export const kioskCheckinBooking = (bookingId: string) =>
  call<{ ok: boolean }>('kiosk', { method: 'POST', body: { action: 'checkinBooking', bookingId }, auth: false });

// Privacy-safe member name lookup for the on-screen reserve/check-in picker (>=2 chars,
// capped, returns only { id, name } — never a browsable full list).
export interface MemberMatch {
  id: string;
  name: string;
}
export const kioskMemberSearch = (q: string) =>
  call<{ members: MemberMatch[] }>(`kiosk?action=memberSearch&q=${encodeURIComponent(q)}`, { auth: false });
// On-screen reserve attributed by member lookup (no PIN) — used by the floor-screen panel.
export const kioskBookFor = (b: { spaceId: string; date: string; start: string; end: string; memberId: string }) =>
  call<{ ok: boolean; member?: string }>('kiosk', { method: 'POST', body: { action: 'bookFor', ...b }, auth: false });

// ---- Welcome (post-payment) ----
export const getWelcomeSession = (sessionId: string) =>
  call<{ email: string | null }>(`welcome?session_id=${encodeURIComponent(sessionId)}`, { auth: false });

// ---- Quarter Rewards ----
export interface RewardItem {
  id: string;
  partner: string;
  title: string;
  cost: number;
  category: string;
  icon: string;
  hero: boolean;
  image: string | null;
  pos: string;
  avail: 'ok' | 'soon';
}
export interface Redemption {
  id: string;
  reward: string;
  rewardId: string;
  partner: string;
  cost: number;
  status: string;
  at: string | null;
}
export interface BirthdayState {
  bday: string | null; // 'MM-DD'
  claimed: string | null; // ISO date claimed, or null
}
export const getRewards = () =>
  call<{ points: number; lifetimePoints: number; earnedLately: number; catalogue: RewardItem[]; redemptions: Redemption[]; birthday: BirthdayState }>(
    'rewards',
  );

// ---- Member profile (birthday / company on Memberstack metaData) ----
export const saveProfile = (body: { bday?: string | null; company?: string }) =>
  call<{ ok: boolean; bday: string | null; company: string | null }>('member-profile', { method: 'POST', body });
export const requestVatInvoice = () =>
  call<{ ok: boolean; vatRequested: string | null }>('member-profile', { method: 'POST', body: { vatRequest: true } });
export const adminClearVat = (memberId: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'clearVat', memberId } });

// ---- Day-pass carnet ----
export interface CarnetState {
  remaining: number;
  total: number;
  expires: string | null;
}
export const getCarnet = () => call<{ carnet: CarnetState }>('carnet');
export const useCarnetPass = () =>
  call<{ ok: boolean; carnet: CarnetState; pointsAwarded: number }>('carnet', { method: 'POST', body: { action: 'use' } });

// ---- Guest registration (lobby kiosk; public) ----
export interface GuestHost {
  id: string;
  name: string;
  company: string;
  plan: string;
}
export interface RollGuest {
  id: string;
  name: string;
  company: string | null;
  host: string | null;
  arrivedAt: string | null;
}
export const getHosts = (q: string) => call<{ hosts: GuestHost[] }>(`guests?action=hosts&q=${encodeURIComponent(q)}`, { auth: false });
export const getCompanies = (q = '') =>
  call<{ companies: string[] }>(`guests?action=companies${q ? `&q=${encodeURIComponent(q)}` : ''}`, { auth: false });
export const signInGuest = (b: { name: string; company?: string; hostId?: string; host?: string; reason?: string }) =>
  call<{ ok: boolean; host: string | null }>('guests', { method: 'POST', body: { action: 'signin', ...b }, auth: false });
// Roll-call + sign-out are staff-only (admin token); host lookup + sign-in stay public.
export const getRoll = () => call<{ membersIn: number; headcount: number; guests: RollGuest[] }>('guests?action=roll');
export const signOutGuest = (id: string) => call<{ ok: boolean }>('guests', { method: 'POST', body: { action: 'signout', id } });
export const redeemReward = (rewardId: string) =>
  call<{ ok: boolean; balance: number; reward: RewardItem; token: string }>('rewards', {
    method: 'POST',
    body: { action: 'redeem', rewardId },
  });

// ---- Member perks ----
export interface PerkItem {
  id: string;
  partner: string;
  offer: string;
  category: string;
  type: string;
  days: string;
  pos: string;
  authorisedBy: string;
  ref: string;
  contact: string;
  icon: string;
  image: string | null;
  status: string;
}
export const getMemberPerks = () => call<{ perks: PerkItem[] }>('perks');
export const usePerk = (perkId: string) =>
  call<{ ok: boolean; token: string; perk: PerkItem }>('perks', { method: 'POST', body: { action: 'use', perkId } });

// ---- Verification (/v/[token]) — public, no auth ----
export interface VerifyMember {
  name: string;
  planName: string | null;
  since: number | null;
  active: boolean;
}
export interface VerifyResult {
  ok: boolean;
  state: 'valid' | 'inactive' | 'expired' | 'lapsed' | 'rotating' | 'unknown';
  kind: 'perk' | 'reward' | 'wallet';
  member?: VerifyMember;
  perk?: PerkItem;
  reward?: RewardItem;
  partner?: string;
  wallet?: boolean;
}
export const verifyToken = (token: string) =>
  call<VerifyResult>(`verify?token=${encodeURIComponent(token)}`, { auth: false });

// ---- Partner self-service balance (public, no auth — token in the URL) ----
export interface PartnerRedemption {
  reward: string;
  /** £ value = points cost ÷ 100. */
  value: number;
  at: string | null;
}
export interface PartnerBalance {
  partner: string;
  balance: number;
  floatTotal: number;
  status: string;
  usesThisMonth: number;
  lastUsed: string | null;
  redemptions: PartnerRedemption[];
}
export const getPartnerBalance = (token: string) =>
  call<PartnerBalance>(`partner?token=${encodeURIComponent(token)}`, { auth: false });

// ---- Refer a friend ----
export interface ReferralFriend {
  name: string;
  status: string;
  at: string | null;
}
export const getReferrals = () =>
  call<{ code: string; joined: number; pending: number; friends: ReferralFriend[] }>('referrals');
export const registerReferral = (referrerId: string) =>
  call<{ ok: boolean }>('referrals', { method: 'POST', body: { action: 'register', referrerId } });

// ---- Billing self-service (invoices + card update) ----
export interface Invoice {
  id: string;
  number: string | null;
  created: number | null;
  total: number;
  currency: string;
  status: string;
  pdf: string | null;
  url: string | null;
}
export const getInvoices = () => call<{ invoices: Invoice[] }>('invoices');
export const createSetupIntent = () => call<{ clientSecret: string }>('invoices', { method: 'POST', body: { action: 'setup-intent' } });
export const setDefaultCard = (paymentMethodId: string) =>
  call<{ ok: boolean }>('invoices', { method: 'POST', body: { action: 'set-default', paymentMethodId } });

// ---- Native plan change (switch / pause / resume via Stripe) ----
export const switchPlan = (priceId: string) =>
  call<{ ok: boolean }>('plan-change', { method: 'POST', body: { action: 'switch', priceId } });
export const pausePlan = () => call<{ ok: boolean; paused: boolean }>('plan-change', { method: 'POST', body: { action: 'pause' } });
export const resumePlan = () => call<{ ok: boolean; paused: boolean }>('plan-change', { method: 'POST', body: { action: 'resume' } });
