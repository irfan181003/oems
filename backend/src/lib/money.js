'use strict';
// Money is handled in integer paise internally (BR-16 reproducibility, NFR-12);
// it is converted to rupees with 2 decimals only when stored or returned. Currency: INR (DD A5).

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Rupees (number or numeric string, max 2 decimals, >= 0) -> integer paise. */
function toPaise(value) {
  const s = typeof value === 'number' ? String(value) : String(value ?? '').trim();
  if (!MONEY.test(s)) throw new RangeError(`Invalid money amount: ${value}`);
  const [whole, frac = ''] = s.split('.');
  const paise = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(paise)) throw new RangeError(`Money amount too large: ${value}`);
  return paise;
}

/** Integer paise -> rupees as a number with at most 2 decimals. */
function fromPaise(paise) {
  if (!Number.isInteger(paise)) throw new TypeError(`Paise must be an integer: ${paise}`);
  return paise / 100;
}

/** True when the value is a valid non-negative amount with at most 2 decimals. */
function isMoney(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  return MONEY.test(typeof value === 'number' ? String(value) : String(value ?? '').trim());
}

module.exports = { toPaise, fromPaise, isMoney };
