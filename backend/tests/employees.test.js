'use strict';
// Process 0.3 — UC-05, UC-06, UC-07 · BR-08, BR-09, BR-10, BR-11 · NFR-5, NFR-6, NFR-7
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');

const { db, app } = setup();
const tokens = {};
let seq = 0;
const newEmployee = (over = {}) => {
  seq += 1;
  return {
    employee_name: 'Test Person',
    date_of_birth: '1999-05-20',
    gender: 'M',
    contact_number: '9123456780',
    email: `test.person${seq}@example.com`,
    address: '1 Test Street, Kolkata',
    department: 'Engineering',
    designation: 'Engineer',
    date_of_joining: '2024-01-15',
    basic_salary: 40000,
    bank_account: '123456789012',
    ...over,
  };
};

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
});

const register = (body, token = tokens.HR) => request(app).post('/api/employees').set(bearer(token)).send(body);

describe('BR-10 registration mandatory data (UC-06)', () => {
  test('all mandatory fields missing -> 422 listing each', async () => {
    const r = await register({});
    assert.equal(r.status, 422);
    assert.equal(r.body.details.length, 11);
  });

  test('field rules: name letters/spaces, contact 6-9 + 9 digits, bank 9-18 digits, gender, department list, salary > 0', async () => {
    const bad = {
      employee_name: 'R2D2', contact_number: '5123456789', bank_account: '12345', gender: 'X',
      department: 'Marketing', basic_salary: 0, email: 'not-an-email', date_of_birth: '1999-02-30',
    };
    for (const [k, v] of Object.entries(bad)) {
      const r = await register(newEmployee({ [k]: v }));
      assert.equal(r.status, 422, `${k}=${v} should be refused`);
      assert.ok(r.body.details.some((d) => d.field === `body.${k}`), k);
    }
  });

  test('employee must be at least 18 at the date of joining', async () => {
    const r = await register(newEmployee({ date_of_birth: '2008-06-01', date_of_joining: '2026-05-31' }));
    assert.equal(r.status, 422);
    assert.equal(r.body.details[0].field, 'body.date_of_joining');
    const ok = await register(newEmployee({ date_of_birth: '2006-02-28', date_of_joining: '2024-02-28' }));
    assert.equal(ok.status, 201);
  });

  test('client cannot supply employee_id or status (400)', async () => {
    const r = await register(newEmployee({ employee_id: 'EMP99999', employment_status: 'Retired' }));
    assert.equal(r.status, 400);
  });

  test('successful registration: generated ID, Active, user account with role Employee, temp password shown once', async () => {
    const body = newEmployee();
    const r = await register(body);
    assert.equal(r.status, 201);
    const e = r.body.data;
    assert.match(e.employee_id, /^EMP\d{5}$/);
    assert.equal(e.employment_status, 'Active');
    assert.equal(e.record_created_date, dates.today());
    assert.equal(e.basic_salary, 40000);
    assert.ok(e.temporary_password && e.temporary_password.length >= 10);
    const acc = db.prepare('SELECT role, password_hash FROM USER_ACCOUNT WHERE employee_id = ?').get(e.employee_id);
    assert.equal(acc.role, 'Employee');
    assert.notEqual(acc.password_hash, e.temporary_password);
    const tok = await login(app, e.employee_id, e.temporary_password);
    const me = await request(app).get('/api/auth/me').set(bearer(tok));
    assert.equal(me.body.data.role, 'Employee');
    // GET never returns the password again
    const again = await request(app).get(`/api/employees/${e.employee_id}`).set(bearer(tokens.HR));
    assert.ok(!('temporary_password' in again.body.data));
    // audit row without restricted values
    const audit = db.prepare("SELECT detail FROM AUDIT_LOG WHERE action='REGISTER' AND entity_id = ?").get(e.employee_id);
    assert.ok(!audit.detail.includes('40000') && !audit.detail.includes(body.bank_account));
  });

  test('only the HR Manager can register', async () => {
    for (const k of ['EMP', 'PAYROLL', 'FINANCE', 'RECRUITMENT']) {
      assert.equal((await register(newEmployee(), tokens[k])).status, 403, k);
    }
  });
});

describe('BR-09 unique employee identifier', () => {
  test('duplicate e-mail (any case) -> 409 and nothing inserted', async () => {
    const count = db.prepare('SELECT COUNT(*) AS n FROM EMPLOYEE').get().n;
    const r = await register(newEmployee({ email: 'SNEHA.DAS@example.com' }));
    assert.equal(r.status, 409);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM EMPLOYEE').get().n, count);
    const failed = db.prepare("SELECT * FROM AUDIT_LOG WHERE action='REGISTER' AND outcome='Failed' ORDER BY audit_id DESC").get();
    assert.ok(failed, 'refused registration audited');
  });

  test('IDs are sequential and never reused', async () => {
    const a = (await register(newEmployee())).body.data.employee_id;
    const b = (await register(newEmployee())).body.data.employee_id;
    assert.equal(Number(b.slice(3)), Number(a.slice(3)) + 1);
  });
});

