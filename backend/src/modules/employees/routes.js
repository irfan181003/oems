'use strict';
// Process 0.3 Manage Employee Records — UC-06, UC-07 · FR-6, FR-7 · NFR-6, NFR-7 (HR Manager only)
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
router.use(authenticate, requireRole('HR Manager'));

// DS-12 Employee Registration Data — BR-10: all fields mandatory
const registrationFields = {
  employee_name: f.employeeName,
  date_of_birth: f.isoDate('Date of birth'),
  gender: f.gender,
  contact_number: f.contactNumber,
  email: f.email,
  address: f.address,
  department: f.department,
  designation: f.designation,
  date_of_joining: f.isoDate('Date of joining'),
  basic_salary: f.amount('Basic salary', { positive: true }),
  bank_account: f.bankAccount,
};
const registerBody = z.strictObject(registrationFields);

// DS-15 Employee Record Update — DE-044 editable fields only, DE-045 each value by its own rule
const updateBody = z
  .strictObject({ ...registrationFields, employment_status: f.employmentStatus })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field to change is required' });

const listQuery = z.strictObject({
  department: f.department.optional(),
  status: f.employmentStatus.optional(),
  q: f.text('Search text').trim().max(100).optional(),
});
const idParams = z.strictObject({ id: f.id('EMPLOYEE', 'Employee ID') });

// UC-06 | FR-6 | Process 0.3.1 | BR-09, BR-10 | NFR-6 | ASSUMPTION A-2
router.post('/', auditFailures('EMPLOYEE', 'REGISTER'), validate({ body: registerBody }), (req, res) => {
  const { employee, temporary_password: temporaryPassword } = service.register(getDb(), req.user, req.body);
  return ok(res, {
    status: 201,
    reference_id: employee.employee_id,
    message: `Employee ${employee.employee_id} registered; give the temporary password to the employee (shown once)`,
    data: { ...employee, temporary_password: temporaryPassword },
  });
});

// UC-07 | FR-7 | Process 0.3.2 | NFR-7 — list (bank account masked)
router.get('/', validate({ query: listQuery }), (req, res) => {
  const rows = service.list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} employee(s)`, data: rows });
});

// UC-07 | FR-7 | Process 0.3.2 | NFR-7
router.get('/:id', validate({ params: idParams }), (req, res) => {
  const e = service.get(getDb(), req.params.id);
  return ok(res, { reference_id: e.employee_id, message: 'Employee record', data: e });
});

// UC-07 | FR-7 | Process 0.3.2 | BR-11 | NFR-7 — no DELETE (not specified in the Data Dictionary)
router.patch('/:id', auditFailures('EMPLOYEE', 'UPDATE'), validate({ params: idParams, body: updateBody }), (req, res) => {
  const e = service.update(getDb(), req.user, req.params.id, req.body);
  return ok(res, { reference_id: e.employee_id, message: 'Employee record updated', data: e });
});

module.exports = router;
