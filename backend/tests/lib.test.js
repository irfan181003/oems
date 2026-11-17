'use strict';
// Unit tests for src/lib (IDs, dates, money, departments) and the schema.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');
const ids = require('../src/lib/ids');
const dates = require('../src/lib/dates');
const money = require('../src/lib/money');
const { DEPARTMENTS, isDepartment } = require('../src/lib/departments');

const { db } = setup();

describe('ids (Data Dictionary section 7 formats)', () => {
  test('formats match prefix + zero-padded digits and fit the column length', () => {
    const expected = {
      EMPLOYEE: 'EMP00007', ATTENDANCE: 'ATT000000007', LEAVE_APPLICATION: 'LV00000007', VACANCY: 'VAC00007',
      CANDIDATE: 'CAN00007', INTERVIEW_SCHEDULE: 'INT0000007', OFFER: 'OFR0000007', PAYROLL: 'PAY000000007',
      PAYSLIP: 'PS0000000007', RETIREMENT_PLAN: 'RP000007',
    };
    for (const [kind, id] of Object.entries(expected)) {
      assert.equal(ids.formatId(kind, 7), id);
      assert.match(id, ids.idPattern(kind));
    }
    assert.match('EMP00001', /^EMP\d{5}$/);
    assert.throws(() => ids.formatId('EMPLOYEE', 100000));
    assert.throws(() => ids.formatId('EMPLOYEE', 0));
  });

  test('nextId continues after the highest existing ID', () => {
    assert.equal(ids.nextId(db, 'EMPLOYEE'), 'EMP00011'); // 10 seeded employees
    assert.equal(ids.nextId(db, 'ATTENDANCE'), 'ATT000000001');
  });
});

describe('dates (server clock in APP_TIMEZONE)', () => {
  test('today/nowTime/nowTs use Asia/Kolkata', () => {
    const d = new Date('2026-01-31T19:00:00Z'); // 00:30 next day in IST
    assert.equal(dates.today(d), '2026-02-01');
    assert.equal(dates.nowTime(d), '00:30:00');
    assert.equal(dates.nowTs(d), '2026-02-01 00:30:00');
    assert.equal(dates.currentPeriod(d), '2026-02');
  });

  test('date helpers', () => {
    assert.equal(dates.isValidIsoDate('2024-02-29'), true);
    assert.equal(dates.isValidIsoDate('2023-02-29'), false);
    assert.equal(dates.isValidIsoDate('2024-2-1'), false);
    assert.equal(dates.daysInclusive('2026-03-01', '2026-03-01'), 1);
    assert.equal(dates.daysInclusive('2026-03-30', '2026-04-02'), 4);
    assert.equal(dates.addYears('2000-05-10', 18), '2018-05-10');
    assert.equal(dates.addYears('2004-02-29', 18), '2022-02-28');
    assert.equal(dates.daysInMonth('2024-02'), 29);
    assert.deepEqual(dates.periodBounds('2026-04'), { start: '2026-04-01', end: '2026-04-30' });
  });
});

describe('money (integer paise)', () => {
  test('toPaise / fromPaise are exact', () => {
    assert.equal(money.toPaise('1234.5'), 123450);
    assert.equal(money.toPaise(0.1), 10);
    assert.equal(money.toPaise('1.00'), 100);
    assert.equal(money.toPaise(19.99), 1999);
    assert.equal(money.fromPaise(123456), 1234.56);
    assert.throws(() => money.toPaise('-1'));
    assert.throws(() => money.toPaise('1.234'));
    assert.equal(money.isMoney('10.25'), true);
    assert.equal(money.isMoney(-5), false);
  });
});

describe('ASSUMPTION A-8 departments', () => {
  test('fixed list', () => {
    assert.deepEqual([...DEPARTMENTS], ['HR', 'Finance', 'Engineering', 'Sales', 'Operations', 'Recruitment', 'Payroll']);
    assert.equal(isDepartment('HR'), true);
    assert.equal(isDepartment('Marketing'), false);
  });
});

describe('schema (Data Dictionary section 8)', () => {
  test('all 10 tables + 3 supporting tables exist with foreign keys enforced', () => {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    for (const t of ['EMPLOYEE', 'ATTENDANCE', 'LEAVE_APPLICATION', 'VACANCY', 'CANDIDATE', 'INTERVIEW_SCHEDULE', 'OFFER',
      'PAYROLL', 'PAYSLIP', 'RETIREMENT_PLAN', 'USER_ACCOUNT', 'SESSION', 'AUDIT_LOG']) {
      assert.ok(names.includes(t), `missing table ${t}`);
    }
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  });

  test('CHECK constraints reject invalid values', () => {
    assert.throws(() => db.prepare("UPDATE EMPLOYEE SET gender = 'X' WHERE employee_id = 'EMP00005'").run(), /CHECK/);
    assert.throws(() => db.prepare("UPDATE EMPLOYEE SET basic_salary = 0 WHERE employee_id = 'EMP00005'").run(), /CHECK/);
    assert.throws(() => db.prepare("UPDATE EMPLOYEE SET employment_status = 'Fired' WHERE employee_id = 'EMP00005'").run(), /CHECK/);
    assert.throws(
      () => db.prepare("INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time) VALUES ('ATT000000001','EMP99999','2026-01-01','09:00:00')").run(),
      /FOREIGN KEY/
    );
  });

  test('A-1 composite uniqueness: one attendance row per employee per date', () => {
    const ins = db.prepare('INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time) VALUES (?,?,?,?)');
    db.transaction(() => {
      ins.run('ATT000000901', 'EMP00005', '2026-01-05', '09:00:00');
      ins.run('ATT000000902', 'EMP00005', '2026-01-06', '09:00:00'); // another date OK (no UNIQUE on employee_id alone)
      assert.throws(() => ins.run('ATT000000903', 'EMP00005', '2026-01-05', '10:00:00'), /UNIQUE/);
    })();
    db.prepare("DELETE FROM ATTENDANCE WHERE attendance_id IN ('ATT000000901','ATT000000902')").run();
  });
});
