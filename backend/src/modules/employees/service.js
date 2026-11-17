'use strict';
// Process 0.3 Manage Employee Records (0.3.1 Register Employee, 0.3.2 Maintain Records)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../../config');
const dates = require('../../lib/dates');
const { nextId } = require('../../lib/ids');
const { conflict, notFound, unprocessable } = require('../../middleware/errors');
const { auditActor } = require('../../middleware/audit');

const COLUMNS = `employee_id, employee_name, date_of_birth, gender, contact_number, email, address, department,
  designation, date_of_joining, basic_salary, bank_account, employment_status, record_created_date,
  last_updated_by, last_updated_ts`;

/** Fields the HR Manager may change (DE-044: every field except the key and system-maintained ones). */
const EDITABLE_FIELDS = Object.freeze([
  'employee_name', 'date_of_birth', 'gender', 'contact_number', 'email', 'address', 'department',
  'designation', 'date_of_joining', 'basic_salary', 'bank_account', 'employment_status',
]);

/** Show only the last 4 digits of a bank account (list view, Data Dictionary section 10). */
function maskBankAccount(acc) {
  if (!acc) return acc;
  return '*'.repeat(Math.max(0, acc.length - 4)) + acc.slice(-4);
}

/** DE-030 / DE-037: employee at least 18 years old at joining; DOB not in the future. */
function checkAgeAtJoining(dob, doj) {
  const details = [];
  if (dob > dates.today()) details.push({ field: 'body.date_of_birth', message: 'Date of birth must not be in the future' });
  if (doj < dates.addYears(dob, 18)) {
    details.push({ field: 'body.date_of_joining', message: 'Employee must be at least 18 years old on the date of joining' });
  }
  if (details.length) throw unprocessable('Employee dates are invalid', details);
}

/** BR-09: e-mail must be unique (case-insensitive). */
function assertEmailFree(db, email, exceptEmployeeId = null) {
  const row = db.prepare('SELECT employee_id FROM EMPLOYEE WHERE email = ? AND employee_id IS NOT ?').get(email, exceptEmployeeId);
  if (row) throw conflict('An employee with this e-mail address already exists');
}

function getRecord(db, employeeId) {
  return db.prepare(`SELECT ${COLUMNS} FROM EMPLOYEE WHERE employee_id = ?`).get(employeeId);
}

// UC-06 | FR-6 | Process 0.3.1 | BR-09, BR-10 | NFR-6 | ASSUMPTION A-2 (user account with role Employee)
function register(db, actor, input) {
  checkAgeAtJoining(input.date_of_birth, input.date_of_joining);
  assertEmailFree(db, input.email);

  // One-time temporary password, returned once and stored only as a bcrypt hash.
  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = bcrypt.hashSync(temporaryPassword, config.bcryptRounds);

  const employee = db.transaction(() => {
    assertEmailFree(db, input.email);
    const employeeId = nextId(db, 'EMPLOYEE'); // BR-09: unique system-generated ID
    db.prepare(
      `INSERT INTO EMPLOYEE
         (employee_id, employee_name, date_of_birth, gender, contact_number, email, address, department,
          designation, date_of_joining, basic_salary, bank_account, employment_status, record_created_date)
       VALUES (@employee_id, @employee_name, @date_of_birth, @gender, @contact_number, @email, @address, @department,
               @designation, @date_of_joining, @basic_salary, @bank_account, 'Active', @record_created_date)`
    ).run({ ...input, employee_id: employeeId, record_created_date: dates.today() });
    db.prepare("INSERT INTO USER_ACCOUNT (employee_id, password_hash, role, is_active) VALUES (?, ?, 'Employee', 1)").run(
      employeeId,
      passwordHash
    );
    auditActor(db, actor, { action: 'REGISTER', entity: 'EMPLOYEE', entity_id: employeeId, detail: { department: input.department } });
    return getRecord(db, employeeId);
  })();

  return { employee, temporary_password: temporaryPassword };
}

// UC-07 | FR-7 | Process 0.3.2 | NFR-7 — list (bank account masked)
function list(db, { department, status, q }) {
  const where = [];
  const params = [];
  if (department) {
    where.push('department = ?');
    params.push(department);
  }
  if (status) {
    where.push('employment_status = ?');
    params.push(status);
  }
  if (q) {
    where.push("(employee_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR employee_id LIKE ? ESCAPE '\\')");
    const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    params.push(like, like, like);
  }
  return db
    .prepare(`SELECT ${COLUMNS} FROM EMPLOYEE ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY employee_id`)
    .all(...params)
    .map((e) => ({ ...e, bank_account: maskBankAccount(e.bank_account) }));
}

// UC-07 | FR-7 | Process 0.3.2 | NFR-7
function get(db, employeeId) {
  const e = getRecord(db, employeeId);
  if (!e) throw notFound(`Employee ${employeeId} not found`);
  return e;
}

/**
 * Apply field changes to an EMPLOYEE row and stamp last_updated_by / last_updated_ts (BR-11, NFR-7).
 * Used by HR record maintenance (0.3.2) and self-service profile update (0.3.3).
 */
function applyChanges(db, actor, employeeId, changes, auditAction) {
  return db.transaction(() => {
    const current = getRecord(db, employeeId);
    if (!current) throw notFound(`Employee ${employeeId} not found`);
    const merged = { ...current, ...changes };
    if ('date_of_birth' in changes || 'date_of_joining' in changes) checkAgeAtJoining(merged.date_of_birth, merged.date_of_joining);
    if ('email' in changes) assertEmailFree(db, changes.email, employeeId);

    const fields = Object.keys(changes);
    const set = fields.map((f) => `${f} = @${f}`).join(', ');
    db.prepare(
      `UPDATE EMPLOYEE SET ${set}, last_updated_by = @__by, last_updated_ts = @__ts WHERE employee_id = @__id`
    ).run({ ...changes, __by: actor.employee_id, __ts: dates.nowTs(), __id: employeeId });
    // Field names only - never the values (restricted data, section 10)
    auditActor(db, actor, { action: auditAction, entity: 'EMPLOYEE', entity_id: employeeId, detail: { fields } });
    return getRecord(db, employeeId);
  })();
}

// UC-07 | FR-7 | Process 0.3.2 | BR-11 | NFR-7 — each changed field validated by its own rule (DE-044, DE-045)
function update(db, actor, employeeId, changes) {
  for (const f of Object.keys(changes)) {
    if (!EDITABLE_FIELDS.includes(f)) throw new Error(`Field ${f} is not editable`); // guarded by the route schema
  }
  return applyChanges(db, actor, employeeId, changes, 'UPDATE');
}

module.exports = { EDITABLE_FIELDS, maskBankAccount, register, list, get, getRecord, applyChanges, update };
