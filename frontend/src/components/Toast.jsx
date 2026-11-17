// Toasts announced politely to screen readers (aria-live="polite")
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /** push({ tone: 'ok' | 'bad' | 'warn' | 'info', text }) */
  const push = useCallback(
    ({ tone = 'info', text, timeout = 5000 }) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone, text }]);
      if (timeout) setTimeout(() => dismiss(id), timeout);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role="status">
            <span className="toast__text">{t.text}</span>
            <button type="button" className="btn btn--ghost btn--icon" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
