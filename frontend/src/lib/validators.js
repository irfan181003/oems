// Client-side hints mirroring BACKEND_PROMPT §8 and Data Dictionary §7. The backend remains the real check;
// these only give early feedback. Each validator returns '' when valid, otherwise a message.

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

export const required = (label) => (v) => (blank(v) ? `${label} is required` : '');

/** "Not blank" means not empty after trimming (§8). */
export const notBlank = (label, max) => (v) => {
  if (blank(v)) return `${label} must not be blank`;
  if (max && String(v).trim().length > max) return `${label} must be at most ${max} characters`;
  return '';
};

export const maxLen = (label, max) => (v) => (!blank(v) && String(v).length > max ? `${label} must be at most ${max} characters` : '');

export const employeeName = (v) =>
  notBlank('Employee Name', 100)(v) || (/^[A-Za-z ]+$/.test(String(v).trim()) ? '' : 'Letters and spaces only');

export const contactNumber = (v) => (/^[6-9]\d{9}$/.test(String(v || '').trim()) ? '' : '10 digits, starts with 6–9');

export const email = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()) && String(v).trim().length <= 100 ? '' : 'Enter a valid e-mail address';

export const bankAccount = (v) => (/^\d{9,18}$/.test(String(v || '').trim()) ? '' : '9 to 18 digits');

export const digitsOnly = (label, max) => (v) =>
  blank(v) ? '' : /^\d+$/.test(String(v).trim()) && String(v).trim().length <= max ? '' : `${label}: digits only, at most ${max}`;

export const isoDate = (label) => (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return `${label} is required`;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? '' : `${label} is not a valid date`;
};

/** Amount in rupees, at most 2 decimals; positive => > 0, otherwise >= 0 (BR-28). */
export const money = (label, { positive = false } = {}) => (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return `${label} is required`;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return `${label}: zero or more, at most 2 decimals`;
  if (Number(s) > 99999999.99) return `${label} is too large`;
  if (positive && Number(s) <= 0) return `${label} must be greater than zero`;
  return '';
};

export const positiveInt = (label, min = 1, max = Infinity) => (v) => {
  const s = String(v ?? '').trim();
  if (!/^\d+$/.test(s)) return `${label} must be a whole number`;
  const n = Number(s);
  if (n < min) return `${label} must be at least ${min}`;
  if (n > max) return `${label} must be at most ${max}`;
  return '';
};

export const payPeriod = (v) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || '')) ? '' : 'Pay Period must be a month (YYYY-MM)');

/** DE-014 / DE-015: From Date not after To Date. */
export const fromNotAfterTo = (from, to) => (from && to && from > to ? 'From Date must not be after To Date' : '');

/** Run a rules object { field: [validator, ...] } over values; returns { field: message } for failures. */
export function validate(values, rules) {
  const errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of [].concat(checks)) {
      const msg = check(values[field], values);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return errors;
}
