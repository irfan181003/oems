'use strict';
// Process 0.7 — UC-16, UC-17 · BR-22, BR-23 · NFR-16, NFR-17
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');
const money = require('../src/lib/money');

const { db, app } = setup();
const tokens = {};

function prevPeriod(period, n = 1) {
  let [y, m] = period.split('-').map(Number);
  m -= n;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}
const P = prevPeriod(dates.currentPeriod());
const P2 = prevPeriod(dates.currentPeriod(), 2);
const { start: PS, end: PE } = dates.periodBounds(P);

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
  let seq = 900;
  const att = db.prepare("INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time, att_status, recorded_ts) VALUES (?, ?, ?, '09:00:00', 'Present', ?)");
  const days = (emp, n) => {
    for (let dd = 1; dd <= n; dd += 1) att.run(`ATT${String((seq += 1)).padStart(9, '0')}`, emp, `${P}-${String(dd).padStart(2, '0')}`, dates.nowTs());
  };
  days('EMP00005', 20); // Engineering
  days('EMP00007', 5); // Sales

  const lv = db.prepare(
    `INSERT INTO LEAVE_APPLICATION (leave_id, employee_id, leave_type, leave_start, leave_end, leave_days, leave_reason, applied_date, leave_status)
     VALUES (?, ?, ?, ?, ?, ?, 'r', ?, ?)`
  );
  lv.run('LV00000901', 'EMP00005', 'Casual', `${P}-21`, `${P}-22`, 2, PS, 'Approved');
  lv.run('LV00000902', 'EMP00006', 'Sick', `${P}-10`, `${P}-10`, 1, PS, 'Pending');
  lv.run('LV00000903', 'EMP00007', 'Casual', `${P}-12`, `${P}-14`, 3, PS, 'Rejected');

  const PO = tokens.PAYROLL;
  const run = (period, lines) => request(app).post('/api/payroll/run').set(bearer(PO)).send({ pay_period: period, working_days: 22, lines });
  await run(P, [{ employee_id: 'EMP00005', allowances: 1000 }, { employee_id: 'EMP00006' }, { employee_id: 'EMP00007' }, { employee_id: 'EMP00008' }]);
  await run(P2, [{ employee_id: 'EMP00005' }]);
  const onHold = db.prepare("SELECT payroll_id FROM PAYROLL WHERE employee_id='EMP00008' AND pay_period=?").get(P).payroll_id;
  await request(app).patch(`/api/payroll/records/${onHold}/status`).set(bearer(PO)).send({ payroll_status: 'On Hold' });
});

const hr = (qs, token = tokens.HR) => request(app).get(`/api/reports/hr?${qs}`).set(bearer(token));
const fin = (qs, token = tokens.FINANCE) => request(app).get(`/api/reports/financial?${qs}`).set(bearer(token));

