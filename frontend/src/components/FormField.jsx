// One-column form field: label above, dictionary hint under the field, inline error.
// Wraps exactly one input/select/textarea and wires id, aria-describedby and aria-invalid onto it.
import { Children, cloneElement, isValidElement, useId } from 'react';
import LockIcon from './LockIcon';

export default function FormField({ label, hint, error, required = false, children, id: idProp }) {
  const autoId = useId();
  const id = idProp || `f${autoId.replace(/:/g, '')}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child, {
        id,
        'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? 'true' : undefined,
        'aria-required': required || undefined,
      })
    : child;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errId}>
          {error}
        </span>
      )}
    </div>
  );
}

/** A value the user can see but not change (shown with a lock icon). */
export function ReadOnlyField({ label, children, mono = false }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="readonly-value">
        <LockIcon />
        <span className={mono ? 'mono' : undefined}>{children}</span>
        <span className="visually-hidden">(read-only)</span>
      </div>
    </div>
  );
}
