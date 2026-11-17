'use strict';
// Process 0.5 Manage Payroll: run = 0.5.1 collect -> 0.5.2 calculate -> 0.5.3 store; 0.5.4 records.
const { auditActor } = require('../../middleware/audit');
const { conflict, notFound } = require('../../middleware/errors');
const { collectInputs } = require('./collect');
const { calculateSalary, CalculationError } = require('./calculator');
const store = require('./store');

/**
 * UC-14, UC-12 | FR-14, FR-12 | Process 0.5.1, 0.5.2, 0.5.3 | BR-16, BR-17, BR-18, BR-19, BR-28 | NFR-12, NFR-14
 * One transaction per employee; a failing employee does not stop the others (BR-17).
 * @param {object} run { pay_period, working_days, lines: [{employee_id, allowances_paise, other_deductions_paise}] | null }
 * @returns DS-38 Payroll Processing Status
 */
function runPayroll(db, actor, run) {
  const lines =
    run.lines ??
    db
      .prepare("SELECT employee_id FROM EMPLOYEE WHERE employment_status = 'Active' ORDER BY employee_id")
      .all()
      .map((e) => ({ employee_id: e.employee_id, allowances_paise: 0, other_deductions_paise: 0 }));

  const processed = [];
  const skipped = [];
  const failed = [];
  const getEmployee = db.prepare('SELECT employee_id, basic_salary, employment_status FROM EMPLOYEE WHERE employee_id = ?');

  for (const line of lines) {
    try {
      const payrollId = db.transaction(() => {
        const employee = getEmployee.get(line.employee_id);
        if (!employee) throw new CalculationError('Employee not found');
        if (employee.employment_status !== 'Active') throw new CalculationError(`Employee is ${employee.employment_status}, not Active`);

        // BR-19: one payroll line per employee per period; the existing line is kept
        const existing = store.findLine(db, line.employee_id, run.pay_period);
        if (existing) return { skipped: existing.payroll_id };

        const inputs = collectInputs(db, employee, run.pay_period, { ...line, working_days: run.working_days }); // 0.5.1
        const calc = calculateSalary(inputs); // 0.5.2
        const id = store.insertLine(db, inputs, calc); // 0.5.3
        // amounts are restricted and never logged
        auditActor(db, actor, { action: 'PROCESS', entity: 'PAYROLL', entity_id: id, detail: { employee_id: line.employee_id, pay_period: run.pay_period } });
        return { created: id };
      })();
      if (payrollId.skipped) {
        skipped.push({ employee_id: line.employee_id, payroll_id: payrollId.skipped, reason: 'Payroll line already exists for this pay period' });
      } else {
        processed.push({ employee_id: line.employee_id, payroll_id: payrollId.created });
      }
    } catch (err) {
      if (!(err instanceof CalculationError)) throw err;
      failed.push({ employee_id: line.employee_id, reason: err.message });
    }
  }

  const summary = {
    pay_period: run.pay_period,
    working_days: run.working_days,
    employees_processed: processed.length, // DE-086
    processed,
    skipped,
    failed,
    status: processed.length > 0 ? 'Processed' : 'Nothing processed',
  };
  auditActor(db, actor, {
    action: 'RUN',
    entity: 'PAYROLL',
    entity_id: run.pay_period,
    outcome: failed.length && !processed.length ? 'Failed' : 'Success',
    detail: { processed: processed.length, skipped: skipped.length, failed: failed.length },
  });
  return summary;
}

// UC-15 | FR-15 | Process 0.5.4 | BR-30 | NFR-15
function getRecord(db, payrollId) {
  const r = store.getById(db, payrollId);
  if (!r) throw notFound(`Payroll record ${payrollId} not found`);
  return r;
}

/** Allowed status changes: Processed -> Paid, Processed <-> On Hold. Paid is final. */
const TRANSITIONS = Object.freeze({ Processed: ['Paid', 'On Hold'], 'On Hold': ['Processed'], Paid: [] });

// UC-14 | FR-14 | Process 0.5.3 | NFR-14 — only the status changes; amounts are never editable after processing
function setStatus(db, actor, payrollId, status) {
  return db.transaction(() => {
    const r = getRecord(db, payrollId);
    if (!TRANSITIONS[r.payroll_status].includes(status)) {
      throw conflict(`Payroll status cannot change from ${r.payroll_status} to ${status}`);
    }
    db.prepare('UPDATE PAYROLL SET payroll_status = ? WHERE payroll_id = ?').run(status, payrollId);
    auditActor(db, actor, { action: 'STATUS', entity: 'PAYROLL', entity_id: payrollId, detail: { from: r.payroll_status, to: status } });
    return store.getById(db, payrollId);
  })();
}

module.exports = { runPayroll, getRecord, setStatus, TRANSITIONS };
