'use strict';
// Process 0.2 Manage Leave — UC-03, UC-04 · FR-3, FR-4 · NFR-3, NFR-4
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const { z, isoDate, notBlank, enumOf, id, text } = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole, requireSelfService, deniedError, isSelfServiceUser } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { auditFailures } = require('../../middleware/audit');
const { notFound } = require('../../middleware/errors');
const service = require('./service');

const router = express.Router();
router.use(authenticate);

const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Unpaid'];
const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'];

// BR-04: leave type, dates and reason are all mandatory (DE-017 ... DE-020)
const applyBody = z.strictObject({
  leave_type: enumOf('Leave type', LEAVE_TYPES),
  leave_start: isoDate('Leave start date'),
  leave_end: isoDate('Leave end date'),
  leave_reason: notBlank('Leave reason', 200),
});

const reviewQuery = z.strictObject({
  status: enumOf('Status', LEAVE_STATUSES).optional(),
  employee_id: id('EMPLOYEE', 'Employee ID').optional(),
});

const leaveParams = z.strictObject({ leave_id: id('LEAVE_APPLICATION', 'Leave ID') });

// DE-029 Leave Decision: Approved | Rejected; DE-027 HR Remarks optional
const decisionBody = z.strictObject({
  decision: enumOf('Decision', ['Approved', 'Rejected']),
  hr_remarks: text('HR remarks').trim().max(200, 'HR remarks must be at most 200 characters').optional().nullable(),
});

// UC-03 | FR-3 | Process 0.2.1, 0.2.2 | BR-04, BR-05 | NFR-3 — apply for leave (own record only)
router.post('/', requireSelfService, auditFailures('LEAVE_APPLICATION', 'APPLY'), validate({ body: applyBody }), (req, res) => {
  const leave = service.apply(getDb(), req.user, req.body);
  return ok(res, { status: 201, reference_id: leave.leave_id, message: 'Leave application submitted (Pending)', data: leave });
});

// UC-03 | FR-3 | Process 0.2.4 | NFR-3 — own applications with status (DS-11)
router.get('/me', requireSelfService, validate({ query: z.strictObject({}) }), (req, res) => {
  const rows = service.listOwn(getDb(), req.user.employee_id);
  return ok(res, { reference_id: req.user.employee_id, message: `${rows.length} leave application(s)`, data: rows });
});

// UC-04 | FR-4 | Process 0.2.3 | NFR-4 — review list (DS-09)
router.get('/', requireRole('HR Manager'), validate({ query: reviewQuery }), (req, res) => {
  const rows = service.listForReview(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} leave application(s)`, data: rows });
});

// UC-03, UC-04 | FR-3, FR-4 | Process 0.2.3 | BR-26 | NFR-4 — HR Manager or the owning Employee
router.get('/:leave_id', validate({ params: leaveParams }), (req, res, next) => {
  const db = getDb();
  const leave = service.getById(db, req.params.leave_id);
  const isHr = req.user.role === 'HR Manager';
  const isOwner = leave && isSelfServiceUser(req.user) && leave.employee_id === req.user.employee_id;
  if (!isHr && !isOwner) return next(deniedError(req, 'not HR Manager and not the owner', req.params.leave_id));
  if (!leave) return next(notFound(`Leave application ${req.params.leave_id} not found`));
  return ok(res, { reference_id: leave.leave_id, message: 'Leave application', data: leave });
});

// UC-04 | FR-4 | Process 0.2.3, 0.2.4 | BR-06, BR-07 | NFR-4 — approve / reject; response is the Leave Status Notice
router.patch(
  '/:leave_id/decision',
  requireRole('HR Manager'),
  auditFailures('LEAVE_APPLICATION', 'DECISION'),
  validate({ params: leaveParams, body: decisionBody }),
  (req, res) => {
    const notice = service.decide(getDb(), req.user, req.params.leave_id, req.body);
    return ok(res, { reference_id: notice.leave_id, message: `Leave application ${notice.leave_status}`, data: notice });
  }
);

module.exports = router;
