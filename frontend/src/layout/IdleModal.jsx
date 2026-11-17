// NFR-22 | BR-27 — "Still there?" modal shown at 2 minutes left
import { useState } from 'react';
import Modal from '../components/Modal';
import { mmss } from '../auth/useIdleTimer';

export default function IdleModal({ open, remainingMs, onStay, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const stay = async () => {
    setBusy(true);
    try {
      await onStay();
    } catch {
      /* a 401 ends the session globally */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      title="Still there?"
      role="alertdialog"
      dismissable={false}
      footer={
        <>
          <button type="button" className="btn" onClick={onSignOut} disabled={busy}>
            Sign out
          </button>
          <button type="button" className="btn btn--primary" onClick={stay} disabled={busy}>
            {busy ? 'Checking…' : 'Stay signed in'}
          </button>
        </>
      }
    >
      <p>
        You have been inactive for a while. For your security, you will be signed out in{' '}
        <strong className="mono">{mmss(remainingMs)}</strong>.
      </p>
    </Modal>
  );
}
