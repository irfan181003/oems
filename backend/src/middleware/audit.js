'use strict';
// ASSUMPTION A-5: AUDIT_LOG store for BR-26 ("Denied and logged") and NFR-4/7/20 traceability.
// Callers must never put restricted values (salary, bank account, nominee, offered salary,
// passwords, tokens) in `detail` (Data Dictionary section 10).
const { getDb } = require('../db');
const dates = require('../lib/dates');

const OUTCOMES = ['Success', 'Denied', 'Failed'];

/**
 * Write one AUDIT_LOG row.
 * @param {object} e { employee_id?, role?, action, entity, entity_id?, outcome, detail? }
 * @param {object} [db] connection (defaults to the shared one; pass the transaction's db)
 */
function writeAudit(e, db = getDb()) {
  if (!OUTCOMES.includes(e.outcome)) throw new Error(`Invalid audit outcome ${e.outcome}`);
  const detail = e.detail == null ? null : typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail);
  db.prepare(
    `INSERT INTO AUDIT_LOG (ts, employee_id, role, action, entity, entity_id, outcome, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    dates.nowTs(),
    e.employee_id ?? null,
    e.role ?? null,
    e.action,
    e.entity,
    e.entity_id ?? null,
    e.outcome,
    detail
  );
}

/** Convenience: audit an action performed by the authenticated user of `req`. */
function auditFromReq(req, { action, entity, entity_id = null, outcome = 'Success', detail = null }, db) {
  writeAudit(
    {
      employee_id: req.user ? req.user.employee_id : null,
      role: req.user ? req.user.role : null,
      action,
      entity,
      entity_id,
      outcome,
      detail,
    },
    db
  );
}

module.exports = { writeAudit, auditFromReq };
