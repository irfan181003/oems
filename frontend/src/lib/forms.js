// Form helpers: show server field errors beside the matching fields, everything else as a toast.
import { ApiError, fieldErrors } from '../api/client';

/**
 * @param {unknown} err
 * @param {(errors: object) => void} setErrors
 * @param {{ push: Function }} toast
 * @param {string[]} [knownFields] fields shown in the form; other field errors go to the toast
 * @returns {object} the field errors that were set
 */
export function showServerErrors(err, setErrors, toast, knownFields) {
  const fe = fieldErrors(err);
  const shown = {};
  const other = [];
  for (const [k, v] of Object.entries(fe)) {
    if (!knownFields || knownFields.includes(k)) shown[k] = v;
    else other.push(v);
  }
  setErrors(shown);
  if (!Object.keys(shown).length || other.length) {
    const message = other.length ? other.join(' ') : err instanceof ApiError || err instanceof Error ? err.message : 'Request failed';
    toast.push({ tone: 'bad', text: message });
  }
  return shown;
}

/** Only the keys whose value changed (PATCH endpoints refuse unknown or unchanged-but-forbidden keys). */
export function changedFields(original, current, allowed) {
  const out = {};
  for (const k of allowed) {
    const a = original[k] ?? '';
    const b = typeof current[k] === 'string' ? current[k].trim() : current[k];
    if (String(a) !== String(b ?? '')) out[k] = b;
  }
  return out;
}
