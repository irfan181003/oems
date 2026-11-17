'use strict';
// NFR-22 | BR-27 Authentication and Session Timeout; ASSUMPTION A-2
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, PASSWORD, USERS } = require('./helpers');
const { GENERIC_LOGIN_ERROR } = require('../src/modules/auth/service');

const { db, app } = setup();

function assertEnvelope(body, status) {
  assert.equal(body.result_status, status);
  for (const k of ['reference_id', 'response_message', 'error_message', 'data']) assert.ok(k in body, `missing ${k}`);
}

describe('health', () => {
  test('GET /api/health is public and uses the Operation Result envelope', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assertEnvelope(res.body, 'Success');
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.body.error_message, null);
  });

  test('unknown route -> 404 envelope', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assertEnvelope(res.body, 'Failed');
  });

  test('malformed JSON -> 400 without a stack trace', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    assert.equal(res.status, 400);
    assertEnvelope(res.body, 'Failed');
    assert.ok(!JSON.stringify(res.body).includes('at '), 'no stack trace');
  });
});

describe('login (NFR-22)', () => {
  test('every seeded role can log in by employee_id and /me returns its role', async () => {
    const expected = {
      EMP00001: 'HR Manager',
      EMP00002: 'Recruitment Officer',
      EMP00003: 'Payroll Officer',
      EMP00004: 'Finance Manager',
      EMP00005: 'Employee',
    };
    for (const [id, role] of Object.entries(expected)) {
      const token = await login(app, id);
      const me = await request(app).get('/api/auth/me').set(bearer(token));
      assert.equal(me.status, 200);
      assert.deepEqual(me.body.data, { employee_id: id, name: me.body.data.name, role });
      assert.ok(me.body.data.name);
    }
  });

  test('login by e-mail is case-insensitive', async () => {
    const res = await request(app).post('/api/auth/login').send({ login: 'Sneha.Das@Example.com', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.employee_id, USERS.EMP);
    assert.equal(res.body.data.role, 'Employee');
    assert.match(res.body.data.token, /^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
  });

  test('wrong password and unknown user get the same generic 401 and are audited as Failed', async () => {
    const before = db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE action='LOGIN' AND outcome='Failed'").get().n;
    const bad = await request(app).post('/api/auth/login').send({ login: USERS.EMP, password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ login: 'EMP99999', password: 'whatever' });
    assert.equal(bad.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(bad.body.error_message, GENERIC_LOGIN_ERROR);
    assert.equal(unknown.body.error_message, GENERIC_LOGIN_ERROR);
    const after = db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE action='LOGIN' AND outcome='Failed'").get().n;
    assert.equal(after - before, 2);
    const row = db.prepare("SELECT detail FROM AUDIT_LOG WHERE action='LOGIN' ORDER BY audit_id DESC LIMIT 1").get();
    assert.ok(!String(row.detail).includes('whatever'), 'password never logged');
  });

  test('missing fields -> 422 with details; unknown field -> 400', async () => {
    const r1 = await request(app).post('/api/auth/login').send({ login: '' });
    assert.equal(r1.status, 422);
    assert.ok(Array.isArray(r1.body.details) && r1.body.details.length >= 1);
    const r2 = await request(app).post('/api/auth/login').send({ login: USERS.EMP, password: PASSWORD, role: 'HR Manager' });
    assert.equal(r2.status, 400);
    assert.match(r2.body.error_message, /role/);
  });

  test('inactive account cannot log in', async () => {
    db.prepare('UPDATE USER_ACCOUNT SET is_active = 0 WHERE employee_id = ?').run('EMP00010');
    const res = await request(app).post('/api/auth/login').send({ login: 'EMP00010', password: PASSWORD });
    assert.equal(res.status, 401);
    assert.equal(res.body.error_message, GENERIC_LOGIN_ERROR);
    db.prepare('UPDATE USER_ACCOUNT SET is_active = 1 WHERE employee_id = ?').run('EMP00010');
  });

  test('credentials are protected: bcrypt cost >= 10, only SHA-256 of the token stored', async () => {
    const acc = db.prepare('SELECT password_hash FROM USER_ACCOUNT WHERE employee_id = ?').get(USERS.EMP);
    const m = /^\$2[aby]\$(\d{2})\$/.exec(acc.password_hash);
    assert.ok(m && Number(m[1]) >= 10);
    const token = await login(app, USERS.EMP);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM SESSION WHERE token_hash = ?').get(token).n, 0);
    const sha = require('crypto').createHash('sha256').update(token).digest('hex');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM SESSION WHERE token_hash = ?').get(sha).n, 1);
  });
});

describe('BR-27 session (login required, logout, idle timeout)', () => {
  test('401 without a token or with an invalid token', async () => {
    const r1 = await request(app).get('/api/auth/me');
    assert.equal(r1.status, 401);
    assertEnvelope(r1.body, 'Failed');
    const r2 = await request(app).get('/api/auth/me').set(bearer('not-a-real-token'));
    assert.equal(r2.status, 401);
    const r3 = await request(app).get('/api/auth/me').set('Authorization', 'Basic abc');
    assert.equal(r3.status, 401);
  });

  test('logout revokes the session', async () => {
    const token = await login(app, USERS.EMP);
    const out = await request(app).post('/api/auth/logout').set(bearer(token));
    assert.equal(out.status, 200);
    const me = await request(app).get('/api/auth/me').set(bearer(token));
    assert.equal(me.status, 401);
  });

  test('idle longer than SESSION_IDLE_MINUTES -> 401 and session revoked', async () => {
    const token = await login(app, USERS.EMP);
    const sixteenMinAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    db.prepare('UPDATE SESSION SET last_activity_ts = ? WHERE employee_id = ? AND revoked = 0').run(sixteenMinAgo, USERS.EMP);
    const me = await request(app).get('/api/auth/me').set(bearer(token));
    assert.equal(me.status, 401);
    assert.match(me.body.error_message, /inactivity/);
    // stays revoked even if activity is reset afterwards
    db.prepare('UPDATE SESSION SET last_activity_ts = ? WHERE employee_id = ?').run(new Date().toISOString(), USERS.EMP);
    const again = await request(app).get('/api/auth/me').set(bearer(token));
    assert.equal(again.status, 401);
  });

  test('activity within the idle window keeps the session alive and refreshes last_activity_ts', async () => {
    const token = await login(app, USERS.EMP2);
    const fourteenMinAgo = new Date(Date.now() - 14 * 60 * 1000).toISOString();
    db.prepare('UPDATE SESSION SET last_activity_ts = ? WHERE employee_id = ? AND revoked = 0').run(fourteenMinAgo, USERS.EMP2);
    const me = await request(app).get('/api/auth/me').set(bearer(token));
    assert.equal(me.status, 200);
    const row = db.prepare('SELECT last_activity_ts FROM SESSION WHERE employee_id = ? AND revoked = 0').get(USERS.EMP2);
    assert.ok(Date.now() - Date.parse(row.last_activity_ts) < 60 * 1000);
  });

  test('deactivated account: existing session is rejected', async () => {
    const token = await login(app, 'EMP00009');
    db.prepare('UPDATE USER_ACCOUNT SET is_active = 0 WHERE employee_id = ?').run('EMP00009');
    const me = await request(app).get('/api/auth/me').set(bearer(token));
    assert.equal(me.status, 401);
    db.prepare('UPDATE USER_ACCOUNT SET is_active = 1 WHERE employee_id = ?').run('EMP00009');
  });
});
