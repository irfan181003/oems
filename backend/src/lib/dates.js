'use strict';
// All "today / now" values come from the server clock in APP_TIMEZONE (DE-003);
// they are never accepted from the client. Dates are ISO YYYY-MM-DD (DD assumption A5).
const config = require('../config');

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parts(date = new Date()) {
  const o = {};
  for (const p of formatter.formatToParts(date)) o[p.type] = p.value;
  return o;
}

/** Today's date in APP_TIMEZONE, YYYY-MM-DD. */
function today(date = new Date()) {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Current time in APP_TIMEZONE, HH:MM:SS. */
function nowTime(date = new Date()) {
  const p = parts(date);
  return `${p.hour}:${p.minute}:${p.second}`;
}

/** Current timestamp in APP_TIMEZONE, 'YYYY-MM-DD HH:MM:SS'. */
function nowTs(date = new Date()) {
  return `${today(date)} ${nowTime(date)}`;
}

/** Current pay period in APP_TIMEZONE, YYYY-MM. */
function currentPeriod(date = new Date()) {
  return today(date).slice(0, 7);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form. */
function isValidIsoDate(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtcMs(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Inclusive number of days from start to end (both YYYY-MM-DD). */
function daysInclusive(start, end) {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / 86400000) + 1;
}

/** Add whole years to a YYYY-MM-DD date (29 Feb -> 28 Feb in non-leap years). */
function addYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number);
  const ty = y + years;
  const last = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Add (or subtract) whole days to a YYYY-MM-DD date. */
function addDays(iso, days) {
  return new Date(toUtcMs(iso) + days * 86400000).toISOString().slice(0, 10);
}

/** Number of days in a YYYY-MM pay period. */
function daysInMonth(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** First and last date of a YYYY-MM pay period. */
function periodBounds(period) {
  return { start: `${period}-01`, end: `${period}-${String(daysInMonth(period)).padStart(2, '0')}` };
}

module.exports = {
  today,
  nowTime,
  nowTs,
  currentPeriod,
  isValidIsoDate,
  daysInclusive,
  addYears,
  addDays,
  daysInMonth,
  periodBounds,
};
