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
