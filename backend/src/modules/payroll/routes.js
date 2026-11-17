'use strict';
// Process 0.5 Manage Payroll — UC-12, UC-14, UC-15 · FR-12, FR-14, FR-15 · NFR-12, NFR-14, NFR-15 (Payroll Officer)
const express = require('express');
const { getDb } = require('../../db');
const dates = require('../../lib/dates');
const money = require('../../lib/money');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { auditFailures } = require('../../middleware/audit');
const service = require('./service');
const store = require('./store');

const { z } = f;
const router = express.Router();
// BR-30: payroll records are visible only to the Payroll Officer (Finance sees payroll only through reports)
// ASSUMPTION A-9: Assignment 2 links UC-12/UC-14 to no actor; the DFD (DS-31) has the Payroll Officer
// drive Process 0.5, so the Payroll Officer runs payroll and changes payroll status.
router.use(authenticate, requireRole('Payroll Officer'));

const payPeriod = f.text('Pay period').regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pay period must be a valid month in YYYY-MM format');

// DS-31 Payroll Input Data (DE-074 ... DE-077)
const lineSchema = z.strictObject({
  employee_id: f.id('EMPLOYEE', 'Employee ID'),
  allowances: f.amount('Allowances').optional(), // BR-28: >= 0
  other_deductions: f.amount('Other deductions').optional(), // BR-28: >= 0
});
const runBody = z
  .strictObject({
    pay_period: payPeriod,
    working_days: z.number({ error: () => 'Working days is required' }).int('Working days must be a whole number'),
    lines: z.array(lineSchema).min(1, 'Provide at least one line, or omit lines to process every Active employee').max(10000).optional(),
  })
  .superRefine((b, ctx) => {
    if (typeof b.pay_period === 'string' && /^\d{4}-\d{2}$/.test(b.pay_period)) {
      // DE-074: not in the future
      if (b.pay_period > dates.currentPeriod()) {
        ctx.addIssue({ code: 'custom', path: ['pay_period'], message: 'Pay period must not be in the future' });
      }
      // DE-075: between 1 and the days in the month
      const max = dates.daysInMonth(b.pay_period);
      if (Number.isInteger(b.working_days) && (b.working_days < 1 || b.working_days > max)) {
        ctx.addIssue({ code: 'custom', path: ['working_days'], message: `Working days must be between 1 and ${max}` });
      }
    }
    if (b.lines) {
      const seen = new Set();
      b.lines.forEach((l, idx) => {
        if (seen.has(l.employee_id)) ctx.addIssue({ code: 'custom', path: ['lines', idx, 'employee_id'], message: 'Duplicate employee in lines' });
        seen.add(l.employee_id);
      });
    }
  });

const recordsQuery = z.strictObject({ pay_period: payPeriod.optional(), employee_id: f.id('EMPLOYEE', 'Employee ID').optional() });
const idParams = z.strictObject({ payroll_id: f.id('PAYROLL', 'Payroll ID') });
const statusBody = z.strictObject({ payroll_status: f.enumOf('Payroll status', ['Processed', 'Paid', 'On Hold']) });

// UC-14, UC-12 | FR-14, FR-12 | Process 0.5.1, 0.5.2, 0.5.3 | BR-16, BR-17, BR-18, BR-19, BR-28 | NFR-12, NFR-14
router.post('/run', auditFailures('PAYROLL', 'RUN'), validate({ body: runBody }), (req, res) => {
  const lines = req.body.lines
    ? req.body.lines.map((l) => ({
        employee_id: l.employee_id,
        allowances_paise: money.toPaise(l.allowances ?? 0),
        other_deductions_paise: money.toPaise(l.other_deductions ?? 0),
      }))
    : null;
  const result = service.runPayroll(getDb(), req.user, { pay_period: req.body.pay_period, working_days: req.body.working_days, lines });
  return ok(res, {
    reference_id: result.pay_period,
    message: `Payroll ${result.pay_period}: ${result.employees_processed} processed, ${result.skipped.length} skipped, ${result.failed.length} failed`,
    data: result,
  });
});

// UC-15 | FR-15 | Process 0.5.4 | BR-30 | NFR-15 — DS-40 Payroll Record View
router.get('/records', validate({ query: recordsQuery }), (req, res) => {
  const rows = store.list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} payroll record(s)`, data: rows });
});

// UC-15 | FR-15 | Process 0.5.4 | BR-30 | NFR-15
router.get('/records/:payroll_id', validate({ params: idParams }), (req, res) => {
  const r = service.getRecord(getDb(), req.params.payroll_id);
  return ok(res, { reference_id: r.payroll_id, message: 'Payroll record', data: r });
});

// UC-14 | FR-14 | Process 0.5.3 | NFR-14 — status only; amounts are never editable
router.patch(
  '/records/:payroll_id/status',
  auditFailures('PAYROLL', 'STATUS'),
  validate({ params: idParams, body: statusBody }),
  (req, res) => {
    const r = service.setStatus(getDb(), req.user, req.params.payroll_id, req.body.payroll_status);
    return ok(res, { reference_id: r.payroll_id, message: `Payroll record ${r.payroll_status}`, data: r });
  }
);

module.exports = router;
