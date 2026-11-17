'use strict';
// npm run seed (BACKEND_PROMPT section 10): idempotent, consistent demo data.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { PASSWORD } = require('./helpers'); // sets the test environment first
const { openDb } = require('../src/db');
const { seedAll, prevPeriod } = require('../db/seed');
const dates = require('../src/lib/dates');

const TABLES = ['EMPLOYEE', 'USER_ACCOUNT', 'ATTENDANCE', 'LEAVE_APPLICATION', 'VACANCY', 'CANDIDATE',
  'INTERVIEW_SCHEDULE', 'OFFER', 'PAYROLL', 'PAYSLIP', 'RETIREMENT_PLAN'];
const counts = (db) => Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));

describe('seed', () => {
  const db = openDb(':memory:');
  const first = seedAll(db, PASSWORD);
  const afterFirst = counts(db);

  test('creates one user per role and the demo data listed in section 10', () => {
    const roles = db.prepare('SELECT role, COUNT(*) AS n FROM USER_ACCOUNT GROUP BY role').all();
    assert.deepEqual(Object.fromEntries(roles.map((r) => [r.role, r.n])), {
      Employee: 6, 'Finance Manager': 1, 'HR Manager': 1, 'Payroll Officer': 1, 'Recruitment Officer': 1,
    });
    assert.equal(afterFirst.VACANCY, 2);
    assert.equal(afterFirst.CANDIDATE, 3);
    assert.ok(afterFirst.INTERVIEW_SCHEDULE >= 1);
    assert.equal(afterFirst.RETIREMENT_PLAN, 1);
    const statuses = db.prepare('SELECT DISTINCT leave_status FROM LEAVE_APPLICATION').all().map((r) => r.leave_status).sort();
    assert.deepEqual(statuses, ['Approved', 'Pending', 'Rejected']);
  });

  test('two months of attendance, none on approved leave days', () => {
    const cur = dates.currentPeriod();
    const periods = db.prepare("SELECT DISTINCT substr(att_date, 1, 7) AS p FROM ATTENDANCE ORDER BY p").all().map((r) => r.p);
    assert.deepEqual(periods, [prevPeriod(cur, 2), prevPeriod(cur, 1)]);
    const clash = db.prepare(
      `SELECT COUNT(*) AS n FROM ATTENDANCE a JOIN LEAVE_APPLICATION l
         ON l.employee_id = a.employee_id AND l.leave_status = 'Approved' AND a.att_date BETWEEN l.leave_start AND l.leave_end`
    ).get().n;
    assert.equal(clash, 0);
  });

  test('one processed payroll month with a payslip for every line (BR-20)', () => {
    assert.equal(first.demo.payroll.failed, 0);
    assert.equal(afterFirst.PAYROLL, 10);
    assert.equal(afterFirst.PAYSLIP, 10);
    const mismatch = db.prepare(
      `SELECT COUNT(*) AS n FROM PAYSLIP s JOIN PAYROLL p ON p.payroll_id = s.payroll_id
        WHERE s.gross_salary <> p.gross_salary OR s.total_deductions <> p.total_deductions OR s.net_salary <> p.net_salary`
    ).get().n;
    assert.equal(mismatch, 0);
  });

  test('running the seed again changes nothing (idempotent)', () => {
    const second = seedAll(db, PASSWORD);
    assert.deepEqual(counts(db), afterFirst);
    assert.deepEqual(second.users, { employees: 0, accounts: 0 });
    assert.equal(second.demo.attendance, 0);
    assert.equal(second.demo.payroll, null);
  });
});
