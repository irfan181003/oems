'use strict';
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');
// Values already present in process.env (e.g. set by tests) are not overridden.
require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') });

const ROLES = Object.freeze({
  EMPLOYEE: 'Employee',
  HR_MANAGER: 'HR Manager',
  RECRUITMENT_OFFICER: 'Recruitment Officer',
  PAYROLL_OFFICER: 'Payroll Officer',
  FINANCE_MANAGER: 'Finance Manager',
});
const ALL_ROLES = Object.freeze(Object.values(ROLES));

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

function resolveDbFile(value) {
  if (value === ':memory:') return value;
  return path.resolve(BACKEND_DIR, value);
}

// ASSUMPTION A-7: which roles may use the Employee self-service use cases
const selfServiceRoles = (process.env.SELF_SERVICE_ROLES || ROLES.EMPLOYEE)
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
for (const r of selfServiceRoles) {
  if (!ALL_ROLES.includes(r)) throw new Error(`SELF_SERVICE_ROLES contains unknown role "${r}"`);
}

const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  port: intEnv('PORT', 4000),
  dbFile: resolveDbFile(process.env.DB_FILE || './data/oems.db'),
  sessionIdleMinutes: intEnv('SESSION_IDLE_MINUTES', 15),
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  selfServiceRoles: Object.freeze(selfServiceRoles),
  seedPassword: process.env.SEED_PASSWORD || '',
  loginRateLimitMax: intEnv('LOGIN_RATE_LIMIT_MAX', 10),
  bcryptRounds: 10, // NFR-22: cost >= 10
  ROLES,
  ALL_ROLES,
});

module.exports = config;
