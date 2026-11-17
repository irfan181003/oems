'use strict';
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const config = require('../../config');
const { getDb } = require('../../db');
const { ok, failureBody } = require('../../lib/result');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errors');
const service = require('./service');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginRateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(failureBody(429, 'Too many login attempts; try again later')),
});

const loginBody = z
  .object({
    login: z.string().trim().min(1, 'Login (employee ID or e-mail) is required').max(100),
    password: z.string().min(1, 'Password is required').max(200),
  })
  .strict();

// NFR-22 | BR-27 | ASSUMPTION A-2 - log in with employee_id or e-mail
router.post(
  '/login',
  loginLimiter,
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const data = await service.login(getDb(), req.body.login, req.body.password);
    return ok(res, { reference_id: data.employee_id, message: 'Login successful', data });
  })
);

// NFR-22 | BR-27 - sign out: revoke the current session
router.post('/logout', authenticate, (req, res) => {
  service.logout(getDb(), req.user);
  return ok(res, { reference_id: req.user.employee_id, message: 'Logged out' });
});

// NFR-22 - who am I
router.get('/me', authenticate, (req, res) =>
  ok(res, {
    reference_id: req.user.employee_id,
    message: 'Current user',
    data: { employee_id: req.user.employee_id, name: req.user.name, role: req.user.role },
  })
);

module.exports = router;
