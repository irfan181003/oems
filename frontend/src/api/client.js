// API client (FRONTEND_PROMPT §3) — NFR-21, NFR-22, BR-26, BR-27
// Adds the Bearer token, parses the DS-04 Operation Result envelope
// {result_status, reference_id, response_message, error_message, data, details?} and throws ApiError on failure.
import { getToken, clearSession } from '../auth/session';

const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, details = [], body = null) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
    this.body = body;
  }
}

let unauthorizedHandler = null;
let requestListener = null;

/** Called once when an authenticated request gets 401 (session missing, revoked or idle-expired). */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

/** Called after every successful authenticated request (keeps the idle timer in step with the server). */
export function setRequestListener(fn) {
  requestListener = fn;
}

/** Build a query string, skipping empty values. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') sp.set(k, String(v).trim());
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function readJson(res) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} method
 * @param {string} path  path after /api, e.g. '/auth/me'
 * @param {object} [body]
 * @param {object} [opts] { auth: true, as: 'json' | 'text' | 'blob' }
 * @returns the full envelope for JSON, or a string / Blob for 'text' / 'blob'
 */
export async function request(method, path, body, opts = {}) {
  const { auth = true, as = 'json' } = opts;
  const headers = { Accept: as === 'json' ? 'application/json' : '*/*' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running and try again.');
  }

  // Non-JSON success bodies (offer letter HTML, payslip PDF)
  if (res.ok && as !== 'json') {
    if (auth && requestListener) requestListener();
    return as === 'blob' ? res.blob() : res.text();
  }

  const json = await readJson(res);

  if (res.status === 401 && auth) {
    clearSession();
    if (unauthorizedHandler) unauthorizedHandler();
  }

  if (!res.ok || !json || json.result_status !== 'Success') {
    const message =
      (json && (json.error_message || json.response_message)) ||
      (res.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : `Request failed (${res.status})`);
    throw new ApiError(res.status, message, json && json.details, json);
  }

  if (auth && requestListener) requestListener();
  return json;
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  patch: (path, body, opts) => request('PATCH', path, body, opts),
};

/**
 * Map server field errors to form field names: {"body.email": "..."} -> { email: "..." }.
 * Paths keep their nesting after the location prefix, e.g. "lines.0.allowances".
 */
export function fieldErrors(err) {
  const out = {};
  if (!(err instanceof ApiError)) return out;
  for (const d of err.details) {
    if (!d || !d.field) continue;
    const key = d.field.replace(/^(body|query|params)\./, '');
    if (!out[key]) out[key] = d.message;
  }
  return out;
}
