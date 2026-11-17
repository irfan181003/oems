'use strict';
// NFR-22 | BR-27 Authentication and Session Timeout (ASSUMPTION A-2: SESSION store)
const crypto = require('crypto');
const config = require('../config');
const { getDb } = require('../db');
const { unauthorized } = require('./errors');

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** True when the session has been idle longer than SESSION_IDLE_MINUTES. */
function isIdleExpired(lastActivityIso, nowMs = Date.now()) {
  return nowMs - Date.parse(lastActivityIso) > config.sessionIdleMinutes * 60 * 1000;
}

// NFR-22 | BR-27: 401 if the token is missing, unknown, revoked or idle-expired.
function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return next(unauthorized('Login required'));

  const db = getDb();
  const tokenHash = hashToken(match[1]);
  const s = db
    .prepare(
      `SELECT s.token_hash, s.employee_id, s.role, s.last_activity_ts, s.revoked,
              u.is_active, e.employee_name
         FROM SESSION s
         JOIN USER_ACCOUNT u ON u.employee_id = s.employee_id
         JOIN EMPLOYEE e     ON e.employee_id = s.employee_id
        WHERE s.token_hash = ?`
    )
    .get(tokenHash);

  if (!s || s.revoked) return next(unauthorized('Session is not valid; please log in'));
  if (!s.is_active) {
    db.prepare('UPDATE SESSION SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
    return next(unauthorized('Session is not valid; please log in'));
  }

  const now = Date.now();
  if (isIdleExpired(s.last_activity_ts, now)) {
    // BR-27: idle session ends
    db.prepare('UPDATE SESSION SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
    return next(unauthorized('Session expired due to inactivity; please log in again'));
  }

  db.prepare('UPDATE SESSION SET last_activity_ts = ? WHERE token_hash = ?').run(new Date(now).toISOString(), tokenHash);
  req.user = { employee_id: s.employee_id, role: s.role, name: s.employee_name, token_hash: tokenHash };
  return next();
}

module.exports = { authenticate, hashToken, newToken, isIdleExpired };
