'use strict';
// NFR-21 | BR-26 Role-Based Access Control: refused requests are "Denied and logged".
const config = require('../config');
const { forbidden, unauthorized } = require('./errors');
const { auditFromReq } = require('./audit');

/** Entity name for the audit row, taken from the first path segment after /api. */
function entityOf(req) {
  const seg = (req.baseUrl + req.path).replace(/^\/api\/?/, '').split('/')[0];
  return seg || 'api';
}

function deny(req, next, reason) {
  auditFromReq(req, {
    action: `${req.method} ${req.baseUrl}${req.path}`,
    entity: entityOf(req),
    outcome: 'Denied',
    detail: { reason },
  });
  return next(forbidden());
}

/** Allow only the listed roles; anything else gets 403 and an AUDIT_LOG 'Denied' row. */
function requireRole(...roles) {
  for (const r of roles) {
    if (!config.ALL_ROLES.includes(r)) throw new Error(`requireRole: unknown role "${r}"`);
  }
  return function roleGate(req, res, next) {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return deny(req, next, `role ${req.user.role} not in [${roles.join(', ')}]`);
    return next();
  };
}

/**
 * ASSUMPTION A-7: Employee self-service use cases (UC-01, UC-02 own, UC-03, UC-05, UC-11 own)
 * are allowed only for roles listed in SELF_SERVICE_ROLES. Handlers behind this gate always act
 * on req.user.employee_id and never accept another employee's ID (BR-03, NFR-2, NFR-11).
 */
function requireSelfService(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (!config.selfServiceRoles.includes(req.user.role)) {
    return deny(req, next, `role ${req.user.role} not in SELF_SERVICE_ROLES`);
  }
  return next();
}

module.exports = { requireRole, requireSelfService };
