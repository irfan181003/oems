'use strict';
// Process 0.1 Manage Attendance (0.1.1 Capture, 0.1.2 Validate & Record, 0.1.3 Retrieve)
const dates = require('../../lib/dates');
const { nextId } = require('../../lib/ids');
const { conflict } = require('../../middleware/errors');
const { auditActor } = require('../../middleware/audit');

const COLUMNS = 'a.attendance_id, a.employee_id, a.att_date, a.checkin_time, a.checkout_time, a.att_status, a.recorded_ts';

// UC-01 | FR-1 | Process 0.1.1, 0.1.2 | BR-01 | NFR-1 — date and time come from the server clock (DE-003, DE-004);
// times are stored as hh:mm (DE-005, DE-006)
function checkIn(db, actor) {
  const attDate = dates.today();
  const time = dates.nowHm();
  return db.transaction(() => {
    const existing = db
      .prepare('SELECT attendance_id FROM ATTENDANCE WHERE employee_id = ? AND att_date = ?')
      .get(actor.employee_id, attDate);
    if (existing) throw conflict(`Attendance already recorded for ${attDate} (${existing.attendance_id}); only one check-in per day is allowed`);

    const attendanceId = nextId(db, 'ATTENDANCE');
    db.prepare(
      `INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time, checkout_time, att_status, recorded_ts)
       VALUES (?, ?, ?, ?, NULL, 'Present', ?)`
    ).run(attendanceId, actor.employee_id, attDate, time, dates.nowTs());
    auditActor(db, actor, { action: 'CHECK_IN', entity: 'ATTENDANCE', entity_id: attendanceId });
    return getById(db, attendanceId);
  })();
}

// UC-01 | FR-1 | Process 0.1.2 | BR-02 | NFR-1 — check-out needs today's check-in, must be later, only once.
// With hh:mm times (DE-006) a check-out in the same minute as the check-in is not later and is refused.
function checkOut(db, actor) {
  const attDate = dates.today();
  const time = dates.nowHm();
  return db.transaction(() => {
    const row = db
      .prepare('SELECT attendance_id, checkin_time, checkout_time FROM ATTENDANCE WHERE employee_id = ? AND att_date = ?')
      .get(actor.employee_id, attDate);
    if (!row) throw conflict(`No check-in found for ${attDate}; check in before checking out`);
    if (row.checkout_time) throw conflict(`Already checked out at ${row.checkout_time} on ${attDate}`);
    if (!(time > row.checkin_time)) {
      throw conflict(`Check-out time ${time} must be later than check-in time ${row.checkin_time}`);
    }
    db.prepare('UPDATE ATTENDANCE SET checkout_time = ? WHERE attendance_id = ?').run(time, row.attendance_id);
    auditActor(db, actor, { action: 'CHECK_OUT', entity: 'ATTENDANCE', entity_id: row.attendance_id });
    return getById(db, row.attendance_id);
  })();
}

function getById(db, attendanceId) {
  return db.prepare(`SELECT ${COLUMNS} FROM ATTENDANCE a WHERE a.attendance_id = ?`).get(attendanceId);
}

// UC-02 | FR-2 | Process 0.1.3 | BR-03 | NFR-2 — own attendance + Attendance Summary (DS-06)
function listOwn(db, employeeId, from, to) {
  const records = db
    .prepare(
      `SELECT ${COLUMNS} FROM ATTENDANCE a
        WHERE a.employee_id = ? AND a.att_date BETWEEN ? AND ?
        ORDER BY a.att_date`
    )
    .all(employeeId, from, to);
  return {
    employee_id: employeeId,
    from_date: from,
    to_date: to,
    records,
    summary: { days_present: records.filter((r) => r.att_status === 'Present').length },
  };
}

// UC-02 | FR-2 | Process 0.1.3 | BR-03 | NFR-2 — HR Manager views all employees' attendance
function listAll(db, { employee_id: employeeId, from, to }) {
  const params = [from, to];
  let where = 'a.att_date BETWEEN ? AND ?';
  if (employeeId) {
    where += ' AND a.employee_id = ?';
    params.push(employeeId);
  }
  const records = db
    .prepare(
      `SELECT ${COLUMNS}, e.employee_name FROM ATTENDANCE a
         JOIN EMPLOYEE e ON e.employee_id = a.employee_id
        WHERE ${where}
        ORDER BY a.att_date, a.employee_id`
    )
    .all(...params);

  const byEmployee = new Map();
  for (const r of records) {
    const s = byEmployee.get(r.employee_id) || { employee_id: r.employee_id, employee_name: r.employee_name, days_present: 0 };
    if (r.att_status === 'Present') s.days_present += 1;
    byEmployee.set(r.employee_id, s);
  }
  return { from_date: from, to_date: to, records, summary: [...byEmployee.values()] };
}

module.exports = { checkIn, checkOut, listOwn, listAll };
