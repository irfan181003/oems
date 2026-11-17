'use strict';
// Process 0.3.4 Manage Retirement Plans — UC-20 · FR-20 · NFR-20 (HR Manager only, BR-24)
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { auditFailures } = require('../../middleware/audit');
const service = require('./service');

const { z } = f;
const router = express.Router();
router.use(authenticate, requireRole('HR Manager')); // BR-24: only HR may manage retirement plans

const PLAN_TYPES = ['Provident Fund', 'Pension', 'Gratuity'];
const nominee = f.text('Nominee name').trim().max(100, 'Nominee name must be at most 100 characters').nullable();

// DS-18 Retirement Plan Input (DE-046 ... DE-049)
const createBody = z.strictObject({
  employee_id: f.id('EMPLOYEE', 'Employee ID'),
  retirement_date: f.isoDate('Retirement date'),
  plan_type: f.enumOf('Plan type', PLAN_TYPES),
  contribution_amount: f.amount('Contribution amount'), // DE-048 zero or more
  nominee_name: nominee.optional(),
});

const updateBody = z
  .strictObject({
    retirement_date: f.isoDate('Retirement date'),
    plan_type: f.enumOf('Plan type', PLAN_TYPES),
    contribution_amount: f.amount('Contribution amount'),
    nominee_name: nominee,
    plan_status: f.enumOf('Plan status', ['Active', 'Closed']),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field to change is required' });

const listQuery = z.strictObject({ employee_id: f.id('EMPLOYEE', 'Employee ID').optional() });
const idParams = z.strictObject({ id: f.id('RETIREMENT_PLAN', 'Retirement plan ID') });

// UC-20 | FR-20 | Process 0.3.4 | BR-24, BR-25 | NFR-20
router.post('/', auditFailures('RETIREMENT_PLAN', 'CREATE'), validate({ body: createBody }), (req, res) => {
  const plan = service.create(getDb(), req.user, req.body);
  return ok(res, { status: 201, reference_id: plan.ret_plan_id, message: 'Retirement plan created', data: plan });
});

// UC-20 | FR-20 | Process 0.3.4 | BR-24 | NFR-20
router.get('/', validate({ query: listQuery }), (req, res) => {
  const rows = service.list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} retirement plan(s)`, data: rows });
});

// UC-20 | FR-20 | Process 0.3.4 | BR-24 | NFR-20
router.get('/:id', validate({ params: idParams }), (req, res) => {
  const plan = service.get(getDb(), req.params.id);
  return ok(res, { reference_id: plan.ret_plan_id, message: 'Retirement plan', data: plan });
});

// UC-20 | FR-20 | Process 0.3.4 | BR-24, BR-25 | NFR-20
router.patch('/:id', auditFailures('RETIREMENT_PLAN', 'UPDATE'), validate({ params: idParams, body: updateBody }), (req, res) => {
  const plan = service.update(getDb(), req.user, req.params.id, req.body);
  return ok(res, { reference_id: plan.ret_plan_id, message: 'Retirement plan updated', data: plan });
});

module.exports = router;
