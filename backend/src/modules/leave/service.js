'use strict';
// Process 0.2 Manage Leave (0.2.1 Capture, 0.2.2 Validate & Record, 0.2.3 Review, 0.2.4 Update & Notify)
const dates = require('../../lib/dates');
const { nextId } = require('../../lib/ids');
const { conflict, notFound, unprocessable } = require('../../middleware/errors');
const { auditActor } = require('../../middleware/audit');

const COLUMNS = `l.leave_id, l.employee_id, l.leave_type, l.leave_start, l.leave_end, l.leave_days, l.leave_reason,
  l.applied_date, l.leave_status, l.approved_by, l.decision_date, l.hr_remarks`;

/** DS-11 Leave Status Notice */
const statusNotice = (l) => ({
  leave_id: l.leave_id,
  leave_status: l.leave_status,
  decision_date: l.decision_date,
  hr_remarks: l.hr_remarks,
});

// UC-03 | FR-3 | Process 0.2.1, 0.2.2 | BR-04, BR-05 | NFR-3
function apply(db, actor, input) {
  const appliedDate = dates.today(); // DE-023 system date
  // BR-05: Leave End Date >= Leave Start Date >= Applied Date
  const details = [];
  if (input.leave_start < appliedDate) {
    details.push({ field: 'body.leave_start', message: `Leave start date must not be before the applied date ${appliedDate}` });
  }
  if (input.leave_end < input.leave_start) {
    details.push({ field: 'body.leave_end', message: 'Leave end date must not be before leave start date' });
  }
  if (details.length) throw unprocessable('Leave dates are invalid', details);

  return db.transaction(() => {
    const leaveId = nextId(db, 'LEAVE_APPLICATION');
    db.prepare(
      `INSERT INTO LEAVE_APPLICATION
         (leave_id, employee_id, leave_type, leave_start, leave_end, leave_days, leave_reason, applied_date, leave_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`
    ).run(
      leaveId,
      actor.employee_id,
      input.leave_type,
      input.leave_start,
      input.leave_end,
      dates.daysInclusive(input.leave_start, input.leave_end), // DE-022 end - start + 1
      input.leave_reason,
      appliedDate
    );
    auditActor(db, actor, { action: 'APPLY', entity: 'LEAVE_APPLICATION', entity_id: leaveId, detail: { leave_type: input.leave_type } });
    return getById(db, leaveId);
  })();
}

function getById(db, leaveId) {
  return db
    .prepare(`SELECT ${COLUMNS}, e.employee_name FROM LEAVE_APPLICATION l JOIN EMPLOYEE e ON e.employee_id = l.employee_id WHERE l.leave_id = ?`)
    .get(leaveId);
}

// UC-03 | FR-3 | Process 0.2.4 | NFR-3 — employee's own applications and their status (DS-11)
function listOwn(db, employeeId) {
  return db
    .prepare(`SELECT ${COLUMNS} FROM LEAVE_APPLICATION l WHERE l.employee_id = ? ORDER BY l.applied_date DESC, l.leave_id DESC`)
    .all(employeeId);
}

// UC-04 | FR-4 | Process 0.2.3 | NFR-4 — review list with employee name (DS-09)
function listForReview(db, { status, employee_id: employeeId }) {
  const where = [];
  const params = [];
  if (status) {
    where.push('l.leave_status = ?');
    params.push(status);
  }
  if (employeeId) {
    where.push('l.employee_id = ?');
    params.push(employeeId);
  }
  return db
    .prepare(
      `SELECT ${COLUMNS}, e.employee_name FROM LEAVE_APPLICATION l
         JOIN EMPLOYEE e ON e.employee_id = l.employee_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY l.applied_date, l.leave_id`
    )
    .all(...params);
}

// UC-04 | FR-4 | Process 0.2.3, 0.2.4 | BR-06, BR-07 | NFR-4 — decision by HR Manager, Pending -> Approved|Rejected only
function decide(db, actor, leaveId, { decision, hr_remarks: remarks }) {
  return db.transaction(() => {
    const leave = getById(db, leaveId);
    if (!leave) throw notFound(`Leave application ${leaveId} not found`);
    if (leave.leave_status !== 'Pending') {
      throw conflict(`Leave application ${leaveId} is already ${leave.leave_status}; only Pending applications can be decided`);
    }
    const decisionDate = dates.today();
    const info = db
      .prepare(
        `UPDATE LEAVE_APPLICATION
            SET leave_status = ?, approved_by = ?, decision_date = ?, hr_remarks = ?
          WHERE leave_id = ? AND leave_status = 'Pending'`
      )
      .run(decision, actor.employee_id, decisionDate, remarks ?? null, leaveId);
    if (info.changes !== 1) throw conflict(`Leave application ${leaveId} was decided by another request`);
    // NFR-4: every status change traceable to the user who made it
    auditActor(db, actor, {
      action: 'DECISION',
      entity: 'LEAVE_APPLICATION',
      entity_id: leaveId,
      detail: { from: 'Pending', to: decision },
    });
    return statusNotice(getById(db, leaveId));
  })();
}

module.exports = { apply, getById, listOwn, listForReview, decide, statusNotice };
