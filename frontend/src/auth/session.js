// Session storage (FRONTEND_PROMPT §3): the token lives in sessionStorage, so it is cleared when the tab closes.
// Tokens are never logged and never put in URLs.
const TOKEN_KEY = 'oems.token';
const USER_KEY = 'oems.user';
const FLASH_KEY = 'oems.flash';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const getToken = () => safe(() => sessionStorage.getItem(TOKEN_KEY));

export const getStoredUser = () =>
  safe(() => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

export function setSession(token, user) {
  safe(() => {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  });
}

export function clearSession() {
  safe(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  });
}

/** One-time message shown on the login page (e.g. "Your session has ended"). */
export const setFlash = (message) => safe(() => sessionStorage.setItem(FLASH_KEY, message));
export function takeFlash() {
  return safe(() => {
    const m = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return m;
  });
}
