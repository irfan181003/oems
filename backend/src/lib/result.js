'use strict';
// DS-04 Operation Result - the envelope used by every response.

/** Send a successful Operation Result. */
function ok(res, { status = 200, reference_id = null, message = 'OK', data = null } = {}) {
  return res.status(status).json({
    result_status: 'Success',
    reference_id,
    response_message: message,
    error_message: null,
    data,
  });
}

const FAILURE_MESSAGES = {
  400: 'Invalid request',
  401: 'Not authenticated',
  403: 'Access denied',
  404: 'Not found',
  409: 'Conflict',
  413: 'Request too large',
  422: 'Validation failed',
  429: 'Too many requests',
  500: 'Request failed',
};

/** Build a failed Operation Result body. */
function failureBody(status, errorMessage, details) {
  const body = {
    result_status: 'Failed',
    reference_id: null,
    response_message: FAILURE_MESSAGES[status] || 'Request failed',
    error_message: errorMessage,
    data: null,
  };
  if (details && details.length) body.details = details;
  return body;
}

module.exports = { ok, failureBody };
