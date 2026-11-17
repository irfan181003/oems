// "Today" always comes from the server clock in APP_TIMEZONE (DE-003), via GET /api/health -> server_time,
// never from the browser clock. Cached for a minute.
import { health } from '../api/endpoints';

let cache = null; // { at, value }

/** @returns {Promise<{today: string, time: string, period: string}>} e.g. {today:'2026-11-17', time:'14:05', period:'2026-11'} */
export async function serverNow() {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const res = await health();
  const [today, t] = String(res.data.server_time).split(' ');
  const value = { today, time: (t || '').slice(0, 5), period: today.slice(0, 7) };
  cache = { at: Date.now(), value };
  return value;
}

function utc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const iso = (d) => d.toISOString().slice(0, 10);

export const addDays = (isoDate, n) => iso(new Date(utc(isoDate).getTime() + n * 86400000));

/** Add whole years (29 Feb -> 28 Feb in non-leap years); same rule as the backend's 18-years-at-joining check. */
export function addYears(isoDate, years) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const ty = y + years;
  const last = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Inclusive day count, e.g. Number of Leave Days = end - start + 1 (DE-022). */
export const daysInclusive = (start, end) => Math.round((utc(end) - utc(start)) / 86400000) + 1;

/** First and last day of the month of a date or YYYY-MM period. */
export function monthBounds(dateOrPeriod) {
  const [y, m] = dateOrPeriod.slice(0, 7).split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const p = `${y}-${String(m).padStart(2, '0')}`;
  return { from: `${p}-01`, to: `${p}-${String(last).padStart(2, '0')}` };
}

export const daysInMonth = (period) => Number(monthBounds(period).to.slice(8));

/** Previous YYYY-MM period. */
export function prevPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
