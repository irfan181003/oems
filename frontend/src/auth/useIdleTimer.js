// NFR-22 | BR-27 — idle timeout (FRONTEND_PROMPT §3).
// The server ends a session SESSION_IDLE_MINUTES after its last *request*; the UI tracks user activity.
// To keep both in step, user activity triggers a throttled GET /auth/me keep-alive when the last request
// is older than KEEPALIVE_MS, and the countdown runs to the earlier of the two deadlines.
import { useCallback, useEffect, useRef, useState } from 'react';
import { setRequestListener } from '../api/client';
import { auth as authApi } from '../api/endpoints';

const minutes = Number(import.meta.env.VITE_IDLE_MINUTES) || 15;
export const IDLE_MS = Math.max(3, minutes) * 60_000;
export const WARN_MS = 2 * 60_000; // "Still there?" at 2 minutes left
const KEEPALIVE_MS = 30_000;
const ACTIVITY_THROTTLE_MS = 1_000;
const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * @param {boolean} active  run only while signed in
 * @param {() => void} onExpire  called once when the countdown reaches 0
 * @returns {{ remainingMs: number, warning: boolean, stay: () => Promise<void> }}
 */
export default function useIdleTimer(active, onExpire) {
  const lastActivity = useRef(Date.now());
  const lastRequest = useRef(Date.now());
  const lastThrottle = useRef(0);
  const pinging = useRef(false);
  const warningRef = useRef(false);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const [remainingMs, setRemainingMs] = useState(IDLE_MS);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const keepAlive = useCallback(async () => {
    if (pinging.current) return;
    pinging.current = true;
    try {
      await authApi.me(); // success updates lastRequest through the request listener
    } catch {
      /* 401 is handled globally */
    } finally {
      pinging.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const now = Date.now();
    lastActivity.current = now;
    lastRequest.current = now;
    expiredRef.current = false;
    warningRef.current = false;
    setWarning(false);

    setRequestListener(() => {
      lastRequest.current = Date.now();
    });

    const onActivity = () => {
      const t = Date.now();
      if (t - lastThrottle.current < ACTIVITY_THROTTLE_MS) return;
      lastThrottle.current = t;
      if (warningRef.current) return; // while the modal is open the user must choose
      lastActivity.current = t;
      if (t - lastRequest.current > KEEPALIVE_MS) keepAlive();
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));

    const tick = () => {
      const deadline = Math.min(lastActivity.current, lastRequest.current) + IDLE_MS;
      const left = Math.max(0, deadline - Date.now());
      setRemainingMs(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current && onExpireRef.current();
      } else if (left <= WARN_MS && !warningRef.current) {
        warningRef.current = true;
        setWarning(true);
      }
    };
    tick();
    const id = setInterval(tick, 1_000);

    return () => {
      clearInterval(id);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      setRequestListener(null);
    };
  }, [active, keepAlive]);

  /** "Stay signed in": GET /auth/me refreshes the server session, then the countdown restarts. */
  const stay = useCallback(async () => {
    await authApi.me();
    const t = Date.now();
    lastActivity.current = t;
    lastRequest.current = t;
    warningRef.current = false;
    setWarning(false);
    setRemainingMs(IDLE_MS);
  }, []);

  return { remainingMs, warning, stay };
}

/** 754000 -> "12:34" */
export function mmss(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
