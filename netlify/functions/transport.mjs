/**
 * The Quarter — live Canterbury transport for the lobby display (public, read-only).
 *
 * GET → { configured, trains: { west, east }, buses } — next departures from Canterbury West
 * and Canterbury East stations and the bus station, via TransportAPI.
 *
 * The API key lives ONLY in env (TRANSPORTAPI_APP_ID / TRANSPORTAPI_APP_KEY) and never reaches
 * the browser — the entrance screen calls THIS function, not TransportAPI directly. Fails soft:
 * if the keys aren't set, or a feed is down, it returns empty lists and the screen simply shows
 * nothing rather than erroring. Cached in-memory for a minute to stay well inside the free tier.
 *
 * Endpoints: the old `/station/{crs}/live.json` and `/bus/stop/{atco}/live.json` now 301 to the
 * `_timetables` forms with `live=true`, so we call those directly.
 */

const APP_ID = process.env.TRANSPORTAPI_APP_ID;
const APP_KEY = process.env.TRANSPORTAPI_APP_KEY;
const BASE = 'https://transportapi.com/v3/uk';

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const auth = () => `app_id=${encodeURIComponent(APP_ID)}&app_key=${encodeURIComponent(APP_KEY)}`;

// Canterbury bus station bays (Traveline ATCO codes). A handful of the main bays, merged.
const BUS_BAYS = ['240098892', '240098894', '240098900', '240098902', '240098898'];

// Warm-instance cache — Netlify functions may cold-start, but while an instance is warm this
// keeps us to roughly one upstream fetch a minute regardless of how many screens are polling.
let cache = { at: 0, data: null };
const CACHE_MS = 60_000;

const hhmm = (t) => (typeof t === 'string' ? t.slice(0, 5) : '');

async function trainDepartures(crs) {
  try {
    const r = await fetch(`${BASE}/train/station_timetables/${crs}.json?${auth()}&live=true&train_status=passenger&limit=4`);
    if (!r.ok) return [];
    const j = await r.json();
    const all = j?.departures?.all || [];
    // The API lists departures grouped, not strictly time-ordered, so sort by clock time before
    // taking the soonest — otherwise "next train" could show a later one first.
    return all
      .map((d) => ({
        time: hhmm(d.expected_departure_time || d.aimed_departure_time),
        to: d.destination_name || '',
        status: d.status || '',
        platform: d.platform || null,
        mins: Number.isFinite(d.best_departure_estimate_mins) ? d.best_departure_estimate_mins : null,
      }))
      .filter((d) => d.time)
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 4);
  } catch {
    return [];
  }
}

async function busDepartures() {
  const out = [];
  for (const code of BUS_BAYS) {
    try {
      const r = await fetch(`${BASE}/bus/stop_timetables/${code}.json?${auth()}&live=true&limit=3`);
      if (!r.ok) continue;
      const j = await r.json();
      const deps = j?.departures || {};
      for (const line of Object.keys(deps)) {
        for (const d of deps[line] || []) {
          out.push({
            time: hhmm(d.best_departure_estimate || d.aimed_departure_time),
            line: d.line_name || d.line || line,
            to: d.direction || '',
          });
        }
      }
    } catch {
      /* skip a bad bay */
    }
  }
  // Merge, drop timeless rows, sort by clock time, de-dupe on line+time, keep the soonest few.
  const seen = new Set();
  return out
    .filter((b) => b.time)
    .sort((a, b) => a.time.localeCompare(b.time))
    .filter((b) => {
      const k = `${b.line}|${b.time}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

export default async function handler() {
  if (!APP_ID || !APP_KEY) return json({ configured: false, trains: { west: [], east: [] }, buses: [] });
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_MS) return json(cache.data);
  try {
    const [west, east, buses] = await Promise.all([trainDepartures('CBW'), trainDepartures('CBE'), busDepartures()]);
    const data = { configured: true, trains: { west, east }, buses };
    cache = { at: now, data };
    return json(data);
  } catch {
    return json({ configured: true, trains: { west: [], east: [] }, buses: [] });
  }
}
