'use strict';
// Process 0.3.3 Update Profile — UC-05 · FR-5 · NFR-5 (Employee self-service, ASSUMPTION A-7)
const express = require('express');
const { getDb } = require('../../db');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { authenticate } = require('../../middleware/auth');
const { requireSelfService } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const { auditFailures } = require('../../middleware/audit');
const employees = require('../employees/service');

const { z } = f;
const router = express.Router();
router.use(authenticate, requireSelfService);

/** DS-17 Profile Details */
const profileDetails = (e) => ({
  employee_id: e.employee_id,
  employee_name: e.employee_name,
  contact_number: e.contact_number,
  email: e.email,
  address: e.address,
  department: e.department,
  designation: e.designation,
});

// BR-08: only contact number, e-mail and address; any other key -> 400 listing the rejected keys
const profileUpdateBody = z
  .strictObject({ contact_number: f.contactNumber, email: f.email, address: f.address })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one of contact_number, email, address' });

// UC-05 | FR-5 | Process 0.3.3 | NFR-5 — view own profile
router.get('/me', (req, res) => {
  const e = employees.get(getDb(), req.user.employee_id);
  return ok(res, { reference_id: e.employee_id, message: 'Profile details', data: profileDetails(e) });
});

// UC-05 | FR-5 | Process 0.3.3 | BR-08, BR-09, BR-11 | NFR-5
router.patch('/me', auditFailures('EMPLOYEE', 'PROFILE_UPDATE'), validate({ body: profileUpdateBody }), (req, res) => {
  const e = employees.applyChanges(getDb(), req.user, req.user.employee_id, req.body, 'PROFILE_UPDATE');
  return ok(res, { reference_id: e.employee_id, message: 'Profile updated', data: profileDetails(e) });
});

module.exports = router;
