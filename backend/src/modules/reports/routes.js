'use strict';
// Process 0.7 Generate Reports — UC-16, UC-17 · FR-16, FR-17 · NFR-16, NFR-17
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const service = require('./service');

const { z } = f;
const router = express.Router();
router.use(authenticate);

// DS-46 Report Request (DE-090 Report Type, DE-014/015 date range)
const dateRangeRules = (requireDates) => (q, ctx) => {
  if (requireDates) {
    if (!q.from_date) ctx.addIssue({ code: 'custom', path: ['from_date'], message: 'From date is required' });
    if (!q.to_date) ctx.addIssue({ code: 'custom', path: ['to_date'], message: 'To date is required' });
  }
  if ((q.from_date && !q.to_date) || (!q.from_date && q.to_date)) {
    ctx.addIssue({ code: 'custom', path: ['to_date'], message: 'Give both From date and To date, or neither' });
  }
  if (q.from_date && q.to_date && q.from_date > q.to_date) {
    ctx.addIssue({ code: 'custom', path: ['to_date'], message: 'From date must not be after To date' });
  }
};

const hrQuery = z
  .strictObject({
    report_type: f.enumOf('Report type', [...service.HR_REPORT_TYPES]),
    from_date: f.isoDate('From date').optional(),
    to_date: f.isoDate('To date').optional(),
    department: f.department.optional(),
  })
  // BR-22 validation condition "Role HR Manager; valid period" — a period is required for every HR report type
  .superRefine(dateRangeRules(true));

const financialQuery = z
  .strictObject({
    report_type: f.enumOf('Report type', [...service.FINANCIAL_REPORT_TYPES]),
    from_date: f.isoDate('From date').optional(),
    to_date: f.isoDate('To date').optional(),
    department: f.department.optional(),
  })
  .superRefine(dateRangeRules(true));

// UC-16 | FR-16 | Process 0.7.1 | BR-22 | NFR-16 — HR Manager only; no salary or bank data
router.get('/hr', requireRole('HR Manager'), validate({ query: hrQuery }), (req, res) => {
  const r = service.hrReport(getDb(), req.validQuery);
  return ok(res, { message: r.report_title, data: r });
});

// UC-17 (includes UC-02, UC-12, UC-15) | FR-17 | Process 0.7.2, 0.7.3 | BR-23 | NFR-17 — Finance Manager only
router.get('/financial', requireRole('Finance Manager'), validate({ query: financialQuery }), (req, res) => {
  const r = service.financialReport(getDb(), req.validQuery);
  return ok(res, { message: r.report_title, data: r });
});

module.exports = router;
