'use strict';
// Process 0.3.4 Manage Retirement Plans — UC-20 · FR-20 · NFR-20
const { nextId } = require('../../lib/ids');
const { conflict, notFound, unprocessable } = require('../../middleware/errors');
const { auditActor } = require('../../middleware/audit');

const COLUMNS = `r.ret_plan_id, r.employee_id, r.retirement_date, r.plan_type, r.contribution_amount,
  r.nominee_name, r.plan_status`;

function getById(db, planId) {
  return db
    .prepare(`SELECT ${COLUMNS}, e.employee_name FROM RETIREMENT_PLAN r JOIN EMPLOYEE e ON e.employee_id = r.employee_id WHERE r.ret_plan_id = ?`)
    .get(planId);
}

/** BR-25: Retirement Date > Date of Joining. */
function checkRetirementDate(employee, retirementDate) {
  if (!(retirementDate > employee.date_of_joining)) {
    throw unprocessable('Retirement date is invalid', [
      { field: 'body.retirement_date', message: `Retirement date must be after the date of joining (${employee.date_of_joining})` },
    ]);
  }
}

// UC-20 | FR-20 | Process 0.3.4 | BR-24, BR-25 | NFR-20
function create(db, actor, input) {
  return db.transaction(() => {
    const employee = db.prepare('SELECT employee_id, date_of_joining FROM EMPLOYEE WHERE employee_id = ?').get(input.employee_id);
    if (!employee) throw notFound(`Employee ${input.employee_id} not found`);
    checkRetirementDate(employee, input.retirement_date);
    // ASSUMPTION A-1: one retirement plan per employee
    const existing = db.prepare('SELECT ret_plan_id FROM RETIREMENT_PLAN WHERE employee_id = ?').get(input.employee_id);
    if (existing) throw conflict(`Employee ${input.employee_id} already has retirement plan ${existing.ret_plan_id}; update it instead`);

    const planId = nextId(db, 'RETIREMENT_PLAN');
    db.prepare(
      `INSERT INTO RETIREMENT_PLAN (ret_plan_id, employee_id, retirement_date, plan_type, contribution_amount, nominee_name, plan_status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`
    ).run(planId, input.employee_id, input.retirement_date, input.plan_type, input.contribution_amount, input.nominee_name ?? null);
    // NFR-20 traceability; amounts and nominee are restricted and not logged
    auditActor(db, actor, { action: 'CREATE', entity: 'RETIREMENT_PLAN', entity_id: planId, detail: { employee_id: input.employee_id } });
    return getById(db, planId);
  })();
}

// UC-20 | FR-20 | Process 0.3.4 | BR-24 | NFR-20
function list(db, { employee_id: employeeId }) {
  const sql = `SELECT ${COLUMNS}, e.employee_name FROM RETIREMENT_PLAN r JOIN EMPLOYEE e ON e.employee_id = r.employee_id
    ${employeeId ? 'WHERE r.employee_id = ?' : ''} ORDER BY r.ret_plan_id`;
  return employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all();
}

// UC-20 | FR-20 | Process 0.3.4 | BR-24 | NFR-20
function get(db, planId) {
  const plan = getById(db, planId);
  if (!plan) throw notFound(`Retirement plan ${planId} not found`);
  return plan;
}

// UC-20 | FR-20 | Process 0.3.4 | BR-24, BR-25 | NFR-20
function update(db, actor, planId, changes) {
  return db.transaction(() => {
    const plan = getById(db, planId);
    if (!plan) throw notFound(`Retirement plan ${planId} not found`);
    if ('retirement_date' in changes) {
      const employee = db.prepare('SELECT date_of_joining FROM EMPLOYEE WHERE employee_id = ?').get(plan.employee_id);
      checkRetirementDate(employee, changes.retirement_date);
    }
    const fields = Object.keys(changes);
    db.prepare(`UPDATE RETIREMENT_PLAN SET ${fields.map((k) => `${k} = @${k}`).join(', ')} WHERE ret_plan_id = @__id`).run({
      ...changes,
      __id: planId,
    });
    auditActor(db, actor, { action: 'UPDATE', entity: 'RETIREMENT_PLAN', entity_id: planId, detail: { fields } });
    return getById(db, planId);
  })();
}

module.exports = { create, list, get, update };
