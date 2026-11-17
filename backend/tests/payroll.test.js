'use strict';
// Process 0.5 — UC-11, UC-12, UC-14, UC-15 · BR-15, BR-17, BR-18, BR-19, BR-28, BR-30 · NFR-11, NFR-14, NFR-15
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');

const { db, app } = setup();
const tokens = {};
let PO;

function prevPeriod(period, n = 1) {
  let [y, m] = period.split('-').map(Number);
  m -= n;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}
const P = prevPeriod(dates.currentPeriod()); // last month
const P2 = prevPeriod(dates.currentPeriod(), 2); // two months ago
const d = (period, day) => `${period}-${String(day).padStart(2, '0')}`;

let attSeq = 500;
function present(employeeId, period, days) {
  const ins = db.prepare(
    "INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time, checkout_time, att_status, recorded_ts) VALUES (?, ?, ?, '09:00', '18:00', 'Present', ?)"
  );
  for (const day of days) ins.run(`ATT${String((attSeq += 1)).padStart(9, '0')}`, employeeId, d(period, day), dates.nowTs());
}
let lvSeq = 500;
function leave(employeeId, type, start, end, status) {
  db.prepare(
    `INSERT INTO LEAVE_APPLICATION (leave_id, employee_id, leave_type, leave_start, leave_end, leave_days, leave_reason, applied_date, leave_status, approved_by, decision_date)
     VALUES (?, ?, ?, ?, ?, ?, 'test', ?, ?, ?, ?)`
  ).run(
    `LV${String((lvSeq += 1)).padStart(8, '0')}`, employeeId, type, start, end, dates.daysInclusive(start, end), start, status,
    status === 'Pending' ? null : USERS.HR, status === 'Pending' ? null : start
  );
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
  PO = tokens.PAYROLL;

  // EMP00005 (basic 48000): 20 days present, Approved Casual 2 days; Pending + Rejected leave ignored (BR-18)
  present('EMP00005', P, range(1, 20));
  leave('EMP00005', 'Casual', d(P, 21), d(P, 22), 'Approved');
  leave('EMP00005', 'Sick', d(P, 23), d(P, 24), 'Pending');
  leave('EMP00005', 'Earned', d(P, 25), d(P, 25), 'Rejected');
  // EMP00006 (basic 65000): 15 days present, Approved *Unpaid* leave 3 days -> unpaid absence (A-6)
  present('EMP00006', P, range(4, 18));
  leave('EMP00006', 'Unpaid', d(P, 1), d(P, 3), 'Approved');
  // EMP00007 (basic 22000): Approved Casual leave starting 2 days before P and ending on day 3 -> clipped to 3 days
  leave('EMP00007', 'Casual', dates.addDays(d(P, 1), -2), d(P, 3), 'Approved');
});

const run = (body, token = PO) => request(app).post('/api/payroll/run').set(bearer(token)).send(body);
const record = (employeeId, period) => db.prepare('SELECT * FROM PAYROLL WHERE employee_id = ? AND pay_period = ?').get(employeeId, period);