describe('BR-11 record change traceability (UC-07)', () => {
  test('HR update sets last_updated_by / last_updated_ts and writes an audit row with field names only', async () => {
    const r = await request(app)
      .patch(`/api/employees/${USERS.EMP2}`)
      .set(bearer(tokens.HR))
      .send({ designation: 'Lead Engineer', basic_salary: '70000.50' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.designation, 'Lead Engineer');
    assert.equal(r.body.data.basic_salary, 70000.5);
    assert.equal(r.body.data.last_updated_by, USERS.HR);
    assert.match(r.body.data.last_updated_ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const audit = db.prepare("SELECT * FROM AUDIT_LOG WHERE action='UPDATE' AND entity='EMPLOYEE' AND entity_id = ? ORDER BY audit_id DESC").get(USERS.EMP2);
    assert.equal(audit.employee_id, USERS.HR);
    assert.deepEqual(JSON.parse(audit.detail), { fields: ['designation', 'basic_salary'] });
  });

  test('non-editable fields -> 400; invalid values -> 422; empty body -> 422; unknown employee -> 404', async () => {
    for (const k of ['employee_id', 'record_created_date', 'last_updated_by', 'last_updated_ts']) {
      const r = await request(app).patch(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR)).send({ [k]: 'x' });
      assert.equal(r.status, 400, k);
    }
    assert.equal((await request(app).patch(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR)).send({ basic_salary: -1 })).status, 422);
    assert.equal((await request(app).patch(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR)).send({ employment_status: 'Fired' })).status, 422);
    assert.equal((await request(app).patch(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR)).send({})).status, 422);
    assert.equal((await request(app).patch('/api/employees/EMP99999').set(bearer(tokens.HR)).send({ designation: 'X' })).status, 404);
  });

  test('changing DOB re-checks the 18-year rule against the stored joining date', async () => {
    const r = await request(app).patch(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR)).send({ date_of_birth: '2010-01-01' });
    assert.equal(r.status, 422);
  });

  test('changing e-mail to one already used -> 409', async () => {
    const r = await request(app).patch(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR)).send({ email: 'sneha.das@example.com' });
    assert.equal(r.status, 409);
  });

  test('employment status change (retire / resign) is an update', async () => {
    const r = await request(app).patch('/api/employees/EMP00010').set(bearer(tokens.HR)).send({ employment_status: 'Resigned' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.employment_status, 'Resigned');
  });

  test('no DELETE endpoint', async () => {
    const r = await request(app).delete(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.HR));
    assert.equal(r.status, 404);
  });
});

describe('employee record views (UC-07)', () => {
  test('list masks bank account; detail shows it; filters work', async () => {
    const list = await request(app).get('/api/employees?department=Engineering&status=Active').set(bearer(tokens.HR));
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length >= 2);
    for (const e of list.body.data) {
      assert.equal(e.department, 'Engineering');
      assert.match(e.bank_account, /^\*+\d{4}$/);
    }
    const one = await request(app).get(`/api/employees/${USERS.EMP}`).set(bearer(tokens.HR));
    assert.equal(one.body.data.bank_account, '100200300005');
    const q = await request(app).get('/api/employees?q=sneha').set(bearer(tokens.HR));
    assert.deepEqual(q.body.data.map((e) => e.employee_id), [USERS.EMP]);
    const pct = await request(app).get('/api/employees?q=%25').set(bearer(tokens.HR));
    assert.equal(pct.body.data.length, 0, 'LIKE wildcards are escaped');
  });

  test('employee cannot read employee records', async () => {
    assert.equal((await request(app).get(`/api/employees/${USERS.EMP2}`).set(bearer(tokens.EMP))).status, 403);
  });
});

describe('BR-08 self-service profile fields (UC-05)', () => {
  test('GET /profile/me returns DS-17 Profile Details only (no salary or bank data)', async () => {
    const r = await request(app).get('/api/profile/me').set(bearer(tokens.EMP));
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.data).sort(), [
      'address', 'contact_number', 'department', 'designation', 'email', 'employee_id', 'employee_name',
    ]);
    assert.equal(r.body.data.employee_id, USERS.EMP);
  });

  test('other fields -> 400 listing the rejected keys; nothing changed', async () => {
    const r = await request(app)
      .patch('/api/profile/me')
      .set(bearer(tokens.EMP))
      .send({ address: 'New address 5', department: 'HR', basic_salary: 999999 });
    assert.equal(r.status, 400);
    assert.match(r.body.error_message, /department/);
    assert.match(r.body.error_message, /basic_salary/);
    const row = db.prepare('SELECT address, department FROM EMPLOYEE WHERE employee_id = ?').get(USERS.EMP);
    assert.notEqual(row.address, 'New address 5');
    assert.equal(row.department, 'Engineering');
  });

  test('permitted fields update own record and are traceable (BR-11)', async () => {
    const r = await request(app)
      .patch('/api/profile/me')
      .set(bearer(tokens.EMP))
      .send({ contact_number: '9000000005', address: '22 Lake Town, Kolkata', email: 'sneha.d@example.com' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.contact_number, '9000000005');
    const row = db.prepare('SELECT last_updated_by, last_updated_ts, email FROM EMPLOYEE WHERE employee_id = ?').get(USERS.EMP);
    assert.equal(row.last_updated_by, USERS.EMP);
    assert.ok(row.last_updated_ts);
    assert.equal(row.email, 'sneha.d@example.com');
  });

  test('each field validated; duplicate e-mail -> 409; empty body -> 422', async () => {
    assert.equal((await request(app).patch('/api/profile/me').set(bearer(tokens.EMP)).send({ contact_number: '12345' })).status, 422);
    assert.equal((await request(app).patch('/api/profile/me').set(bearer(tokens.EMP)).send({ address: '  ' })).status, 422);
    assert.equal((await request(app).patch('/api/profile/me').set(bearer(tokens.EMP)).send({ email: 'arjun.mehta@example.com' })).status, 409);
    assert.equal((await request(app).patch('/api/profile/me').set(bearer(tokens.EMP)).send({})).status, 422);
  });

  test('ASSUMPTION A-7: HR Manager has no self-service profile', async () => {
    assert.equal((await request(app).get('/api/profile/me').set(bearer(tokens.HR))).status, 403);
  });
});
