'use strict';
// UC-14 | FR-14 | Process 0.5.1 Collect Payroll Inputs | BR-18 | NFR-14
// Reads D1 (basic salary), D2 (days present) and D3 (approved leave) for one employee and pay period
// and builds DS-35 Consolidated Payroll Inputs.
const dates = require('../../lib/dates');
const money = require('../../lib/money');
const RULES = require('./rules');

/** Inclusive overlap in days between [aStart, aEnd] and [bStart, bEnd] (0 if none). */
function overlapDays(aStart, aEnd, bStart, bEnd) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return end < start ? 0 : dates.daysInclusive(start, end);
}

/**
 * @param {object} db
 * @param {object} employee EMPLOYEE row (employee_id, basic_salary)
 * @param {string} payPeriod YYYY-MM
 * @param {object} line { working_days, allowances_paise, other_deductions_paise }
 */
function collectInputs(db, employee, payPeriod, line) {
  const { start, end } = dates.periodBounds(payPeriod);

  // D2: DS-33 Attendance Period Data
  const daysPresent = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ATTENDANCE
        WHERE employee_id = ? AND att_status = 'Present' AND att_date BETWEEN ? AND ?`
    )
    .get(employee.employee_id, start, end).n;

  // D3: DS-34 Approved Leave Data — BR-18: only Approved leave; clipped to the pay period
  const leaves = db
    .prepare(
      `SELECT leave_type, leave_start, leave_end FROM LEAVE_APPLICATION
        WHERE employee_id = ? AND leave_status = 'Approved' AND leave_start <= ? AND leave_end >= ?`
    )
    .all(employee.employee_id, end, start);
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  for (const l of leaves) {
    const days = overlapDays(l.leave_start, l.leave_end, start, end);
    if (RULES.PAID_LEAVE_TYPES.includes(l.leave_type)) paidLeaveDays += days;
    else unpaidLeaveDays += days; // ASSUMPTION A-6: 'Unpaid' leave is unpaid absence
  }

  // DS-35 Consolidated Payroll Inputs
  return {
    employee_id: employee.employee_id,
    pay_period: payPeriod,
    working_days: line.working_days,
    basic_salary_paise: money.toPaise(employee.basic_salary),
    days_present: daysPresent,
    paid_leave_days: paidLeaveDays,
    unpaid_leave_days: unpaidLeaveDays,
    allowances_paise: line.allowances_paise,
    other_deductions_paise: line.other_deductions_paise,
  };
}

module.exports = { collectInputs, overlapDays };
