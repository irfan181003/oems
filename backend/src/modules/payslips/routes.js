'use strict';
// Process 0.6 Generate Payslips — UC-13 · FR-13 · NFR-13 (Payroll Officer; owning Employee may read own — A-4)
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole, deniedError, isSelfServiceUser } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { auditFailures } = require('../../middleware/audit');
const { asyncHandler, notFound } = require('../../middleware/errors');
const service = require('./service');
const { renderPayslipPdf } = require('./pdf');

const { z } = f;
const router = express.Router();
router.use(authenticate);

const payPeriod = f.text('Pay period').regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Pay period must be a valid month in YYYY-MM format');
const generateBody = z.strictObject({
  pay_period: payPeriod,
  employee_ids: z
    .array(f.id('EMPLOYEE', 'Employee ID'))
    .min(1, 'Provide at least one employee ID, or omit employee_ids for every payroll line of the period')
    .max(10000)
    .refine((a) => new Set(a).size === a.length, 'Duplicate employee IDs')
    .optional(),
});
const listQuery = z.strictObject({ pay_period: payPeriod.optional(), employee_id: f.id('EMPLOYEE', 'Employee ID').optional() });
const idParams = z.strictObject({ payslip_id: f.id('PAYSLIP', 'Payslip ID') });

/** Payroll Officer, or the employee who owns the payslip (self-service, A-4 / A-7). */
function loadForReader(req) {
  const p = service.getDetail(getDb(), req.params.payslip_id);
  const isOfficer = req.user.role === 'Payroll Officer';
  const isOwner = p && isSelfServiceUser(req.user) && p.employee_id === req.user.employee_id;
  if (!isOfficer && !isOwner) throw deniedError(req, 'not Payroll Officer and not the owner', req.params.payslip_id);
  if (!p) throw notFound(`Payslip ${req.params.payslip_id} not found`);
  return p;
}

// UC-13 | FR-13 | Process 0.6.1, 0.6.2, 0.6.3 | BR-20, BR-21 | NFR-13 — DS-45 Payslip Generation Status
// ASSUMPTION A-9: UC-13 has no actor in Assignment 2; the Payroll Officer generates payslips (DFD 0.6).
router.post('/generate', requireRole('Payroll Officer'), auditFailures('PAYSLIP', 'GENERATE'), validate({ body: generateBody }), (req, res) => {
  const r = service.generate(getDb(), req.user, req.body);
  return ok(res, {
    reference_id: r.pay_period,
    message: `Payslips ${r.pay_period}: ${r.newly_generated} generated, ${r.existing.length} already existed, ${r.refused.length} refused`,
    data: r,
  });
});

// UC-13 | FR-13 | Process 0.6.4 | NFR-13
router.get('/', requireRole('Payroll Officer'), validate({ query: listQuery }), (req, res) => {
  const rows = service.list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} payslip(s)`, data: rows });
});

// UC-13, UC-11 | FR-13, FR-11 | Process 0.6.4 | BR-15, BR-20 | NFR-13 | ASSUMPTION A-4
router.get('/:payslip_id', validate({ params: idParams }), (req, res) => {
  const p = loadForReader(req);
  return ok(res, { reference_id: p.payslip_id, message: 'Payslip', data: p });
});

// UC-13, UC-11 | FR-13, FR-11 | Process 0.6.4 | BR-15, BR-20 | NFR-13 | ASSUMPTION A-4 — fixed PDF layout
router.get(
  '/:payslip_id/download',
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const p = loadForReader(req);
    const pdf = await renderPayslipPdf(p);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${p.payslip_id}.pdf"`,
      'Cache-Control': 'no-store',
    });
    return res.status(200).send(pdf);
  })
);

module.exports = router;
