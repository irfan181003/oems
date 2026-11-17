'use strict';
// NFR-22 | BR-27 | ASSUMPTION A-2 (Data Dictionary section 12 #3: no "Manage User Access" process exists)
const bcrypt = require('bcryptjs');
const config = require('../../config');
const { writeAudit } = require('../../middleware/audit');
const { hashToken, newToken } = require('../../middleware/auth');
const { unauthorized } = require('../../middleware/errors');

// Compared against when the login is unknown, so response time does not reveal valid IDs.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);
const GENERIC_LOGIN_ERROR = 'Invalid login or password';

// NFR-22 | BR-27: authenticate with employee_id or e-mail; returns an opaque token (only its SHA-256 is stored).
async function login(db, loginId, password) {
  const user = db
    .prepare(
      `SELECT u.employee_id, u.password_hash, u.role, u.is_active, e.employee_name
         FROM USER_ACCOUNT u
         JOIN EMPLOYEE e ON e.employee_id = u.employee_id
        WHERE u.employee_id = ? OR e.email = ?`
    )
    .get(loginId, loginId);

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk || !user.is_active) {
    writeAudit(
      {
        employee_id: user ? user.employee_id : null,
        role: user ? user.role : null,
        action: 'LOGIN',
        entity: 'SESSION',
        outcome: 'Failed',
        detail: user ? (user.is_active ? 'bad password' : 'account inactive') : 'unknown login',
      },
      db
    );
    throw unauthorized(GENERIC_LOGIN_ERROR);
  }

  const token = newToken();
  const nowIso = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO SESSION (token_hash, employee_id, role, created_ts, last_activity_ts, revoked)
       VALUES (?, ?, ?, ?, ?, 0)`
    ).run(hashToken(token), user.employee_id, user.role, nowIso, nowIso);
    writeAudit(
      { employee_id: user.employee_id, role: user.role, action: 'LOGIN', entity: 'SESSION', outcome: 'Success' },
      db
    );
  })();

  return {
    token,
    employee_id: user.employee_id,
    name: user.employee_name,
    role: user.role,
    idle_timeout_minutes: config.sessionIdleMinutes,
  };
}

// NFR-22: the session is terminated securely on sign-out.
function logout(db, user) {
  db.transaction(() => {
    db.prepare('UPDATE SESSION SET revoked = 1 WHERE token_hash = ?').run(user.token_hash);
    writeAudit(
      { employee_id: user.employee_id, role: user.role, action: 'LOGOUT', entity: 'SESSION', outcome: 'Success' },
      db
    );
  })();
}

module.exports = { login, logout, GENERIC_LOGIN_ERROR };