describe('payroll run input validation (DE-074, DE-075, BR-28)', () => {
  test('pay period format, not in the future; working days 1..days in month', async () => {
    const future = dates.addDays(dates.periodBounds(dates.currentPeriod()).end, 1).slice(0, 7);
    assert.equal((await run({ pay_period: future, working_days: 20 })).status, 422);
    assert.equal((await run({ pay_period: '2026-13', working_days: 20 })).status, 422);
    assert.equal((await run({ pay_period: P, working_days: 0 })).status, 422);
    assert.equal((await run({ pay_period: P, working_days: dates.daysInMonth(P) + 1 })).status, 422);
    assert.equal((await run({ pay_period: '2024-02', working_days: 30 })).status, 422);
    assert.equal((await run({ pay_period: P, working_days: 20.5 })).status, 422);
  });

  test('BR-28: negative or over-precise allowances / other deductions -> 422; duplicate lines -> 422', async () => {
    const r = await run({ pay_period: P, working_days: 22, lines: [{ employee_id: USERS.EMP, allowances: -1 }] });
    assert.equal(r.status, 422);
    assert.equal((await run({ pay_period: P, working_days: 22, lines: [{ employee_id: USERS.EMP, other_deductions: -5 }] })).status, 422);
    assert.equal((await run({ pay_period: P, working_days: 22, lines: [{ employee_id: USERS.EMP, allowances: '10.123' }] })).status, 422);
    assert.equal(
      (await run({ pay_period: P, working_days: 22, lines: [{ employee_id: USERS.EMP }, { employee_id: USERS.EMP }] })).status,
      422
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM PAYROLL').get().n, 0, 'nothing stored');
  });

  test('only the Payroll Officer can run payroll', async () => {
    for (const k of ['HR', 'FINANCE', 'EMP', 'RECRUITMENT']) assert.equal((await run({ pay_period: P, working_days: 22 }, tokens[k])).status, 403, k);
  });
});

describe('payroll run: collect -> calculate -> store (BR-17, BR-18)', () => {
  let result;
  before(async () => {
    db.prepare("UPDATE EMPLOYEE SET employment_status = 'Resigned' WHERE employee_id = 'EMP00010'").run();
    const r = await run({
      pay_period: P,
      working_days: 22,
      lines: [
        { employee_id: 'EMP00005', allowances: 2000, other_deductions: 500 },
        { employee_id: 'EMP00006' },
        { employee_id: 'EMP00007' },
        { employee_id: 'EMP00008', other_deductions: 100000 }, // net would be negative -> failed
        { employee_id: 'EMP99999' }, // unknown -> failed
        { employee_id: 'EMP00010' }, // Resigned -> failed
      ],
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    result = r.body.data;
  });

  test('DS-38 processing status: processed / skipped / failed; one failure does not stop the others', () => {
    assert.equal(result.employees_processed, 3);
    assert.equal(result.status, 'Processed');
    assert.deepEqual(result.failed.map((x) => x.employee_id).sort(), ['EMP00008', 'EMP00010', 'EMP99999']);
    assert.match(result.failed.find((x) => x.employee_id === 'EMP00008').reason, /negative/);
    assert.equal(result.skipped.length, 0);
    assert.equal(record('EMP00008', P), undefined, 'failed employee has no line');
    for (const p of result.processed) assert.match(p.payroll_id, /^PAY\d{9}$/);
  });

  test('BR-17 + BR-18: only Approved paid leave counts (Pending/Rejected ignored)', () => {
    // dp 20 + paid leave 2 = 22 -> no unpaid absence; gross 48000 + 2000 = 50000 (5 % slab) -> tax 2500
    // pf 12 % of 48000 = 5760; total 2500 + 5760 + 500 = 8760; net 41240
    const r = record('EMP00005', P);
    assert.equal(r.days_present, 20);
    assert.equal(r.leave_days, 2);
    assert.equal(r.basic_salary, 48000);
    assert.equal(r.allowances, 2000);
    assert.equal(r.gross_salary, 50000);
    assert.equal(r.tax_deduction, 2500);
    assert.equal(r.pf_deduction, 5760);
    assert.equal(r.total_deductions, 8760);
    assert.equal(r.net_salary, 41240);
    assert.equal(r.payroll_status, 'Processed');
    assert.equal(r.processed_date, dates.today());
  });

  test('ASSUMPTION A-6: Approved Unpaid leave is unpaid absence', () => {
    // dp 15, paid 0 -> unpaid 7; earned = 65000 x 15/22 = 44318.18; tax 2215.91; pf 5318.18; net 36784.09
    const r = record('EMP00006', P);
    assert.equal(r.leave_days, 0);
    assert.equal(r.gross_salary, 44318.18);
    assert.equal(r.tax_deduction, 2215.91);
    assert.equal(r.pf_deduction, 5318.18);
    assert.equal(r.net_salary, 36784.09);
  });

  test('leave crossing the month start is clipped to the pay period', () => {
    // 3 paid days in P only: earned = 22000 x 3/22 = 3000; tax 0; pf 360; net 2640
    const r = record('EMP00007', P);
    assert.equal(r.leave_days, 3);
    assert.equal(r.gross_salary, 3000);
    assert.equal(r.tax_deduction, 0);
    assert.equal(r.net_salary, 2640);
  });

  test('payroll audit rows contain no amounts', () => {
    const rows = db.prepare("SELECT detail FROM AUDIT_LOG WHERE entity = 'PAYROLL'").all();
    assert.ok(rows.length >= 4);
    for (const r of rows) assert.ok(!/41240|50000|48000/.test(r.detail || ''), r.detail);
  });
});

describe('BR-19 one payroll line per employee per period', () => {
  test('re-running the same period keeps the existing line (skipped) and stores no duplicate', async () => {
    const before = record('EMP00005', P);
    const r = await run({ pay_period: P, working_days: 20, lines: [{ employee_id: 'EMP00005', allowances: 9999 }] });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.employees_processed, 0);
    assert.deepEqual(r.body.data.skipped.map((s) => [s.employee_id, s.payroll_id]), [['EMP00005', before.payroll_id]]);
    assert.deepEqual(record('EMP00005', P), before, 'existing line unchanged');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM PAYROLL WHERE employee_id='EMP00005' AND pay_period=?").get(P).n, 1);
  });

  test('without lines every Active employee is processed; a second run skips them all', async () => {
    const active = db.prepare("SELECT COUNT(*) AS n FROM EMPLOYEE WHERE employment_status='Active'").get().n;
    const r1 = await run({ pay_period: P2, working_days: 21 });
    assert.equal(r1.body.data.employees_processed, active);
    const r2 = await run({ pay_period: P2, working_days: 21 });
    assert.equal(r2.body.data.employees_processed, 0);
    assert.equal(r2.body.data.skipped.length, active);
    assert.equal(r2.body.data.status, 'Nothing processed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM PAYROLL WHERE pay_period = ?').get(P2).n, active);
  });

  test('the database also refuses a duplicate line', () => {
    const r = record('EMP00005', P);
    assert.throws(
      () => db.prepare(
        `INSERT INTO PAYROLL (payroll_id, employee_id, pay_period, days_present, leave_days, basic_salary, gross_salary, total_deductions, net_salary)
         VALUES ('PAY999999999', ?, ?, 0, 0, 1, 0, 0, 0)`
      ).run(r.employee_id, r.pay_period),
      /UNIQUE/
    );
  });
});

describe('BR-30 payroll records access (UC-15) and status (NFR-14)', () => {
  test('only the Payroll Officer may view payroll records (403 + Denied for others)', async () => {
    for (const k of ['HR', 'FINANCE', 'EMP', 'RECRUITMENT']) {
      assert.equal((await request(app).get('/api/payroll/records').set(bearer(tokens[k]))).status, 403, k);
    }
    const denied = db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied' AND entity='payroll'").get().n;
    assert.ok(denied >= 4);
  });

  test('DS-40 view with employee name; filters; 404 for unknown', async () => {
    const r = await request(app).get(`/api/payroll/records?pay_period=${P}&employee_id=EMP00005`).set(bearer(PO));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].employee_name, 'Sneha Das');
    const one = await request(app).get(`/api/payroll/records/${r.body.data[0].payroll_id}`).set(bearer(PO));
    assert.equal(one.body.data.net_salary, 41240);
    assert.equal((await request(app).get('/api/payroll/records/PAY999999998').set(bearer(PO))).status, 404);
  });

  test('status: Processed -> On Hold -> Processed -> Paid; Paid is final; amounts cannot be edited', async () => {
    const id = record('EMP00006', P).payroll_id;
    const set = (s) => request(app).patch(`/api/payroll/records/${id}/status`).set(bearer(PO)).send({ payroll_status: s });
    assert.equal((await set('On Hold')).body.data.payroll_status, 'On Hold');
    assert.equal((await set('Paid')).status, 409, 'On Hold -> Paid not allowed');
    assert.equal((await set('Processed')).status, 200);
    assert.equal((await set('Paid')).status, 200);
    assert.equal((await set('Processed')).status, 409);
    assert.equal((await set('On Hold')).status, 409);
    const edit = await request(app).patch(`/api/payroll/records/${id}/status`).set(bearer(PO)).send({ payroll_status: 'Paid', net_salary: 1 });
    assert.equal(edit.status, 400);
    assert.equal(record('EMP00006', P).net_salary, 36784.09);
  });
});

