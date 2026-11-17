'use strict';
// Process 0.5.2 Calculate Salary — UC-12 · BR-16, BR-17, BR-28 · NFR-12 (pure function, no DB)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { calculateSalary, CalculationError, roundDiv } = require('../src/modules/payroll/calculator');
const RULES = require('../src/modules/payroll/rules');

const rs = (n) => Math.round(n * 100); // rupees -> paise for readable test inputs
const input = (o) => ({
  basic_salary_paise: rs(o.basic),
  working_days: o.wd,
  days_present: o.dp,
  paid_leave_days: o.pl ?? 0,
  allowances_paise: rs(o.allow ?? 0),
  other_deductions_paise: rs(o.other ?? 0),
});

describe('BR-16 reproducible salary calculation', () => {
  test('same inputs 1000 times give exactly the same output', () => {
    const i = input({ basic: 48000, wd: 22, dp: 18, pl: 1, allow: 1234.56, other: 99.99 });
    const first = calculateSalary(i);
    for (let n = 0; n < 1000; n += 1) assert.deepEqual(calculateSalary({ ...i }), first);
  });

  test('calculator is pure: no database, clock, randomness or I/O dependencies', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/modules/payroll/calculator.js'), 'utf8');
    const requires = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
    assert.deepEqual(requires, ['./rules']);
    for (const banned of ['Date', 'Math.random', 'process.', 'crypto']) {
      assert.ok(!new RegExp(`\\b${banned.replace('.', '\\.')}`).test(src.replace(/\/\/.*$/gm, '')), `uses ${banned}`);
    }
  });

  test('integer paise in, integer paise out (no floating point drift)', () => {
    const r = calculateSalary(input({ basic: 33333.33, wd: 23, dp: 17, pl: 2, allow: 0.01, other: 0.01 }));
    for (const v of Object.values(r)) assert.ok(Number.isInteger(v));
  });
});

describe('BR-17 salary formula — worked examples (A-6 constants: PF 12 %, tax slabs 0/5/10 %)', () => {
  test('constants are the documented proposal', () => {
    assert.equal(RULES.PF_RATE_BP, 1200);
    assert.deepEqual(RULES.TAX_SLABS.map((s) => s.rateBp), [0, 500, 1000]);
    assert.deepEqual([...RULES.PAID_LEAVE_TYPES], ['Casual', 'Sick', 'Earned']);
  });

  test('full attendance (present + paid leave = working days), 5 % slab', () => {
    // gross = 30000 + 2000 = 32000; tax 5 % = 1600; pf 12 % of 30000 = 3600; total = 1600 + 3600 + 500 = 5700
    const r = calculateSalary(input({ basic: 30000, wd: 22, dp: 20, pl: 2, allow: 2000, other: 500 }));
    assert.equal(r.unpaid_absence_days, 0);
    assert.equal(r.gross_paise, rs(32000));
    assert.equal(r.tax_paise, rs(1600));
    assert.equal(r.pf_paise, rs(3600));
    assert.equal(r.total_deductions_paise, rs(5700));
    assert.equal(r.net_paise, rs(26300));
  });

  test('unpaid absence reduces gross (loss of pay is NOT deducted again)', () => {
    // unpaid = 22 - 18 - 1 = 3; earned = 48000 x 19/22 = 41454.5454.. -> 41454.55
    // tax 5 % = 2072.7275 -> 2072.73; pf 12 % = 4974.546 -> 4974.55; total = 7047.28; net = 34407.27
    const r = calculateSalary(input({ basic: 48000, wd: 22, dp: 18, pl: 1 }));
    assert.equal(r.unpaid_absence_days, 3);
    assert.equal(r.earned_basic_paise, 4145455);
    assert.equal(r.gross_paise, 4145455);
    assert.equal(r.tax_paise, 207273);
    assert.equal(r.pf_paise, 497455);
    assert.equal(r.total_deductions_paise, 704728);
    assert.equal(r.net_paise, 3440727);
    assert.equal(r.total_deductions_paise, r.tax_paise + r.pf_paise + r.other_deductions_paise);
  });

  test('10 % slab above 50,000', () => {
    // gross = 85000 + 5000 = 90000; tax 9000; pf 10200; net 70800
    const r = calculateSalary(input({ basic: 85000, wd: 20, dp: 20, allow: 5000 }));
    assert.equal(r.tax_paise, rs(9000));
    assert.equal(r.pf_paise, rs(10200));
    assert.equal(r.net_paise, rs(70800));
  });

  test('slab boundaries: 25,000.00 -> 0 %; 25,000.01 -> 5 %; 50,000.00 -> 5 %; 50,000.01 -> 10 %', () => {
    const t = (gross) => calculateSalary(input({ basic: 10000, wd: 1, dp: 1, allow: gross - 10000 })).tax_paise;
    assert.equal(t(25000), 0);
    assert.equal(t(25000.01), roundDiv(rs(25000.01) * 500, 10000));
    assert.equal(t(50000), rs(2500));
    assert.equal(t(50000.01), roundDiv(rs(50000.01) * 1000, 10000));
  });

  test('more days present than working days does not raise pay above basic', () => {
    const r = calculateSalary(input({ basic: 20000, wd: 20, dp: 23 }));
    assert.equal(r.unpaid_absence_days, 0);
    assert.equal(r.earned_basic_paise, rs(20000));
  });

  test('no attendance and no paid leave: gross = allowances only', () => {
    const r = calculateSalary(input({ basic: 40000, wd: 22, dp: 0, allow: 1500 }));
    assert.equal(r.unpaid_absence_days, 22);
    assert.equal(r.earned_basic_paise, 0);
    assert.equal(r.gross_paise, rs(1500));
    assert.equal(r.pf_paise, 0);
  });

  test('round half-up to the paisa', () => {
    assert.equal(roundDiv(5, 2), 3); // 2.5 -> 3
    assert.equal(roundDiv(7, 4), 2); // 1.75 -> 2
    assert.equal(roundDiv(5, 4), 1); // 1.25 -> 1
  });
});

describe('BR-28 non-negative amounts / BR-17 run stopped for that employee', () => {
  test('negative net -> CalculationError', () => {
    assert.throws(() => calculateSalary(input({ basic: 10000, wd: 20, dp: 20, other: 20000 })), CalculationError);
  });

  test('invalid inputs -> CalculationError (negative, fractional, zero basic or zero working days, missing)', () => {
    const base = input({ basic: 10000, wd: 20, dp: 20 });
    for (const bad of [
      { allowances_paise: -1 },
      { other_deductions_paise: -1 },
      { basic_salary_paise: 0 },
      { working_days: 0 },
      { days_present: 1.5 },
      { paid_leave_days: undefined },
    ]) {
      assert.throws(() => calculateSalary({ ...base, ...bad }), CalculationError, JSON.stringify(bad));
    }
    assert.throws(() => calculateSalary(null), CalculationError);
  });
});
