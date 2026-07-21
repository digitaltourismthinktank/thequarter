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

import { londonNow } from './_time.mjs';

const APP_ID = process.env.TRANSPORTAPI_APP_ID;
const APP_KEY = process.env.TRANSPORTAPI_APP_KEY;
const BASE = 'https://transportapi.com/v3/uk';
const WINDOW_MIN = 60; // only show departures within the next hour

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const auth = () => `app_id=${encodeURIComponent(APP_ID)}&app_key=${encodeURIComponent(APP_KEY)}`;

/** Minutes from London-now until a 'HH:MM' today (handles a small after-midnight wrap). */
function minsUntil(hhmmStr) {
  if (!hhmmStr || !/^\d{2}:\d{2}$/.test(hhmmStr)) return null;
  const [h, m] = hhmmStr.split(':').map(Number);
  let diff = h * 60 + m - londonNow().min;
  if (diff < -120) diff += 1440;
  return diff;
}

// Canterbury bus station bays (Traveline ATCO codes). A handful of the main bays, merged.
const BUS_BAYS = ['240098892', '240098894', '240098900', '240098902', '240098898'];

// Warm-instance cache — Netlify functions may cold-start, but while an instance is warm this
// keeps us to roughly one upstream fetch a minute regardless of how many screens are polling.
let cache = { at: 0, data: null };
const CACHE_MS = 60_000;

const hhmm = (t) => (typeof t === 'string' ? t.slice(0, 5) : '');

async function trainDepartures(crs) {
  try {
    const r = await fetch(`${BASE}/train/station_timetables/${crs}.json?${auth()}&live=true&train_status=passenger&limit=15`);
    if (!r.ok) return [];
    const j = await r.json();
    const all = j?.departures?.all || [];
    return all
      .map((d) => {
        const aimed = hhmm(d.aimed_departure_time);
        const expected = hhmm(d.expected_departure_time);
        const st = String(d.status || '').toUpperCase();
        const cancelled = st.includes('CANCEL');
        // "On time" unless the expected time has slipped, or the status says otherwise.
        const onTime = !cancelled && (!expected || expected === aimed || st === 'ON TIME' || st === 'STARTS HERE' || st === 'EARLY');
        const time = aimed || expected;
        const mins = Number.isFinite(d.best_departure_estimate_mins) ? d.best_departure_estimate_mins : minsUntil(expected || aimed);
        return { time, expected: onTime || cancelled ? null : expected, onTime, cancelled, to: d.destination_name || '', mins };
      })
      .filter((d) => d.time && d.mins != null && d.mins >= -2 && d.mins <= WINDOW_MIN)
      .sort((a, b) => a.mins - b.mins)
      .slice(0, 6)
      .map(({ mins, ...rest }) => rest); // eslint-disable-line no-unused-vars
  } catch {
    return [];
  }
}

async function busDepartures() {
  const out = [];
  for (const code of BUS_BAYS) {
    try {
      const r = await fetch(`${BASE}/bus/stop_timetables/${code}.json?${auth()}&live=true&limit=8`);
      if (!r.ok) continue;
      const j = await r.json();
      const deps = j?.departures || {};
      for (const key of Object.keys(deps)) {
        for (const d of deps[key] || []) {
          const time = hhmm(d.best_departure_estimate || d.aimed_departure_time);
          out.push({ time, line: String(d.line_name || d.line || key), to: d.direction || '', mins: minsUntil(time) });
        }
      }
    } catch {
      /* skip a bad bay */
    }
  }
  const seen = new Set();
  return out
    .filter((b) => b.time && b.mins != null && b.mins >= -2 && b.mins <= WINDOW_MIN)
    .sort((a, b) => a.mins - b.mins)
    .filter((b) => {
      const k = `${b.line}|${b.time}|${b.to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6)
    .map(({ mins, ...rest }) => rest); // eslint-disable-line no-unused-vars
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
