'use strict';
// Process 0.3.4 — UC-20 · FR-20 · BR-24, BR-25 · NFR-20
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');

const { db, app } = setup();
const tokens = {};
// EMP00005 joined 2021-07-01
const plan = (over = {}) => ({
  employee_id: USERS.EMP,
  retirement_date: '2056-02-14',
  plan_type: 'Provident Fund',
  contribution_amount: 2500,
  nominee_name: 'Asha Das',
  ...over,
});

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
});

const create = (body, token = tokens.HR) => request(app).post('/api/retirement-plans').set(bearer(token)).send(body);

describe('BR-25 retirement date validity', () => {
  test('retirement date on or before the date of joining -> 422', async () => {
    for (const d of ['2021-07-01', '2020-01-01']) {
      const r = await create(plan({ retirement_date: d }));
      assert.equal(r.status, 422, d);
      assert.equal(r.body.details[0].field, 'body.retirement_date');
    }
  });

  test('valid plan created (RP + 6 digits, Active)', async () => {
    const r = await create(plan());
    assert.equal(r.status, 201);
    assert.match(r.body.reference_id, /^RP\d{6}$/);
    assert.equal(r.body.data.plan_status, 'Active');
    assert.equal(r.body.data.contribution_amount, 2500);
  });

  test('update re-checks the retirement date', async () => {
    const id = db.prepare('SELECT ret_plan_id FROM RETIREMENT_PLAN WHERE employee_id = ?').get(USERS.EMP).ret_plan_id;
    const r = await request(app).patch(`/api/retirement-plans/${id}`).set(bearer(tokens.HR)).send({ retirement_date: '2021-06-30' });
    assert.equal(r.status, 422);
  });
});

describe('BR-24 retirement plan control (HR only, traceable)', () => {
  test('other roles cannot create, read or update (403 + Denied)', async () => {
    for (const k of ['EMP', 'PAYROLL', 'FINANCE', 'RECRUITMENT']) {
      assert.equal((await create(plan({ employee_id: USERS.EMP2 }), tokens[k])).status, 403, k);
      assert.equal((await request(app).get('/api/retirement-plans').set(bearer(tokens[k]))).status, 403, k);
    }
    const denied = db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied' AND entity='retirement-plans'").get().n;
    assert.ok(denied >= 8);
  });

  test('HR updates are audited with field names only (no amounts or nominee)', async () => {
    const id = db.prepare('SELECT ret_plan_id FROM RETIREMENT_PLAN WHERE employee_id = ?').get(USERS.EMP).ret_plan_id;
    const r = await request(app)
      .patch(`/api/retirement-plans/${id}`)
      .set(bearer(tokens.HR))
      .send({ contribution_amount: 3000, nominee_name: 'Ravi Das', plan_status: 'Closed' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.contribution_amount, 3000);
    assert.equal(r.body.data.plan_status, 'Closed');
    const audit = db.prepare("SELECT * FROM AUDIT_LOG WHERE entity='RETIREMENT_PLAN' AND action='UPDATE' AND entity_id = ?").get(id);
    assert.equal(audit.employee_id, USERS.HR);
    assert.ok(!audit.detail.includes('3000') && !audit.detail.includes('Ravi'));
  });

  test('ASSUMPTION A-1: one plan per employee -> 409', async () => {
    const r = await create(plan({ plan_type: 'Gratuity' }));
    assert.equal(r.status, 409);
  });

  test('employee must exist; plan_type enum; contribution >= 0', async () => {
    assert.equal((await create(plan({ employee_id: 'EMP99999' }))).status, 404);
    assert.equal((await create(plan({ employee_id: USERS.EMP2, plan_type: 'Bonus' }))).status, 422);
    assert.equal((await create(plan({ employee_id: USERS.EMP2, contribution_amount: -1 }))).status, 422);
    const zero = await create(plan({ employee_id: USERS.EMP2, contribution_amount: 0, nominee_name: undefined }));
    assert.equal(zero.status, 201);
    assert.equal(zero.body.data.nominee_name, null);
  });

  test('HR lists and reads plans', async () => {
    const list = await request(app).get(`/api/retirement-plans?employee_id=${USERS.EMP2}`).set(bearer(tokens.HR));
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    const one = await request(app).get(`/api/retirement-plans/${list.body.data[0].ret_plan_id}`).set(bearer(tokens.HR));
    assert.equal(one.status, 200);
    assert.equal(one.body.data.employee_id, USERS.EMP2);
    assert.equal((await request(app).get('/api/retirement-plans/RP999999').set(bearer(tokens.HR))).status, 404);
  });
});
