'use strict';
// NFR-21 | BR-26 Role-Based Access Control ("Denied and logged"); ASSUMPTION A-5, A-7
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { setup, login, bearer, request, USERS } = require('./helpers');
const { authenticate } = require('../src/middleware/auth');
const { requireRole, requireSelfService } = require('../src/middleware/rbac');
const { errorHandler } = require('../src/middleware/errors');
const { ok } = require('../src/lib/result');

const { db, app } = setup();

// A small app that uses the real middleware, so the gates can be tested before business routes exist.
const probe = express();
const api = express.Router();
api.get('/hr-only', authenticate, requireRole('HR Manager'), (req, res) => ok(res, { data: req.user.employee_id }));
api.get('/hr-or-finance', authenticate, requireRole('HR Manager', 'Finance Manager'), (req, res) => ok(res));
api.get('/self', authenticate, requireSelfService, (req, res) => ok(res, { data: req.user.employee_id }));
probe.use('/api', api);
probe.use(errorHandler);

const deniedCount = () => db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome = 'Denied'").get().n;

describe('BR-26 requireRole', () => {
  test('permitted role passes', async () => {
    const token = await login(app, USERS.HR);
    const res = await request(probe).get('/api/hr-only').set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.data, USERS.HR);
  });

  test('every other role gets 403 and an AUDIT_LOG Denied row', async () => {
    for (const id of [USERS.EMP, USERS.RECRUITMENT, USERS.PAYROLL, USERS.FINANCE]) {
      const token = await login(app, id);
      const before = deniedCount();
      const res = await request(probe).get('/api/hr-only').set(bearer(token));
      assert.equal(res.status, 403);
      assert.equal(res.body.result_status, 'Failed');
      assert.equal(deniedCount(), before + 1);
      const row = db.prepare("SELECT * FROM AUDIT_LOG WHERE outcome = 'Denied' ORDER BY audit_id DESC LIMIT 1").get();
      assert.equal(row.employee_id, id);
      assert.equal(row.entity, 'hr-only');
      assert.equal(row.action, 'GET /api/hr-only');
    }
  });

  test('multiple roles allowed', async () => {
    const fin = await login(app, USERS.FINANCE);
    assert.equal((await request(probe).get('/api/hr-or-finance').set(bearer(fin))).status, 200);
    const pay = await login(app, USERS.PAYROLL);
    assert.equal((await request(probe).get('/api/hr-or-finance').set(bearer(pay))).status, 403);
  });

  test('authentication runs first: no token -> 401, not 403, and nothing logged as Denied', async () => {
    const before = deniedCount();
    const res = await request(probe).get('/api/hr-only');
    assert.equal(res.status, 401);
    assert.equal(deniedCount(), before);
  });

  test('requireRole refuses unknown role names at start-up', () => {
    assert.throws(() => requireRole('Director'), /unknown role/);
  });
});

describe('ASSUMPTION A-7 self-service gate', () => {
  test('Employee role passes and acts on its own ID', async () => {
    const token = await login(app, USERS.EMP);
    const res = await request(probe).get('/api/self').set(bearer(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.data, USERS.EMP);
  });

  test('roles not in SELF_SERVICE_ROLES are denied and logged', async () => {
    const token = await login(app, USERS.HR);
    const before = deniedCount();
    const res = await request(probe).get('/api/self').set(bearer(token));
    assert.equal(res.status, 403);
    assert.equal(deniedCount(), before + 1);
  });
});
