'use strict';
// UC-11 View Salary · FR-11 · NFR-11 · BR-15 Salary Confidentiality (Process 0.5.4 / 0.6; ASSUMPTION A-4)
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole, requireSelfService } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { notFound } = require('../../middleware/errors');

const { z } = f;
const router = express.Router();
router.use(authenticate);

const PERIOD_COLUMNS = 'payroll_id, pay_period, gross_salary, total_deductions, net_salary, payroll_status';

// UC-11 | FR-11 | Process 0.5.4, 0.6 | BR-15 | NFR-11 | ASSUMPTION A-4, A-7 — own salary, payroll lines and payslips only
router.get('/me', requireSelfService, validate({ query: z.strictObject({}) }), (req, res) => {
  const db = getDb();
  const e = db
    .prepare('SELECT employee_id, employee_name, department, designation, basic_salary FROM EMPLOYEE WHERE employee_id = ?')
    .get(req.user.employee_id);
  if (!e) throw notFound('Employee record not found');
  const payroll = db
    .prepare(`SELECT ${PERIOD_COLUMNS}, days_present, leave_days, basic_salary AS period_basic_salary, allowances, tax_deduction, pf_deduction
                FROM PAYROLL WHERE employee_id = ? ORDER BY pay_period DESC`)
    .all(e.employee_id);
  const payslips = db
    .prepare('SELECT payslip_id, payroll_id, pay_period, gross_salary, total_deductions, net_salary, generated_date FROM PAYSLIP WHERE employee_id = ? ORDER BY pay_period DESC')
    .all(e.employee_id);
  return ok(res, { reference_id: e.employee_id, message: 'Salary details', data: { ...e, payroll, payslips } });
});

const listQuery = z.strictObject({
  employee_id: f.id('EMPLOYEE', 'Employee ID').optional(),
  pay_period: f.text('Pay period').regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pay period must be a valid month in YYYY-MM format').optional(),
});

// UC-11 | FR-11 | Process 0.5.4 | BR-15 | NFR-11 — HR Manager, Payroll Officer, Finance Manager (no bank data)
router.get('/', requireRole('HR Manager', 'Payroll Officer', 'Finance Manager'), validate({ query: listQuery }), (req, res) => {
  const db = getDb();
  const { employee_id: employeeId, pay_period: payPeriod } = req.validQuery;
  const employees = employeeId
    ? db.prepare('SELECT employee_id, employee_name, department, basic_salary FROM EMPLOYEE WHERE employee_id = ?').all(employeeId)
    : db.prepare('SELECT employee_id, employee_name, department, basic_salary FROM EMPLOYEE ORDER BY employee_id').all();
  if (employeeId && !employees.length) throw notFound(`Employee ${employeeId} not found`);

  const periodsStmt = payPeriod
    ? db.prepare(`SELECT ${PERIOD_COLUMNS} FROM PAYROLL WHERE employee_id = ? AND pay_period = ? ORDER BY pay_period DESC`)
    : db.prepare(`SELECT ${PERIOD_COLUMNS} FROM PAYROLL WHERE employee_id = ? ORDER BY pay_period DESC`);
  const data = employees.map((e) => ({
    ...e,
    periods: payPeriod ? periodsStmt.all(e.employee_id, payPeriod) : periodsStmt.all(e.employee_id),
  }));
  return ok(res, { message: `${data.length} employee salary record(s)`, data });
});

module.exports = router;
