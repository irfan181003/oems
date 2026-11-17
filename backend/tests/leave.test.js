'use strict';
// Process 0.2 — UC-03, UC-04 · BR-04, BR-05, BR-06, BR-07 · NFR-3, NFR-4
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');

const { db, app } = setup();
const today = dates.today();
const tokens = {};
const valid = () => ({
  leave_type: 'Casual',
  leave_start: dates.addDays(today, 2),
  leave_end: dates.addDays(today, 4),
  leave_reason: 'Family function',
});

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
});

const apply = (token, body) => request(app).post('/api/leaves').set(bearer(token)).send(body);

describe('BR-04 leave mandatory fields', () => {
  test('missing type, dates and reason -> 422 with one detail per field', async () => {
    const r = await apply(tokens.EMP, {});
    assert.equal(r.status, 422);
    const fields = r.body.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['body.leave_end', 'body.leave_reason', 'body.leave_start', 'body.leave_type']);
  });

  test('blank reason (spaces only) and an unknown leave type are refused', async () => {
    assert.equal((await apply(tokens.EMP, { ...valid(), leave_reason: '   ' })).status, 422);
    assert.equal((await apply(tokens.EMP, { ...valid(), leave_type: 'Vacation' })).status, 422);
  });

  test('client cannot set status or employee_id (400)', async () => {
    const r = await apply(tokens.EMP, { ...valid(), leave_status: 'Approved', employee_id: USERS.EMP2 });
    assert.equal(r.status, 400);
    assert.match(r.body.error_message, /leave_status/);
  });
});

describe('BR-05 leave date range', () => {
  test('start before the applied date (today) -> 422', async () => {
    const r = await apply(tokens.EMP, { ...valid(), leave_start: dates.addDays(today, -1) });
    assert.equal(r.status, 422);
    assert.equal(r.body.details[0].field, 'body.leave_start');
  });

  test('end before start -> 422', async () => {
    const r = await apply(tokens.EMP, { ...valid(), leave_end: dates.addDays(today, 1) });
    assert.equal(r.status, 422);
    assert.equal(r.body.details[0].field, 'body.leave_end');
  });

  test('valid application: Pending, applied today, days = end - start + 1; a one-day leave starting today is allowed', async () => {
    const r = await apply(tokens.EMP, valid());
    assert.equal(r.status, 201);
    assert.match(r.body.reference_id, /^LV\d{8}$/);
    assert.equal(r.body.data.leave_status, 'Pending');
    assert.equal(r.body.data.applied_date, today);
    assert.equal(r.body.data.leave_days, 3);
    assert.equal(r.body.data.employee_id, USERS.EMP);
    const r2 = await apply(tokens.EMP, { ...valid(), leave_start: today, leave_end: today, leave_type: 'Sick' });
    assert.equal(r2.status, 201);
    assert.equal(r2.body.data.leave_days, 1);
  });
});

describe('BR-06 leave decision authority', () => {
  test('only the HR Manager may decide (other roles 403 + Denied); approver and date recorded', async () => {
    const leave = (await apply(tokens.EMP, valid())).body.data;
    for (const k of ['EMP', 'PAYROLL', 'FINANCE', 'RECRUITMENT']) {
      const r = await request(app).patch(`/api/leaves/${leave.leave_id}/decision`).set(bearer(tokens[k])).send({ decision: 'Approved' });
      assert.equal(r.status, 403, k);
    }
    assert.equal(db.prepare('SELECT leave_status FROM LEAVE_APPLICATION WHERE leave_id = ?').get(leave.leave_id).leave_status, 'Pending');

    const ok = await request(app)
      .patch(`/api/leaves/${leave.leave_id}/decision`)
      .set(bearer(tokens.HR))
      .send({ decision: 'Approved', hr_remarks: 'Enjoy' });
    assert.equal(ok.status, 200);
    // DS-11 Leave Status Notice
    assert.deepEqual(ok.body.data, { leave_id: leave.leave_id, leave_status: 'Approved', decision_date: today, hr_remarks: 'Enjoy' });
    const row = db.prepare('SELECT approved_by, decision_date FROM LEAVE_APPLICATION WHERE leave_id = ?').get(leave.leave_id);
    assert.equal(row.approved_by, USERS.HR);
    assert.equal(row.decision_date, today);
    // NFR-4: status change traceable
    const audit = db.prepare("SELECT * FROM AUDIT_LOG WHERE entity='LEAVE_APPLICATION' AND action='DECISION' AND entity_id = ?").get(leave.leave_id);
    assert.equal(audit.employee_id, USERS.HR);
    assert.equal(audit.outcome, 'Success');
  });

  test('invalid decision value -> 422', async () => {
    const leave = (await apply(tokens.EMP, valid())).body.data;
    const r = await request(app).patch(`/api/leaves/${leave.leave_id}/decision`).set(bearer(tokens.HR)).send({ decision: 'Pending' });
    assert.equal(r.status, 422);
  });
});

describe('BR-07 leave status life cycle', () => {
  test('only Pending -> Approved|Rejected; deciding again -> 409', async () => {
    const leave = (await apply(tokens.EMP2, valid())).body.data;
    const r1 = await request(app).patch(`/api/leaves/${leave.leave_id}/decision`).set(bearer(tokens.HR)).send({ decision: 'Rejected' });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.data.leave_status, 'Rejected');
    const r2 = await request(app).patch(`/api/leaves/${leave.leave_id}/decision`).set(bearer(tokens.HR)).send({ decision: 'Approved' });
    assert.equal(r2.status, 409);
    assert.equal(db.prepare('SELECT leave_status FROM LEAVE_APPLICATION WHERE leave_id = ?').get(leave.leave_id).leave_status, 'Rejected');
  });

  test('unknown leave -> 404', async () => {
    const r = await request(app).patch('/api/leaves/LV99999999/decision').set(bearer(tokens.HR)).send({ decision: 'Approved' });
    assert.equal(r.status, 404);
  });
});

describe('leave views', () => {
  test('employee sees only own applications with status fields', async () => {
    const r = await request(app).get('/api/leaves/me').set(bearer(tokens.EMP2));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.length >= 1);
    assert.ok(r.body.data.every((l) => l.employee_id === USERS.EMP2));
    for (const k of ['leave_id', 'leave_status', 'decision_date', 'hr_remarks']) assert.ok(k in r.body.data[0]);
  });

  test('HR review list includes employee_name and filters by status/employee', async () => {
    const r = await request(app).get(`/api/leaves?status=Pending&employee_id=${USERS.EMP}`).set(bearer(tokens.HR));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.length >= 1);
    assert.ok(r.body.data.every((l) => l.leave_status === 'Pending' && l.employee_id === USERS.EMP && l.employee_name));
    const denied = await request(app).get('/api/leaves').set(bearer(tokens.EMP));
    assert.equal(denied.status, 403);
  });

  test('GET /leaves/:id — owner and HR allowed, another employee 403', async () => {
    const leave = (await apply(tokens.EMP, valid())).body.data;
    assert.equal((await request(app).get(`/api/leaves/${leave.leave_id}`).set(bearer(tokens.EMP))).status, 200);
    assert.equal((await request(app).get(`/api/leaves/${leave.leave_id}`).set(bearer(tokens.HR))).status, 200);
    assert.equal((await request(app).get(`/api/leaves/${leave.leave_id}`).set(bearer(tokens.EMP2))).status, 403);
    assert.equal((await request(app).get('/api/leaves/LV99999999').set(bearer(tokens.HR))).status, 404);
    assert.equal((await request(app).get('/api/leaves/bad-id').set(bearer(tokens.HR))).status, 422);
  });
});
