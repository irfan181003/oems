'use strict';
const { failureBody } = require('../lib/result');

/** An expected failure with an HTTP status and a client-safe message. */
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const unauthorized = (msg = 'Login required') => new AppError(401, msg);
const forbidden = (msg = 'You are not permitted to perform this operation') => new AppError(403, msg);
const notFound = (msg = 'Record not found') => new AppError(404, msg);
const conflict = (msg) => new AppError(409, msg);
const unprocessable = (msg, details) => new AppError(422, msg, details);

/** Wrap an async route handler so rejected promises reach the error handler (Express 4). */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(req, res) {
  res.status(404).json(failureBody(404, `No route for ${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    res.locals.errorMessage = err.message; // used by auditFailures (never contains restricted values)
    return res.status(err.status).json(failureBody(err.status, err.message, err.details));
  }
  // A UNIQUE constraint hit by a concurrent request that passed the service-level check.
  if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.locals.errorMessage = 'Duplicate record';
    return res.status(409).json(failureBody(409, 'A record with the same unique values already exists'));
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json(failureBody(400, 'Malformed JSON body'));
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json(failureBody(413, 'Request body exceeds 100 kb'));
  }
  // Unexpected: log server-side only, never leak stack traces (section 5).
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json(failureBody(500, 'An unexpected error occurred'));
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
