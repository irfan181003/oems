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

/** Audit an action performed by an authenticated user (`actor` = req.user). */
function auditActor(db, actor, { action, entity, entity_id = null, outcome = 'Success', detail = null }) {
  writeAudit(
    { employee_id: actor ? actor.employee_id : null, role: actor ? actor.role : null, action, entity, entity_id, outcome, detail },
    db
  );
}

/** Convenience: audit an action performed by the authenticated user of `req`. */
function auditFromReq(req, entry, db) {
  auditActor(db || getDb(), req.user, entry);
}

/**
 * Route middleware: when the response finishes with an error status (other than 401/403,
 * which are handled by authenticate / the RBAC gates), write an AUDIT_LOG row with outcome
 * 'Failed', so refused create/update/decision requests are traceable too (section 9).
 * Successful mutations are audited inside the service transaction.
 */
function auditFailures(entity, action) {
  return function auditOnFinish(req, res, next) {
    res.on('finish', () => {
      if (res.statusCode < 400 || res.statusCode === 401 || res.statusCode === 403 || !req.user) return;
      try {
        auditFromReq(req, {
          action,
          entity,
          entity_id: res.locals.auditEntityId || Object.values(req.params || {})[0] || null,
          outcome: 'Failed',
          detail: { status: res.statusCode, reason: res.locals.errorMessage || null },
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') console.error('audit write failed', err);
      }
    });
    next();
  };
}

module.exports = { writeAudit, auditActor, auditFromReq, auditFailures };
