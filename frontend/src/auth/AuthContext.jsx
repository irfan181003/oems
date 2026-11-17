// NFR-22 | BR-27 — authentication state (React context; no state library)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from '../api/client';
import { auth as authApi } from '../api/endpoints';
import { clearSession, getStoredUser, getToken, setFlash, setSession } from './session';

export const SESSION_ENDED = 'Your session has ended. Please sign in again.';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [checking, setChecking] = useState(() => Boolean(getToken()));
  const endingRef = useRef(false);

  /** Session is gone (401 from the server, idle timeout or sign-out): clear and go to /login. */
  const endSession = useCallback(
    (message) => {
      clearSession();
      setUser(null);
      if (message) setFlash(message);
      navigate('/login', { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (endingRef.current) return;
      endingRef.current = true;
      endSession(SESSION_ENDED);
      setTimeout(() => {
        endingRef.current = false;
      }, 0);
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // On reload, confirm the stored token is still valid.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        setSession(getToken(), res.data);
        setUser(res.data);
      })
      .catch(() => {
        /* a 401 is handled by the unauthorized handler */
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** POST /auth/login, then GET /auth/me -> {employee_id, name, role}. */
  const login = useCallback(async (loginId, password) => {
    const res = await authApi.login(loginId, password);
    setSession(res.data.token, null);
    const me = await authApi.me();
    setSession(res.data.token, me.data);
    setUser(me.data);
    return me.data;
  }, []);

  /** POST /auth/logout (best effort), then clear the session. */
  const logout = useCallback(
    async (message) => {
      try {
        if (getToken()) await authApi.logout();
      } catch {
        /* the session may already be gone */
      }
      endSession(message);
    },
    [endSession]
  );

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
