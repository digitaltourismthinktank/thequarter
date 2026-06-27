/**
 * The Quarter — client API for the booking + check-in Netlify Functions.
 * Attaches the member's Memberstack JWT for authenticated calls. Client-only.
 */
import { getMemberToken } from './memberstack';

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
}
export interface CheckinStatus {
  date: string;
  checkedIn: boolean;
  length: 'Full' | 'Half' | null;
  balance: string | null;
  planned: { id: string; date: string; length: 'Full' | 'Half' }[];
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

// Check-in
export const getCheckinToday = () => call<CheckinStatus>('checkin?action=today');
export const checkInToday = (length: 'Full' | 'Half') =>
  call<{ ok: boolean; balance: string | null }>('checkin', { method: 'POST', body: { action: 'checkin', length } });
export const reserveDay = (date: string, length: 'Full' | 'Half') =>
  call<{ ok: boolean }>('checkin', { method: 'POST', body: { action: 'reserve', date, length } });
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
  doorCode: string | null;
  paused: boolean;
  bday: string | null;
  bdayClaimed: string | null;
  points: number;
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
export const adminBlock = (b: { spaceId: string; date: string; start: string; end: string; name?: string; notes?: string }) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'block', ...b } });
export const adminExternal = (b: { spaceId: string; date: string; start: string; end: string; name?: string; notes?: string }) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'external', ...b } });
export const adminCompanyBooking = (b: {
  spaceId: string;
  date: string;
  start: string;
  end: string;
  company: string;
  holdUntil?: string;
  releasable?: boolean;
  recurring?: string;
  notes?: string;
}) => call<{ ok: boolean; id: string }>('admin', { method: 'POST', body: { action: 'company', ...b } });
export const adminCancel = (id: string) => call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'cancelBooking', id } });
export const adminAdjustDays = (memberId: string, days: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'adjustDays', memberId, days } });
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
export const adminTopUpFloat = (id: string, amount: number) =>
  call<{ ok: boolean; balance: number; floatTotal: number }>('admin', { method: 'POST', body: { action: 'topUpFloat', id, amount } });
export interface AdminCheckin {
  name: string;
  length: string;
}
export const adminGetToday = (date: string) =>
  call<{ date: string; checkins: AdminCheckin[]; bookings: AdminBooking[] }>(`admin?action=today&date=${date}`);
export interface MemberProfile {
  id: string;
  email: string;
  name: string;
  plan: string | null;
  paused: boolean;
  since: string | null;
  days: string | null;
  company: string | null;
  phone: string | null;
  bday: string | null;
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
export const adminAssignPlan = (memberId: string, planId: string) =>
  call<{ ok: boolean }>('admin', { method: 'POST', body: { action: 'assignPlan', memberId, planId } });

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
}
export interface ScreenBooking {
  space: string | null;
  startMin: number;
  endMin: number;
  kind: string;
}
export const getTodayScreen = () =>
  call<{ date: string; nowMin: number; spaces: ScreenSpace[]; bookings: ScreenBooking[] }>('bookings?action=today', { auth: false });

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
  call<{ points: number; earnedLately: number; catalogue: RewardItem[]; redemptions: Redemption[]; birthday: BirthdayState }>(
    'rewards',
  );

// ---- Member profile (birthday / company on Memberstack metaData) ----
export const saveProfile = (body: { bday?: string | null; company?: string }) =>
  call<{ ok: boolean; bday: string | null; company: string | null }>('member-profile', { method: 'POST', body });

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
