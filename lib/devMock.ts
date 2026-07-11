/**
 * LOCAL PREVIEW ONLY.
 *
 * Lets the member/admin app render under `next dev` without the Netlify Functions
 * or a live Memberstack session, so we can iterate on design locally instead of
 * deploying to Netlify. Every branch here is gated on NODE_ENV — in the production
 * static export `PREVIEW` is `false`, so none of this runs (and the guards make it
 * dead code). Never rely on this for anything real.
 */
import type { Member } from './memberstack';

// True only when viewed on a local dev host — false during SSR and in the
// deployed app (real domain), so this never activates in production.
export const PREVIEW =
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

// Must match the dev-only seed added to PLAN_ID_TO_SLUG in memberstack.ts.
export const PREVIEW_RESIDENT_PLAN_ID = 'pln_preview_resident';

// An admin member, so both the member dashboard and /admin preview locally.
export const previewMember: Member = {
  id: 'mem_preview0001',
  auth: { email: 'nick.hall@thinkdigital.travel' },
  planConnections: [{ planId: PREVIEW_RESIDENT_PLAN_ID, active: true }],
  customFields: { 'days-remaining': '10', 'door-code': '1324#', 'renewal-date': '25/07/2026' },
  metaData: { name: 'Nick Hall', bday: '05-14', company: 'Digital Tourism Think Tank' },
};

const isoToday = () => new Date().toISOString().slice(0, 10);
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

type Result = { ok: boolean; status: number; data: Record<string, unknown> };

/** Canned responses for the member endpoints; null falls through to a real fetch. */
export function previewCall(path: string, method: string): Result | null {
  const ok = (data: Record<string, unknown>): Result => ({ ok: true, status: 200, data });
  const t = isoToday();
  if (path.startsWith('checkin?action=today'))
    return ok({
      date: t,
      checkedIn: false,
      length: null,
      balance: '10',
      planned: [
        { id: 'p1', date: addDays(t, 3), length: 'Full' },
        { id: 'p2', date: addDays(t, 4), length: 'Half' },
      ],
    });
  if (path.startsWith('bookings?action=spaces'))
    return ok({
      spaces: [
        { id: 's1', name: 'The Board Room', type: 'Meeting room', capacity: 10, capacityLabel: '8–10', bookable: true, colour: null },
        { id: 's2', name: 'The Hop Yard', type: 'Meeting room', capacity: 8, capacityLabel: '6–8', bookable: true, colour: null },
        { id: 's3', name: 'The Bell Tower', type: 'Phone pod', capacity: 1, capacityLabel: '1', bookable: true, colour: null },
      ],
    });
  if (path.startsWith('bookings?action=mine'))
    return ok({ bookings: [{ id: 'b1', date: addDays(t, 2), startMin: 540, endMin: 600, space: 's2', title: 'The Hop Yard' }] });
  if (path.startsWith('bookings?action=availability'))
    return ok({ openMin: 480, closeMin: 1080, slotMin: 30, busy: [{ startMin: 600, endMin: 720 }] });
  if (path.startsWith('bookings?action=today')) return ok({ date: t, nowMin: 600, spaces: [], bookings: [] });
  if (path.startsWith('events?action='))
    return ok({
      events: [
        { id: 'e1', title: 'Summer Friday social', start: `${addDays(t, 4)}T17:00:00.000Z`, end: `${addDays(t, 4)}T19:00:00.000Z`, location: 'The Kentish Pantry', published: true },
        { id: 'e2', title: 'Founders’ breakfast briefing', start: `${addDays(t, 9)}T08:30:00.000Z`, end: null, location: 'The Kentish Pantry', published: true },
      ],
    });
  if (method === 'POST') return ok({ ok: true, balance: '10' }); // check-in / reserve / cancel / book all succeed
  return null;
}
