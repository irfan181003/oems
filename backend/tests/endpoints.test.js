'use strict';
// Definition of done (section 13): every endpoint in section 6 exists and is protected by its role gate.
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { setup, login, bearer, request, USERS } = require('./helpers');

const { app } = setup();

// [method, path, roles allowed (role gate), or 'self' for the Employee self-service gate, or 'any' for authenticated]
const ENDPOINTS = [
  ['post', '/api/attendance/check-in', 'self'],
  ['post', '/api/attendance/check-out', 'self'],
  ['get', '/api/attendance/me', 'self'],
  ['get', '/api/attendance', ['HR Manager']],
  ['post', '/api/leaves', 'self'],
  ['get', '/api/leaves/me', 'self'],
  ['get', '/api/leaves', ['HR Manager']],
  ['get', '/api/leaves/LV00000001', 'any'],
  ['patch', '/api/leaves/LV00000001/decision', ['HR Manager']],
  ['get', '/api/profile/me', 'self'],
  ['patch', '/api/profile/me', 'self'],
  ['post', '/api/employees', ['HR Manager']],
  ['get', '/api/employees', ['HR Manager']],
  ['get', '/api/employees/EMP00001', ['HR Manager']],
  ['patch', '/api/employees/EMP00001', ['HR Manager']],
  ['post', '/api/retirement-plans', ['HR Manager']],
  ['get', '/api/retirement-plans', ['HR Manager']],
  ['get', '/api/retirement-plans/RP000001', ['HR Manager']],
  ['patch', '/api/retirement-plans/RP000001', ['HR Manager']],
  ['post', '/api/vacancies', ['Recruitment Officer']],
  ['get', '/api/vacancies', ['Recruitment Officer']],
  ['get', '/api/vacancies/VAC00001', ['Recruitment Officer']],
  ['patch', '/api/vacancies/VAC00001', ['Recruitment Officer']],
  ['post', '/api/vacancies/VAC00001/close', ['Recruitment Officer']],
  ['post', '/api/candidates', ['Recruitment Officer']],
  ['get', '/api/candidates', ['Recruitment Officer']],
  ['post', '/api/interviews', ['Recruitment Officer']],
  ['get', '/api/interviews', ['Recruitment Officer']],
  ['get', '/api/interviews/INT0000001', ['Recruitment Officer']],
  ['patch', '/api/interviews/INT0000001', ['Recruitment Officer']],
  ['post', '/api/offers', ['Recruitment Officer']],
  ['get', '/api/offers', ['Recruitment Officer']],
  ['get', '/api/offers/OFR0000001', ['Recruitment Officer']],
  ['get', '/api/offers/OFR0000001/letter', ['Recruitment Officer']],
  ['patch', '/api/offers/OFR0000001/status', ['Recruitment Officer']],
  ['post', '/api/payroll/run', ['Payroll Officer']],
  ['get', '/api/payroll/records', ['Payroll Officer']],
  ['get', '/api/payroll/records/PAY000000001', ['Payroll Officer']],
  ['patch', '/api/payroll/records/PAY000000001/status', ['Payroll Officer']],
  ['get', '/api/salary/me', 'self'],
  ['get', '/api/salary', ['HR Manager', 'Payroll Officer', 'Finance Manager']],
  ['post', '/api/payslips/generate', ['Payroll Officer']],
  ['get', '/api/payslips', ['Payroll Officer']],
  ['get', '/api/payslips/PS0000000001', 'any'],
  ['get', '/api/payslips/PS0000000001/download', 'any'],
  ['get', '/api/reports/hr', ['HR Manager']],
  ['get', '/api/reports/financial', ['Finance Manager']],
];

const ROLE_USERS = {
  Employee: USERS.EMP,
  'HR Manager': USERS.HR,
  'Recruitment Officer': USERS.RECRUITMENT,
  'Payroll Officer': USERS.PAYROLL,
  'Finance Manager': USERS.FINANCE,
};
const tokens = {};
before(async () => {
  for (const [role, id] of Object.entries(ROLE_USERS)) tokens[role] = await login(app, id);
});

describe('section 6 endpoint inventory', () => {
  test('GET /api/health is public', async () => {
    assert.equal((await request(app).get('/api/health')).status, 200);
  });

  for (const [method, url, allowed] of ENDPOINTS) {
    test(`${method.toUpperCase()} ${url} exists, needs login, and enforces its role gate`, async () => {
      const anon = await request(app)[method](url);
      assert.equal(anon.status, 401, 'login required (BR-27)');
      if (allowed === 'any') return; // record-level check, tested in the module tests
      const permitted = allowed === 'self' ? ['Employee'] : allowed;
      for (const role of Object.keys(ROLE_USERS)) {
        const r = await request(app)[method](url).set(bearer(tokens[role])).send({});
        if (permitted.includes(role)) assert.notEqual(r.status, 403, `${role} should pass the gate`);
        else assert.equal(r.status, 403, `${role} should be denied`);
        assert.ok(!(r.status === 404 && /^No route/.test(r.body.error_message || '')), 'route exists');
      }
    });
  }

  test('Director, UC-08 and UC-18 do not exist (removed in Assignment 2)', async () => {
    const r = await request(app).get('/api/reports/organization').set(bearer(tokens['HR Manager']));
    assert.equal(r.status, 404);
    assert.ok(!require('../src/config').ALL_ROLES.includes('Director'));
  });

  test('every route handler carries a traceability tag (UC/FR/Process)', () => {
    const dir = path.join(__dirname, '../src/modules');
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name))));
    walk(dir);
    const untagged = [];
    let routes = 0;
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^router\.(get|post|patch|put|delete)\(/.test(line.trim())) {
          routes += 1;
          const prev = lines.slice(Math.max(0, i - 3), i).join('\n');
          if (!/\/\/ .*(UC-\d+|NFR-2[12]|ASSUMPTION A-\d)/.test(prev)) untagged.push(`${path.relative(dir, file)}:${i + 1}`);
        }
      });
    }
    assert.ok(routes >= ENDPOINTS.length, `found only ${routes} route handlers`);
    assert.deepEqual(untagged, []);
  });
});
