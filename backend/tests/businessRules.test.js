'use strict';
// Definition of done (section 13): every business rule BR-01 ... BR-30 has at least one test.
// The tests themselves live in the module test files and are named after the rule they cover;
// `npm test` runs them all, so a missing or failing rule test fails the suite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RULES = {
  'BR-01': 'Duplicate Attendance Prevention', 'BR-02': 'Check-out After Check-in', 'BR-03': 'Own Attendance Only',
  'BR-04': 'Leave Mandatory Fields', 'BR-05': 'Leave Date Range', 'BR-06': 'Leave Decision Authority',
  'BR-07': 'Leave Status Life Cycle', 'BR-08': 'Self-service Profile Fields', 'BR-09': 'Unique Employee Identifier',
  'BR-10': 'Registration Mandatory Data', 'BR-11': 'Record Change Traceability', 'BR-12': 'Vacancy Data Control',
  'BR-13': 'Interview Slot Conflict Prevention', 'BR-14': 'Offer Eligibility', 'BR-15': 'Salary Confidentiality',
  'BR-16': 'Reproducible Salary Calculation', 'BR-17': 'Salary Formula', 'BR-18': 'Approved Leave Only',
  'BR-19': 'One Payroll Line per Period', 'BR-20': 'Payslip Matches Payroll', 'BR-21': 'Payslip After Processing',
  'BR-22': 'HR Report Scope', 'BR-23': 'Financial Report Access', 'BR-24': 'Retirement Plan Control',
  'BR-25': 'Retirement Date Validity', 'BR-26': 'Role-Based Access Control', 'BR-27': 'Authentication and Session Timeout',
  'BR-28': 'Non-negative Amounts', 'BR-29': 'Offer Letter Accuracy', 'BR-30': 'Payroll Records Access',
};

test('every BR-01 ... BR-30 is named in at least one describe()/test() title', () => {
  const dir = __dirname;
  const covered = new Map();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.test.js') && f !== path.basename(__filename))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/(?:describe|test)\(\s*[`'"]([^`'"]*)[`'"]/g)) {
      for (const br of m[1].match(/BR-\d{2}/g) || []) {
        if (!covered.has(br)) covered.set(br, new Set());
        covered.get(br).add(file);
      }
    }
  }
  const missing = Object.keys(RULES).filter((br) => !covered.has(br));
  assert.deepEqual(missing, [], `rules without a named test: ${missing.join(', ')}`);
});
