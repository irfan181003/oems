'use strict';
// Process 0.6 — UC-13 · BR-20, BR-21 (+ BR-15 own payslips, A-4) · NFR-13
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');

const { db, app } = setup();
const tokens = {};
let PO;

function prevPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
const P = prevPeriod(dates.currentPeriod());
const line = (id) => db.prepare('SELECT * FROM PAYROLL WHERE employee_id = ? AND pay_period = ?').get(id, P);

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
  PO = tokens.PAYROLL;
  const ins = db.prepare("INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time, att_status, recorded_ts) VALUES (?, ?, ?, '09:00', 'Present', ?)");
  for (let dday = 1; dday <= 22; dday += 1) {
    ins.run(`ATT${String(700 + dday).padStart(9, '0')}`, 'EMP00005', `${P}-${String(dday).padStart(2, '0')}`, dates.nowTs());
  }
  const r = await request(app).post('/api/payroll/run').set(bearer(PO)).send({
    pay_period: P,
    working_days: 22,
    lines: [
      { employee_id: 'EMP00005', allowances: 1500, other_deductions: 500 },
      { employee_id: 'EMP00006' },
      { employee_id: 'EMP00007' },
    ],
  });
  assert.equal(r.body.data.employees_processed, 3);
  const setStatus = (id, s) => request(app).patch(`/api/payroll/records/${line(id).payroll_id}/status`).set(bearer(PO)).send({ payroll_status: s });
  assert.equal((await setStatus('EMP00006', 'Paid')).status, 200);
  assert.equal((await setStatus('EMP00007', 'On Hold')).status, 200);
});

const generate = (body, token = PO) => request(app).post('/api/payslips/generate').set(bearer(token)).send(body);

describe('BR-21 payslip after processing', () => {
  let result;
  before(async () => {
    const r = await generate({ pay_period: P });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    result = r.body.data;
  });

  test('generated for Processed and Paid lines; refused for On Hold', () => {
    assert.deepEqual(result.generated.map((g) => g.employee_id), ['EMP00005', 'EMP00006']);
    assert.deepEqual(result.refused.map((g) => g.employee_id), ['EMP00007']);
    assert.match(result.refused[0].reason, /On Hold/);
    assert.equal(result.payslip_count, 2);
    for (const g of result.generated) assert.match(g.payslip_id, /^PS\d{10}$/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM PAYSLIP WHERE employee_id = ?').get('EMP00007').n, 0);
  });

  test('employee without a payroll line for the period is refused', async () => {
    const r = await generate({ pay_period: P, employee_ids: ['EMP00008'] });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.payslip_count, 0);
    assert.match(r.body.data.refused[0].reason, /No payroll line/);
  });

  test('only the Payroll Officer generates payslips; input validated', async () => {
    for (const k of ['HR', 'FINANCE', 'EMP', 'RECRUITMENT']) assert.equal((await generate({ pay_period: P }, tokens[k])).status, 403, k);
    assert.equal((await generate({ pay_period: '2026/01' })).status, 422);
    assert.equal((await generate({ pay_period: P, employee_ids: ['EMP00005', 'EMP00005'] })).status, 422);
  });
});

describe('BR-20 payslip matches payroll', () => {
  test('payslip amounts equal the stored payroll line', () => {
    for (const id of ['EMP00005', 'EMP00006']) {
      const p = line(id);
      const s = db.prepare('SELECT * FROM PAYSLIP WHERE payroll_id = ?').get(p.payroll_id);
      assert.equal(s.employee_id, p.employee_id);
      assert.equal(s.pay_period, p.pay_period);
      assert.equal(s.gross_salary, p.gross_salary);
      assert.equal(s.total_deductions, p.total_deductions);
      assert.equal(s.net_salary, p.net_salary);
      assert.equal(s.generated_date, dates.today());
    }
  });

  test('a repeated request returns the existing payslip (one per payroll line)', async () => {
    const before = db.prepare('SELECT payslip_id FROM PAYSLIP WHERE employee_id = ?').get('EMP00005').payslip_id;
    const r = await generate({ pay_period: P, employee_ids: ['EMP00005'] });
    assert.equal(r.body.data.newly_generated, 0);
    assert.equal(r.body.data.payslip_count, 1);
    assert.equal(r.body.data.existing[0].payslip_id, before);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM PAYSLIP WHERE employee_id = ?').get('EMP00005').n, 1);
  });

  test('detail view shows the DS-43 breakdown from the same payroll line', async () => {
    const id = db.prepare('SELECT payslip_id FROM PAYSLIP WHERE employee_id = ?').get('EMP00005').payslip_id;
    const r = await request(app).get(`/api/payslips/${id}`).set(bearer(PO));
    assert.equal(r.status, 200);
    const p = line('EMP00005');
    const s = r.body.data;
    for (const k of ['basic_salary', 'allowances', 'gross_salary', 'tax_deduction', 'pf_deduction', 'total_deductions', 'net_salary']) {
      assert.equal(s[k], p[k], k);
    }
    assert.equal(s.other_deductions, 500);
    assert.equal(s.earned_basic + s.allowances, s.gross_salary);
    assert.equal(s.employee_name, 'Sneha Das');
  });
});

describe('payslip access (NFR-13, BR-15, A-4)', () => {
  test('owner and Payroll Officer may read and download; others 403', async () => {
    const id = db.prepare('SELECT payslip_id FROM PAYSLIP WHERE employee_id = ?').get('EMP00005').payslip_id;
    assert.equal((await request(app).get(`/api/payslips/${id}`).set(bearer(tokens.EMP))).status, 200);
    for (const k of ['EMP2', 'HR', 'FINANCE']) {
      assert.equal((await request(app).get(`/api/payslips/${id}`).set(bearer(tokens[k]))).status, 403, k);
      assert.equal((await request(app).get(`/api/payslips/${id}/download`).set(bearer(tokens[k]))).status, 403, k);
    }
    const pdf = await request(app).get(`/api/payslips/${id}/download`).set(bearer(tokens.EMP)).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.match(pdf.headers['content-disposition'], new RegExp(`${id}\\.pdf`));
    assert.equal(pdf.body.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.body.length > 1000);
    assert.equal((await request(app).get('/api/payslips/PS9999999999').set(bearer(PO))).status, 404);
  });

  test('payslip list is for the Payroll Officer; the employee sees own payslips via /salary/me', async () => {
    const list = await request(app).get(`/api/payslips?pay_period=${P}`).set(bearer(PO));
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 2);
    assert.equal((await request(app).get('/api/payslips').set(bearer(tokens.EMP))).status, 403);
    const me = await request(app).get('/api/salary/me').set(bearer(tokens.EMP));
    assert.deepEqual(me.body.data.payslips.map((s) => s.pay_period), [P]);
  });
});
