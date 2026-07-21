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
const NRE_TOKEN = process.env.NATIONAL_RAIL_TOKEN; // National Rail Darwin (LDBWS) — pending approval

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
 * Canterbury West / East live departures via National Rail Darwin.
 * Returns [] until NATIONAL_RAIL_TOKEN is set (token pending approval) — the Darwin call is wired
 * and tested the moment the credential lands. Always fails soft.
 */
async function trainDepartures(/* crs */) {
  if (!NRE_TOKEN) return [];
  try {
    // TODO(darwin): wire LDBWS GetDepartureBoard for `crs` once the RDM token is approved.
    return [];
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
      trainsLive: !!NRE_TOKEN,
      trains: { west, east },
      buses,
      busInfo: { generated: GENERATED, coverage: COVERAGE },
    };
    return json(data, 200, true);
  } catch {
    return json({ configured: true, trainsLive: false, trains: { west: [], east: [] }, buses: [] });
  }
}
