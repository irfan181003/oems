// Display helpers (FRONTEND_PROMPT §3, §5): money via inr(), dates via date(). Currency INR, en-IN grouping.
const inrFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const DASH = '—';

/** 123456 -> "₹ 1,23,456.00" */
export function inr(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return DASH;
  return `₹ ${inrFmt.format(Number(n))}`;
}

function utc(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

/** "2026-11-17" -> "17 Nov 2026" */
export function date(iso) {
  const d = utc(iso);
  return d ? dateFmt.format(d) : DASH;
}

/** "2026-11-17 14:05:09" -> "17 Nov 2026, 14:05" (server time, APP_TIMEZONE) */
export function dateTime(ts) {
  if (!ts) return DASH;
  const [d, t = ''] = String(ts).split(' ');
  return t ? `${date(d)}, ${t.slice(0, 5)}` : date(d);
}

/** "2026-10" -> "Oct 2026" */
export function period(p) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(p || ''));
  return m ? monthFmt.format(new Date(Date.UTC(+m[1], +m[2] - 1, 1))) : DASH;
}

/** "09:05" / "09:05:00" -> "09:05" */
export function time(t) {
  return t ? String(t).slice(0, 5) : DASH;
}

/** Plain value or a dash. */
export const orDash = (v) => (v === null || v === undefined || v === '' ? DASH : v);
