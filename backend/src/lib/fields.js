'use strict';
// Shared zod field rules - Data Dictionary section 7 (DE-xxx) and BACKEND_PROMPT section 8.
// "Not blank" means not empty after trimming.
const { z } = require('zod');
const dates = require('./dates');
const money = require('./money');
const { idPattern } = require('./ids');
const { DEPARTMENTS, isDepartment } = require('./departments');

/** A string field with friendly "required" / "must be text" messages. */
function text(label) {
  return z.string({
    error: (iss) => (iss.input === undefined || iss.input === null ? `${label} is required` : `${label} must be text`),
  });
}

/** Not blank after trimming, max length. */
const notBlank = (label, max) =>
  text(label).trim().min(1, `${label} must not be blank`).max(max, `${label} must be at most ${max} characters`);

const isoDate = (label) =>
  text(label).refine(dates.isValidIsoDate, `${label} must be a valid date in YYYY-MM-DD format`);

const id = (kind, label) => text(label).trim().regex(idPattern(kind), `${label} has an invalid format`);

const enumOf = (label, values) =>
  z.enum(values, {
    error: (iss) => (iss.input === undefined ? `${label} is required` : `${label} must be one of: ${values.join(', ')}`),
  });

/** Time of day HH:MM (or HH:MM:SS), normalised to HH:MM. */
const timeOfDay = (label) =>
  text(label)
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, `${label} must be a valid time in HH:MM format`)
    .transform((t) => t.slice(0, 5));

const MAX_DECIMAL_10_2_PAISE = 9_999_999_999; // DECIMAL(10,2) -> 99,999,999.99

/** Money in rupees (number or numeric string, <= 2 decimals). Returns a number with 2-decimal precision. */
function amount(label, { positive = false } = {}) {
  return z
    .union([z.number(), z.string()], { error: () => `${label} is required` })
    .refine((v) => money.isMoney(v), `${label} must be a non-negative amount with at most 2 decimals`)
    .refine((v) => !money.isMoney(v) || money.toPaise(v) <= MAX_DECIMAL_10_2_PAISE, `${label} is too large`)
    .refine((v) => !positive || !money.isMoney(v) || money.toPaise(v) > 0, `${label} must be greater than zero`)
    .transform((v) => money.fromPaise(money.toPaise(v)));
}

// --- EMPLOYEE fields (DE-028 ... DE-039, section 8 T-D1-01)
const employeeName = notBlank('Employee name', 100).regex(/^[A-Za-z ]+$/, 'Employee name may contain letters and spaces only');
const gender = enumOf('Gender', ['M', 'F', 'O']);
const contactNumber = text('Contact number').trim().regex(/^[6-9]\d{9}$/, 'Contact number must be 10 digits starting with 6-9');
const email = text('E-mail').trim().max(100, 'E-mail must be at most 100 characters').email('E-mail must be a valid e-mail address');
const address = notBlank('Address', 200);
const department = text('Department').trim().refine(isDepartment, `Department must be one of: ${DEPARTMENTS.join(', ')}`);
const designation = notBlank('Designation', 50);
const bankAccount = text('Bank account').trim().regex(/^\d{9,18}$/, 'Bank account must be 9 to 18 digits');
const employmentStatus = enumOf('Employment status', ['Active', 'Resigned', 'Retired']);

module.exports = {
  z,
  text,
  notBlank,
  isoDate,
  timeOfDay,
  id,
  enumOf,
  amount,
  employeeName,
  gender,
  contactNumber,
  email,
  address,
  department,
  designation,
  bankAccount,
  employmentStatus,
};