describe('BR-22 HR report scope (UC-16)', () => {
  test('HR Manager only (403 + Denied for others)', async () => {
    for (const k of ['FINANCE', 'PAYROLL', 'EMP', 'RECRUITMENT']) {
      assert.equal((await hr('report_type=Headcount', tokens[k])).status, 403, k);
    }
    assert.ok(db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied' AND entity='reports'").get().n >= 4);
  });

  test('DS-50 envelope: generated title, timestamp and headcount of active employees', async () => {
    const r = await hr(`report_type=Attendance&from_date=${PS}&to_date=${PE}&department=Engineering`);
    assert.equal(r.status, 200);
    const d = r.body.data;
    assert.equal(d.report_title, `Attendance Report - Engineering (${PS} to ${PE})`);
    assert.match(d.generated_ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(d.headcount, 3); // EMP00005, EMP00006, EMP00010
  });

  test('Attendance report: days present per employee for the range', async () => {
    const d = (await hr(`report_type=Attendance&from_date=${PS}&to_date=${PE}`)).body.data;
    const byId = Object.fromEntries(d.rows.map((r) => [r.employee_id, r.days_present]));
    assert.equal(byId.EMP00005, 20);
    assert.equal(byId.EMP00007, 5);
    assert.equal(byId.EMP00006, 0);
    assert.equal(d.aggregates.total_days_present, 25);
  });

  test('Leave report: counts by type and status + rows', async () => {
    const d = (await hr(`report_type=Leave&from_date=${PS}&to_date=${PE}`)).body.data;
    assert.equal(d.aggregates.applications, 3);
    assert.deepEqual(d.aggregates.by_status, { Pending: 1, Approved: 1, Rejected: 1 });
    assert.deepEqual(d.aggregates.by_type.Casual, { applications: 2, days: 5 });
    assert.ok(d.rows.every((r) => r.employee_name));
  });

  test('Headcount report: active employees by department', async () => {
    const d = (await hr('report_type=Headcount')).body.data;
    const map = Object.fromEntries(d.rows.map((r) => [r.department, r.headcount]));
    assert.deepEqual(map, { Engineering: 3, Finance: 2, HR: 1, Operations: 1, Payroll: 1, Recruitment: 1, Sales: 1 });
    assert.equal(d.headcount, 10);
  });

  test('Employee report and every HR report exclude salary and bank data', async () => {
    const e = (await hr('report_type=Employee&department=Finance')).body.data;
    assert.deepEqual(e.rows.map((r) => r.employee_id), ['EMP00004', 'EMP00009']);
    for (const qs of ['report_type=Employee', 'report_type=Headcount', `report_type=Attendance&from_date=${PS}&to_date=${PE}`, `report_type=Leave&from_date=${PS}&to_date=${PE}`]) {
      const json = JSON.stringify((await hr(qs)).body);
      for (const banned of ['basic_salary', 'bank_account', 'gross_salary', 'net_salary', 'allowances', '100200300']) {
        assert.ok(!json.includes(banned), `${qs} leaks ${banned}`);
      }
    }
  });

  test('validation: report type domain, dates required for Attendance/Leave, from <= to, department list', async () => {
    assert.equal((await hr('report_type=Organization')).status, 422); // UC-18 was removed
    assert.equal((await hr('report_type=Attendance')).status, 422);
    assert.equal((await hr(`report_type=Leave&from_date=${PE}&to_date=${PS}`)).status, 422);
    assert.equal((await hr('report_type=Headcount&department=Marketing')).status, 422);
    assert.equal((await hr('report_type=Headcount&from_date=2026-01-01')).status, 422);
  });
});

describe('BR-23 financial report access (UC-17 includes UC-02, UC-12, UC-15)', () => {
  test('Finance Manager only (HR, Payroll Officer and others 403)', async () => {
    for (const k of ['HR', 'PAYROLL', 'EMP', 'RECRUITMENT']) {
      assert.equal((await fin(`report_type=Financial&from_date=${PS}&to_date=${PE}`, tokens[k])).status, 403, k);
    }
  });

  test('only Processed/Paid lines in the range; totals and department totals (DE-094..097)', async () => {
    const r = await fin(`report_type=Financial&from_date=${PS}&to_date=${PE}`);
    assert.equal(r.status, 200);
    const d = r.body.data;
    const lines = db.prepare("SELECT p.*, e.department FROM PAYROLL p JOIN EMPLOYEE e USING (employee_id) WHERE pay_period = ? AND payroll_status IN ('Processed','Paid')").all(P);
    assert.equal(lines.length, 3, 'On Hold line excluded');
    const sum = (rows, k) => money.fromPaise(rows.reduce((s, x) => s + money.toPaise(x[k]), 0));
    assert.equal(d.payroll_lines, 3);
    assert.deepEqual(d.pay_periods, [P]);
    assert.equal(d.total_payroll_cost, sum(lines, 'gross_salary'));
    assert.equal(d.total_deductions, sum(lines, 'total_deductions'));
    assert.equal(d.total_net, sum(lines, 'net_salary'));
    const eng = d.departments.find((x) => x.department === 'Engineering');
    const engLines = lines.filter((l) => l.department === 'Engineering');
    assert.equal(eng.employees_paid, 2);
    assert.equal(eng.department_total_gross, sum(engLines, 'gross_salary'));
    assert.equal(eng.department_total_deductions, sum(engLines, 'total_deductions'));
    assert.equal(eng.department_total_net, sum(engLines, 'net_salary'));
    assert.equal(eng.days_present, 20); // UC-02 include
    assert.equal(d.departments.find((x) => x.department === 'Sales').days_present, 5);
    assert.equal(d.departments.find((x) => x.department === 'Operations'), undefined, 'On Hold only -> not in report');
    assert.equal(d.total_days_present, 25);
    assert.equal(d.rows, undefined, 'Financial type gives totals only');
  });

  test('Payroll type lists the payroll lines; range and department filters apply', async () => {
    const both = (await fin(`report_type=Payroll&from_date=${dates.periodBounds(P2).start}&to_date=${PE}`)).body.data;
    assert.deepEqual(both.pay_periods, [P2, P]);
    assert.equal(both.rows.length, 4);
    const sales = (await fin(`report_type=Payroll&from_date=${PS}&to_date=${PE}&department=Sales`)).body.data;
    assert.deepEqual(sales.rows.map((x) => x.employee_id), ['EMP00007']);
    assert.equal(sales.departments.length, 1);
    const none = (await fin('report_type=Financial&from_date=2020-01-01&to_date=2020-12-31')).body.data;
    assert.equal(none.total_payroll_cost, 0);
    assert.equal(none.payroll_lines, 0);
  });

  test('validation: type domain, both dates required, from <= to', async () => {
    assert.equal((await fin(`report_type=HR&from_date=${PS}&to_date=${PE}`)).status, 422);
    assert.equal((await fin('report_type=Financial')).status, 422);
    assert.equal((await fin(`report_type=Financial&from_date=${PE}&to_date=${PS}`)).status, 422);
  });
});
