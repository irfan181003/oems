'use strict';
// UC-14 | FR-14 | Process 0.5.3 Store Payroll Record | BR-19 | NFR-14
const dates = require('../../lib/dates');
const money = require('../../lib/money');
const { nextId } = require('../../lib/ids');

const COLUMNS = `p.payroll_id, p.employee_id, p.pay_period, p.days_present, p.leave_days, p.basic_salary, p.allowances,
  p.gross_salary, p.tax_deduction, p.pf_deduction, p.total_deductions, p.net_salary, p.processed_date, p.payroll_status`;

/** BR-19: existing line for employee + period, if any. */
function findLine(db, employeeId, payPeriod) {
  return db.prepare('SELECT payroll_id FROM PAYROLL WHERE employee_id = ? AND pay_period = ?').get(employeeId, payPeriod);
}

/** Insert one PAYROLL line (status Processed). Must run inside the caller's transaction. */
function insertLine(db, inputs, calc) {
  const payrollId = nextId(db, 'PAYROLL');
  db.prepare(
    `INSERT INTO PAYROLL
       (payroll_id, employee_id, pay_period, days_present, leave_days, basic_salary, allowances, gross_salary,
        tax_deduction, pf_deduction, total_deductions, net_salary, processed_date, payroll_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Processed')`
  ).run(
    payrollId,
    inputs.employee_id,
    inputs.pay_period,
    inputs.days_present,
    inputs.paid_leave_days, // leave_days = paid leave days used
    money.fromPaise(inputs.basic_salary_paise), // snapshot of the basic salary
    money.fromPaise(inputs.allowances_paise),
    money.fromPaise(calc.gross_paise),
    money.fromPaise(calc.tax_paise),
    money.fromPaise(calc.pf_paise),
    money.fromPaise(calc.total_deductions_paise),
    money.fromPaise(calc.net_paise),
    dates.today()
  );
  return payrollId;
}

function getById(db, payrollId) {
  return db
    .prepare(`SELECT ${COLUMNS}, e.employee_name, e.department FROM PAYROLL p JOIN EMPLOYEE e ON e.employee_id = p.employee_id WHERE p.payroll_id = ?`)
    .get(payrollId);
}

function list(db, { pay_period: payPeriod, employee_id: employeeId }) {
  const where = [];
  const params = [];
  if (payPeriod) {
    where.push('p.pay_period = ?');
    params.push(payPeriod);
  }
  if (employeeId) {
    where.push('p.employee_id = ?');
    params.push(employeeId);
  }
  return db
    .prepare(
      `SELECT ${COLUMNS}, e.employee_name, e.department FROM PAYROLL p JOIN EMPLOYEE e ON e.employee_id = p.employee_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.pay_period DESC, p.employee_id`
    )
    .all(...params);
}

module.exports = { COLUMNS, findLine, insertLine, getById, list };
