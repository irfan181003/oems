'use strict';
// Shared test setup. Must be required BEFORE any src/ module so these env values win.
process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.SESSION_IDLE_MINUTES = '15';
process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.SELF_SERVICE_ROLES = 'Employee';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.SEED_PASSWORD = 'Test@12345';

const request = require('supertest');
const { getDb } = require('../src/db');
const { createApp } = require('../src/app');
const { seedUsers } = require('../db/seed');

const PASSWORD = process.env.SEED_PASSWORD;
const USERS = Object.freeze({
  HR: 'EMP00001',
  RECRUITMENT: 'EMP00002',
  PAYROLL: 'EMP00003',
  FINANCE: 'EMP00004',
  EMP: 'EMP00005',
  EMP2: 'EMP00006',
});

let ctx = null;

/** One in-memory DB + app per test process (node --test runs each file in its own process). */
function setup() {
  if (!ctx) {
    const db = getDb();
    seedUsers(db, PASSWORD);
    ctx = { db, app: createApp() };
  }
  return ctx;
}

async function login(app, loginId, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ login: loginId, password });
  if (res.status !== 200) throw new Error(`login failed for ${loginId}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { setup, login, bearer, request, PASSWORD, USERS };
