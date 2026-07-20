/**
 * LOCAL PREVIEW ONLY.
 *
 * Lets the member/admin app render under `next dev` without the Netlify Functions
 * or a live Memberstack session, so we can iterate on design locally instead of
 * deploying to Netlify. Never rely on this for anything real.
 *
 * SECURITY — why the NODE_ENV check below is load-bearing, not belt-and-braces.
 * This file used to gate only on window.location.hostname. That is a RUNTIME check, so
 * webpack could not fold it at build time and could not eliminate anything: the whole
 * module, including the sample member, was bundled into app/layout — i.e. served on every
 * page of the public marketing site — and was readable by anyone who opened dev tools.
 * A real door code and a real email address were sitting in it.
 *
 * `process.env.NODE_ENV` IS replaced with a literal at build time, so `PREVIEW` folds to
 * `false` in a production build and the mock data becomes genuinely dead code. The sample
 * values below are also obviously-fake now, so that even a future bundling change leaks
 * nothing worth having.
 */
import type { Member } from './memberstack';

// NODE_ENV first, and deliberately so: it is a build-time constant, which is what lets the
// bundler drop everything below it from the production build. The hostname check then keeps
// it off any non-local host during development.
export const PREVIEW =
  process.env.NODE_ENV !== 'production' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

// Must match the dev-only seed added to PLAN_ID_TO_SLUG in memberstack.ts.
export const PREVIEW_RESIDENT_PLAN_ID = 'pln_preview_resident';

// An admin member, so both the member dashboard and /admin preview locally.
export const previewMember: Member = {
  id: 'mem_preview0001',
  auth: { email: 'preview@example.com' },
  planConnections: [{ planId: PREVIEW_RESIDENT_PLAN_ID, active: true }],
  // Obviously-fake sample values. Never put a real door code here again.
  customFields: { 'days-remaining': '10', 'door-code': '0000#', 'renewal-date': '25/07/2026' },
  metaData: { name: 'Preview Member', bday: '05-14', company: 'Sample Co' },
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
        { id: 's1', name: 'The Knight’s Tale', type: 'Meeting room', capacity: 10, capacityLabel: '8–10', bookable: true, colour: null },
        { id: 's2', name: 'The Chapter House', type: 'Meeting room', capacity: 4, capacityLabel: '4', bookable: true, colour: null },
        { id: 's3', name: 'The Bell Tower', type: 'Phone pod', capacity: 1, capacityLabel: '1', bookable: true, colour: null },
        { id: 's4', name: 'The Scriptorium', type: 'Phone pod', capacity: 1, capacityLabel: '1', bookable: true, colour: null },
      ],
    });
  if (path.startsWith('bookings?action=mine'))
    return ok({ bookings: [{ id: 'b1', date: addDays(t, 2), startMin: 540, endMin: 600, space: 's2', title: 'The Chapter House' }] });
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
  if (path === 'rewards' && method === 'GET')
    return ok({
      points: 720,
      lifetimePoints: 2100,
      earnedLately: 40,
      catalogue: [
        { id: 'treat', partner: 'A.T. Patisserie', title: 'A treat on us', cost: 300, category: 'Bakery & treats', icon: 'cake', hero: false, image: null, pos: '', avail: 'ok' },
        { id: 'coffee', partner: 'Burgate Coffee', title: 'A coffee, our treat', cost: 350, category: 'Coffee & café', icon: 'coffee', hero: false, image: null, pos: '', avail: 'ok' },
        { id: 'corkk-glass', partner: 'Corkk', title: 'A glass at Corkk', cost: 700, category: 'Drinks & wine', icon: 'wine', hero: false, image: null, pos: '', avail: 'ok' },
        { id: 'corkk-evening', partner: 'Corkk', title: 'An evening at Corkk', cost: 2000, category: 'Drinks & wine', icon: 'sparkles', hero: true, image: null, pos: '', avail: 'ok' },
      ],
      redemptions: [],
      birthday: { bday: '05-14', claimed: null },
    });
  if (path === 'carnet' && method === 'GET') return ok({ carnet: { remaining: 6, total: 10, expires: addDays(t, 300) } });
  if (path === 'invoices' && method === 'GET')
    return ok({
      invoices: [
        { id: 'in_3', number: 'QTR-0009', created: Date.parse(`${t}T09:00:00Z`), total: 138, currency: 'GBP', status: 'paid', pdf: '#', url: '#' },
        { id: 'in_2', number: 'QTR-0008', created: Date.parse(`${addDays(t, -30)}T09:00:00Z`), total: 138, currency: 'GBP', status: 'paid', pdf: '#', url: '#' },
        { id: 'in_1', number: 'QTR-0007', created: Date.parse(`${addDays(t, -60)}T09:00:00Z`), total: 21.6, currency: 'GBP', status: 'paid', pdf: '#', url: '#' },
      ],
    });
  if (method === 'POST') return ok({ ok: true, balance: '10' }); // check-in / reserve / cancel / book / plan-change all succeed
  return null;
}
