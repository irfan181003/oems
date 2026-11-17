'use strict';
// Process 0.1 Manage Attendance — UC-01, UC-02 · FR-1, FR-2 · NFR-1, NFR-2
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const { z, isoDate, id } = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole, requireSelfService } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { auditFailures } = require('../../middleware/audit');
const service = require('./service');

const router = express.Router();
router.use(authenticate);

// DE-014 From Date not after DE-015 To Date
const range = {
  from: isoDate('From date'),
  to: isoDate('To date'),
};
const fromNotAfterTo = (q) => q.from <= q.to;
const rangeMsg = { message: 'From date must not be after To date', path: ['to'] };

const ownQuery = z.strictObject(range).refine(fromNotAfterTo, rangeMsg);
const allQuery = z
  .strictObject({ ...range, employee_id: id('EMPLOYEE', 'Employee ID').optional() })
  .refine(fromNotAfterTo, rangeMsg);

// UC-01 | FR-1 | Process 0.1.1, 0.1.2 | BR-01 | NFR-1 — check-in (server sets date/time/status)
router.post('/check-in', requireSelfService, auditFailures('ATTENDANCE', 'CHECK_IN'), (req, res) => {
  const row = service.checkIn(getDb(), req.user);
  return ok(res, { status: 201, reference_id: row.attendance_id, message: 'Check-in recorded', data: row });
});

// UC-01 | FR-1 | Process 0.1.2 | BR-02 | NFR-1 — check-out
router.post('/check-out', requireSelfService, auditFailures('ATTENDANCE', 'CHECK_OUT'), (req, res) => {
  const row = service.checkOut(getDb(), req.user);
  return ok(res, { reference_id: row.attendance_id, message: 'Check-out recorded', data: row });
});

// UC-02 | FR-2 | Process 0.1.3 | BR-03 | NFR-2 — own attendance only (no employee_id accepted)
router.get('/me', requireSelfService, validate({ query: ownQuery }), (req, res) => {
  const { from, to } = req.validQuery;
  const data = service.listOwn(getDb(), req.user.employee_id, from, to);
  return ok(res, { reference_id: req.user.employee_id, message: `${data.records.length} attendance record(s)`, data });
});

// UC-02 | FR-2 | Process 0.1.3 | BR-03 | NFR-2 — HR Manager sees all employees
router.get('/', requireRole('HR Manager'), validate({ query: allQuery }), (req, res) => {
  const data = service.listAll(getDb(), req.validQuery);
  return ok(res, { message: `${data.records.length} attendance record(s)`, data });
});

module.exports = router;
