/**
 * The Quarter — Canterbury transport for the lobby display (public, read-only).
 *
 * GET → { configured, trainsLive, trains: { west, east }, buses, busInfo }
 *   • buses  — next departures from Canterbury Bus Station, from a static timetable baked out of
 *              the BODS South East open-data feed (see _bus-timetable.mjs). No external call, no
 *              API quota — the timetable ships with the function and each row carries its own
 *              weekday + valid-date window, so the board rolls onto new (e.g. September) timetables
 *              automatically as dates pass, within the data's coverage.
 *   • trains — Canterbury West / East live departures via National Rail (Darwin). These switch on
 *              the moment NATIONAL_RAIL_TOKEN is set (the token is pending manual approval); until
 *              then trainsLive is false and the screen shows a gentle "switching on soon".
 *
 * Fails soft everywhere: a bad feed returns empty lists rather than erroring the screen.
 */

import { londonNow } from './_time.mjs';
import { DEPARTURES, DESTS, GENERATED, COVERAGE } from './_bus-timetable.mjs';

const WINDOW_MIN = 60; // only show departures within the next hour
const MAX_TRAINS = 7; // a full hour is ~7 departures per station (10-min walk, so show plenty)

// National Rail Darwin via the Rail Data Marketplace "Live Departure Board" (LDBWS) REST product.
// Key-only: the consumer key goes in an `x-apikey` header — no OAuth, no secret. `RAIL_DATA_KEY`
// is that consumer key (set in Netlify). The board switches on the moment that var is present.
//
// The exact base path differs by product version (e.g. `...-dep` vs `...-dep1_2`) and is shown on
// the product's Specification/API tab in RDM. So it's overridable via `RAIL_DATA_URL` — set that to
// the example request URL from RDM and we normalise it — meaning a path correction needs NO code
// redeploy. If unset we fall back to the current best-known "Live Departure Board" base.
const RAIL_KEY = process.env.RAIL_DATA_KEY;
const LDBWS_DEFAULT = 'https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120';
// Accept either a bare base (…/20220120) or a full sample URL (…/GetDepartureBoard/XXX); trim to base.
const LDBWS_BASE = (process.env.RAIL_DATA_URL || LDBWS_DEFAULT)
  .replace(/\/GetDep(artureBoard|BoardWithDetails)\b.*$/i, '')
  .replace(/\/+$/, '');

// Everything is either static (buses) or cheaply cached, so a short CDN cache keeps the board
// fresh without hammering anything. The client also polls every few minutes.
const CDN_CACHE = 'public, max-age=60, s-maxage=60';
const json = (b, s = 200, cache = false) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...(cache ? { 'cache-control': CDN_CACHE } : {}) } });

const pad = (n) => String(n).padStart(2, '0');

/** London-now as { min (from midnight), monBit (0=Mon..6=Sun), todayInt (YYYYMMDD) }. */
function todayFields() {
  const { dateStr, min } = londonNow();
  const [Y, M, D] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay(); // 0=Sun..6=Sat
  return { min, monBit: (dow + 6) % 7, todayInt: Y * 10000 + M * 100 + D };
}

/** Next bus-station departures in the coming hour, from the baked timetable. */
function busDepartures() {
  const { min, monBit, todayInt } = todayFields();
  const bit = 1 << monBit;
  const seen = new Set();
  const out = [];
  for (const row of DEPARTURES) {
    const [t, line, di, mask, from, to] = row;
    if (!(mask & bit)) continue; // not running today
    if (todayInt < from || todayInt > to) continue; // outside this timetable's window
    const wait = t - min; // t may be ≥1440 for after-midnight departures — arithmetic still holds
    if (wait < -1 || wait > WINDOW_MIN) continue;
    const disp = t % 1440;
    const time = `${pad(Math.floor(disp / 60))}:${pad(disp % 60)}`;
    const dest = DESTS[di] || '';
    const k = `${line}|${time}|${dest}`;
    if (seen.has(k)) continue; // collapse duplicate (overlapping) service rows
    seen.add(k);
    out.push({ time, line, to: dest, mins: wait });
  }
  out.sort((a, b) => a.mins - b.mins);
  return out.slice(0, 8).map(({ mins, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

/**
 * Normalise Darwin's `etd` (estimated time of departure) into a compact status the board renders:
 *   { state: 'on-time' | 'late' | 'delayed' | 'cancelled', expected?: 'HH:MM' }
 * `etd` is one of "On time", "Cancelled", "Delayed", or an actual time like "14:35" (running late).
 */
function departureStatus(etd) {
  const v = String(etd || '').trim();
  if (/^cancelled$/i.test(v)) return { state: 'cancelled' };
  if (/^delayed$/i.test(v)) return { state: 'delayed' };
  if (/^on time$/i.test(v) || v === '') return { state: 'on-time' };
  if (/^\d{1,2}:\d{2}$/.test(v)) return { state: 'late', expected: v }; // a real re-timed departure
  return { state: 'on-time' };
}

/**
 * Canterbury West (CBW) / East (CBE) live departures via the RDM LDBWS Public REST API.
 * Returns [] until RAIL_DATA_KEY is set. Always fails soft — a bad feed empties the column
 * rather than erroring the whole board.
 */
async function trainDepartures(crs) {
  if (!RAIL_KEY) return [];
  try {
    const url = `${LDBWS_BASE}/GetDepartureBoard/${crs}?numRows=12`;
    const res = await fetch(url, { headers: { 'x-apikey': RAIL_KEY, accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const services = Array.isArray(data?.trainServices) ? data.trainServices : [];
    return services
      .map((s) => {
        // Destination shape varies across the LDBWS JSON wrappers — an array, or { location: [...] }.
        // Handle both. A splitting service lists more than one destination, so join their names.
        const dnode = s?.destination;
        const dests = Array.isArray(dnode) ? dnode : Array.isArray(dnode?.location) ? dnode.location : [];
        const to = dests.map((d) => d?.locationName).filter(Boolean).join(' & ');
        return {
          time: String(s?.std || '').trim(), // scheduled departure "HH:MM"
          to,
          platform: s?.platform ? String(s.platform) : null,
          operator: s?.operator || '',
          ...departureStatus(s?.etd),
        };
      })
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t.time) && t.to)
      .slice(0, MAX_TRAINS);
  } catch {
    return [];
  }
}

export default async function handler() {
  try {
    const buses = busDepartures();
    const [west, east] = await Promise.all([trainDepartures('CBW'), trainDepartures('CBE')]);
    const data = {
      configured: true,
      trainsLive: !!RAIL_KEY,
      trains: { west, east },
      buses,
      busInfo: { generated: GENERATED, coverage: COVERAGE },
    };
    return json(data, 200, true);
  } catch {
    return json({ configured: true, trainsLive: false, trains: { west: [], east: [] }, buses: [] });
  }
}
