'use strict';
// Process 0.6 Generate Payslips — UC-13 · FR-13 · NFR-13
const dates = require('../../lib/dates');
const money = require('../../lib/money');
const { nextId } = require('../../lib/ids');
const { notFound } = require('../../middleware/errors');
const { auditActor } = require('../../middleware/audit');

const PAYSLIP_COLUMNS = 's.payslip_id, s.payroll_id, s.employee_id, s.pay_period, s.gross_salary, s.total_deductions, s.net_salary, s.generated_date';

/** BR-21: payslips only for payroll lines with these statuses. */
const PAYSLIP_STATUSES = Object.freeze(['Processed', 'Paid']);

// UC-13 | FR-13 | Process 0.6.1, 0.6.2, 0.6.3 | BR-20, BR-21 | NFR-13
function generate(db, actor, { pay_period: payPeriod, employee_ids: employeeIds }) {
  // 0.6.2 Retrieve Salary & Payroll Data (D5)
  const lines = employeeIds
    ? employeeIds.map((id) => ({
        employee_id: id,
        line: db.prepare('SELECT * FROM PAYROLL WHERE employee_id = ? AND pay_period = ?').get(id, payPeriod),
      }))
    : db
        .prepare('SELECT * FROM PAYROLL WHERE pay_period = ? ORDER BY employee_id')
        .all(payPeriod)
        .map((line) => ({ employee_id: line.employee_id, line }));

  const generated = [];
  const existing = [];
  const refused = [];
  const findSlip = db.prepare('SELECT payslip_id FROM PAYSLIP WHERE payroll_id = ?');

  for (const { employee_id: employeeId, line } of lines) {
    if (!line) {
      refused.push({ employee_id: employeeId, reason: `No payroll line for ${payPeriod}` });
      continue;
    }
    // One payslip per payroll line: a repeated request returns the existing payslip
    const slip = findSlip.get(line.payroll_id);
    if (slip) {
      existing.push({ employee_id: employeeId, payroll_id: line.payroll_id, payslip_id: slip.payslip_id });
      continue;
    }
    // BR-21: only for processed pay periods
    if (!PAYSLIP_STATUSES.includes(line.payroll_status)) {
      refused.push({ employee_id: employeeId, payroll_id: line.payroll_id, reason: `Payroll line is ${line.payroll_status}; payslips are generated only for Processed or Paid lines` });
      continue;
    }
    // 0.6.3 Prepare Payslip — BR-20: amounts copied unchanged from the PAYROLL line
    const payslipId = db.transaction(() => {
      const id = nextId(db, 'PAYSLIP');
      db.prepare(
        `INSERT INTO PAYSLIP (payslip_id, payroll_id, employee_id, pay_period, gross_salary, total_deductions, net_salary, generated_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, line.payroll_id, line.employee_id, line.pay_period, line.gross_salary, line.total_deductions, line.net_salary, dates.today());
      auditActor(db, actor, { action: 'GENERATE', entity: 'PAYSLIP', entity_id: id, detail: { payroll_id: line.payroll_id } });
      return id;
    })();
    generated.push({ employee_id: employeeId, payroll_id: line.payroll_id, payslip_id: payslipId });
  }

  // DS-45 Payslip Generation Status
  return {
    pay_period: payPeriod,
    payslip_count: generated.length + existing.length, // DE-089: payslips available for this request
    newly_generated: generated.length,
    generated,
    existing,
    refused,
  };
}

// UC-13 | FR-13 | Process 0.6.4 | NFR-13
function list(db, { pay_period: payPeriod, employee_id: employeeId }) {
  const where = [];
  const params = [];
  if (payPeriod) {
    where.push('s.pay_period = ?');
    params.push(payPeriod);
  }
  if (employeeId) {
    where.push('s.employee_id = ?');
    params.push(employeeId);
  }
  return db
    .prepare(
      `SELECT ${PAYSLIP_COLUMNS}, e.employee_name FROM PAYSLIP s JOIN EMPLOYEE e ON e.employee_id = s.employee_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.pay_period DESC, s.employee_id`
    )
    .all(...params);
}

/** Payslip (DS-44) + Salary & Deduction Breakdown (DS-43) from its payroll line. */
function getDetail(db, payslipId) {
  const p = db
    .prepare(
      `SELECT ${PAYSLIP_COLUMNS}, e.employee_name, e.department, e.designation,
              p.days_present, p.leave_days, p.basic_salary, p.allowances, p.tax_deduction, p.pf_deduction, p.payroll_status
         FROM PAYSLIP s
         JOIN PAYROLL p  ON p.payroll_id = s.payroll_id
         JOIN EMPLOYEE e ON e.employee_id = s.employee_id
        WHERE s.payslip_id = ?`
    )
    .get(payslipId);
  if (!p) return null;
  // other deductions are not stored separately (ASSUMPTION A-6): total - tax - pf
  const other = money.toPaise(p.total_deductions) - money.toPaise(p.tax_deduction) - money.toPaise(p.pf_deduction);
  // earned basic = gross - allowances (basic reduced for unpaid absence, BR-17)
  const earnedBasic = money.toPaise(p.gross_salary) - money.toPaise(p.allowances);
  return { ...p, earned_basic: money.fromPaise(earnedBasic), other_deductions: money.fromPaise(other) };
}

function get(db, payslipId) {
  const p = getDetail(db, payslipId);
  if (!p) throw notFound(`Payslip ${payslipId} not found`);
  return p;
}

module.exports = { generate, list, getDetail, get, PAYSLIP_STATUSES };
