/**
 * The Quarter — closed-day logic (CODE_BRIEF §6). Callers already block weekends via
 * isWeekday(); this adds England & Wales bank holidays (gov.uk feed, cached per warm
 * instance, refreshed daily) + the Christmas/New Year shutdown. A member must not be
 * able to plan a visit, and a display must not show "open", on a closed day.
 */
let cache = { day: null, set: new Set() };

async function holidaySet() {
  const today = new Date().toISOString().slice(0, 10);
  if (cache.day === today && cache.set.size) return cache.set;
  try {
    const r = await fetch('https://www.gov.uk/bank-holidays.json');
    const j = await r.json();
    const days = (j['england-and-wales']?.events || []).map((e) => e.date);
    cache = { day: today, set: new Set(days) };
  } catch {
    /* feed unavailable — keep whatever we had (weekend handling still applies) */
  }
  return cache.set;
}

/** True if YYYY-MM-DD is a bank holiday or within the Christmas/New Year shutdown. */
export async function isClosedDay(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [, mm, dd] = dateStr.split('-').map(Number);
  if (mm === 12 && dd >= 24) return true; // 24–31 Dec
  if (mm === 1 && dd === 1) return true; // New Year's Day
  const set = await holidaySet();
  return set.has(dateStr);
}
