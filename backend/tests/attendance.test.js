'use strict';
// Process 0.1 — UC-01, UC-02 · BR-01, BR-02, BR-03 · NFR-1, NFR-2
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');

const { db, app } = setup();
const today = dates.today();
const tokens = {};

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
  tokens.EMP8 = await login(app, 'EMP00008');
});

describe('BR-01 duplicate attendance prevention', () => {
  test('first check-in recorded by the server clock; second check-in the same day -> 409', async () => {
    const r1 = await request(app).post('/api/attendance/check-in').set(bearer(tokens.EMP));
    assert.equal(r1.status, 201);
    assert.match(r1.body.reference_id, /^ATT\d{9}$/);
    assert.equal(r1.body.data.employee_id, USERS.EMP);
    assert.equal(r1.body.data.att_date, today);
    assert.equal(r1.body.data.att_status, 'Present');
    assert.match(r1.body.data.checkin_time, /^\d{2}:\d{2}:\d{2}$/);
    assert.equal(r1.body.data.checkout_time, null);

    const r2 = await request(app).post('/api/attendance/check-in').set(bearer(tokens.EMP));
    assert.equal(r2.status, 409);
    assert.equal(r2.body.result_status, 'Failed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ATTENDANCE WHERE employee_id = ? AND att_date = ?').get(USERS.EMP, today).n, 1);
    const failed = db.prepare("SELECT * FROM AUDIT_LOG WHERE action='CHECK_IN' AND outcome='Failed' AND employee_id=?").get(USERS.EMP);
    assert.ok(failed, 'refused check-in is audited');
  });

  test('client cannot supply date, time or status (body ignored, server clock used)', async () => {
    const r = await request(app)
      .post('/api/attendance/check-in')
      .set(bearer(tokens.EMP2))
      .send({ att_date: '2020-01-01', checkin_time: '01:00:00', att_status: 'Absent', employee_id: USERS.EMP });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.employee_id, USERS.EMP2);
    assert.equal(r.body.data.att_date, today);
    assert.equal(r.body.data.att_status, 'Present');
  });
});

describe('BR-02 check-out after check-in', () => {
  test('check-out without a check-in today -> 409', async () => {
    const r = await request(app).post('/api/attendance/check-out').set(bearer(tokens.EMP8));
    assert.equal(r.status, 409);
    assert.match(r.body.error_message, /No check-in/);
  });

  test('check-out time not later than check-in time -> 409', async () => {
    db.prepare(
      "INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time, att_status, recorded_ts) VALUES ('ATT000000900', 'EMP00008', ?, '23:59:59', 'Present', ?)"
    ).run(today, dates.nowTs());
    const r = await request(app).post('/api/attendance/check-out').set(bearer(tokens.EMP8));
    assert.equal(r.status, 409);
    assert.match(r.body.error_message, /later than check-in/);
    assert.equal(db.prepare("SELECT checkout_time FROM ATTENDANCE WHERE attendance_id='ATT000000900'").get().checkout_time, null);
  });

  test('valid check-out is recorded once; a second check-out -> 409', async () => {
    db.prepare("UPDATE ATTENDANCE SET checkin_time = '00:00:00' WHERE employee_id = ? AND att_date = ?").run(USERS.EMP, today);
    const r1 = await request(app).post('/api/attendance/check-out').set(bearer(tokens.EMP));
    assert.equal(r1.status, 200);
    assert.ok(r1.body.data.checkout_time > r1.body.data.checkin_time);
    const r2 = await request(app).post('/api/attendance/check-out').set(bearer(tokens.EMP));
    assert.equal(r2.status, 409);
    assert.match(r2.body.error_message, /Already checked out/);
  });
});

describe('BR-03 own attendance only; HR Manager sees all (UC-02)', () => {
  test('employee views own attendance with a days-present summary', async () => {
    const r = await request(app).get(`/api/attendance/me?from=${dates.addDays(today, -30)}&to=${today}`).set(bearer(tokens.EMP));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.employee_id, USERS.EMP);
    assert.ok(r.body.data.records.every((x) => x.employee_id === USERS.EMP));
    assert.equal(r.body.data.summary.days_present, 1);
  });

  test('employee cannot name another employee on /me (400) or use the HR view (403 + Denied)', async () => {
    const r1 = await request(app).get(`/api/attendance/me?from=${today}&to=${today}&employee_id=${USERS.EMP2}`).set(bearer(tokens.EMP));
    assert.equal(r1.status, 400);
    const before = db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied'").get().n;
    const r2 = await request(app).get(`/api/attendance?employee_id=${USERS.EMP2}&from=${today}&to=${today}`).set(bearer(tokens.EMP));
    assert.equal(r2.status, 403);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied'").get().n, before + 1);
  });

  test('HR Manager views all employees, optionally filtered', async () => {
    const all = await request(app).get(`/api/attendance?from=${today}&to=${today}`).set(bearer(tokens.HR));
    assert.equal(all.status, 200);
    const ids = new Set(all.body.data.records.map((r) => r.employee_id));
    assert.ok(ids.has(USERS.EMP) && ids.has(USERS.EMP2));
    assert.ok(all.body.data.records[0].employee_name);
    const one = await request(app).get(`/api/attendance?employee_id=${USERS.EMP2}&from=${today}&to=${today}`).set(bearer(tokens.HR));
    assert.deepEqual([...new Set(one.body.data.records.map((r) => r.employee_id))], [USERS.EMP2]);
  });

  test('other roles cannot view all attendance', async () => {
    for (const k of ['PAYROLL', 'FINANCE', 'RECRUITMENT']) {
      const r = await request(app).get(`/api/attendance?from=${today}&to=${today}`).set(bearer(tokens[k]));
      assert.equal(r.status, 403, k);
    }
  });

  test('DE-014/015: from must not be after to; both required and valid dates', async () => {
    const r1 = await request(app).get(`/api/attendance/me?from=${today}&to=${dates.addDays(today, -1)}`).set(bearer(tokens.EMP));
    assert.equal(r1.status, 422);
    const r2 = await request(app).get('/api/attendance/me').set(bearer(tokens.EMP));
    assert.equal(r2.status, 422);
    const r3 = await request(app).get(`/api/attendance/me?from=2026-02-30&to=${today}`).set(bearer(tokens.EMP));
    assert.equal(r3.status, 422);
  });

  test('ASSUMPTION A-7: non-Employee roles cannot check in', async () => {
    const r = await request(app).post('/api/attendance/check-in').set(bearer(tokens.HR));
    assert.equal(r.status, 403);
  });
});
