// Accessible modal dialog + confirm dialog (used for every destructive or irreversible action, §5)
import { useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, onClose, children, footer, role = 'dialog', dismissable = true }) {
  const ref = useRef(null);
  const titleId = `m${useId().replace(/:/g, '')}`;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const first = node && node.querySelector(FOCUSABLE);
    (first || node)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation();
        closeRef.current && closeRef.current();
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, [open, dismissable]);

  if (!open) return null;
  return (
    <div
      className="modal-layer"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="modal" role={role} aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirm dialog that names the target, e.g. "Approve leave LV00000012 for Sneha Das?". */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onCancel}
      role="alertdialog"
      dismissable={!busy}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn btn--${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