describe('BR-15 salary confidentiality (UC-11, A-4)', () => {
  test('employee sees only own salary, payroll lines and payslips', async () => {
    const r = await request(app).get('/api/salary/me').set(bearer(tokens.EMP));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.employee_id, USERS.EMP);
    assert.equal(r.body.data.basic_salary, 48000);
    assert.ok(r.body.data.payroll.length >= 1);
    assert.ok(r.body.data.payroll.every((p) => p.payroll_id && p.net_salary >= 0));
    assert.ok(Array.isArray(r.body.data.payslips));
    assert.ok(!('bank_account' in r.body.data));
  });

  test("employee cannot read another employee's salary (403 + Denied, or 400 on /me)", async () => {
    const before = db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied' AND entity='salary'").get().n;
    assert.equal((await request(app).get(`/api/salary?employee_id=${USERS.EMP2}`).set(bearer(tokens.EMP))).status, 403);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied' AND entity='salary'").get().n, before + 1);
    assert.equal((await request(app).get(`/api/salary/me?employee_id=${USERS.EMP2}`).set(bearer(tokens.EMP))).status, 400);
  });

  test('HR Manager, Payroll Officer and Finance Manager may view salaries; Recruitment Officer may not', async () => {
    for (const k of ['HR', 'PAYROLL', 'FINANCE']) {
      const r = await request(app).get(`/api/salary?employee_id=EMP00005&pay_period=${P}`).set(bearer(tokens[k]));
      assert.equal(r.status, 200, k);
      const e = r.body.data[0];
      assert.deepEqual(Object.keys(e).sort(), ['basic_salary', 'department', 'employee_id', 'employee_name', 'periods']);
      assert.equal(e.periods.length, 1);
      assert.equal(e.periods[0].gross_salary, 50000);
    }
    assert.equal((await request(app).get('/api/salary').set(bearer(tokens.RECRUITMENT))).status, 403);
    assert.equal((await request(app).get('/api/salary?employee_id=EMP99999').set(bearer(tokens.HR))).status, 404);
  });

  test('ASSUMPTION A-7: non-Employee roles have no /salary/me', async () => {
    assert.equal((await request(app).get('/api/salary/me').set(bearer(tokens.FINANCE))).status, 403);
  });
});
