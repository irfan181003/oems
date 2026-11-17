// Signed-in shell: sidebar + top bar + idle timer + routed content
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth, SESSION_ENDED } from '../auth/AuthContext';
import useIdleTimer from '../auth/useIdleTimer';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import IdleModal from './IdleModal';
import { colorFor } from './menu';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const expire = useCallback(() => logout(SESSION_ENDED), [logout]);
  const { remainingMs, warning, stay } = useIdleTimer(Boolean(user), expire);

  // On navigation: close the slide-over menu and move focus to the new page content (keyboard / screen readers)
  const firstRender = useRef(true);
  useEffect(() => {
    setMenuOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  }, [location.pathname]);

  // Escape closes the slide-over menu
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (!user) return null;
  return (
    <div className="app" style={{ '--role': colorFor(user.role) }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar role={user.role} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <TopBar
        user={user}
        remainingMs={remainingMs}
        onLogout={() => logout()}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((o) => !o)}
      />
      <main className="main" id="main" tabIndex={-1}>
        <div className="content">
          <Outlet />
        </div>
      </main>
      <IdleModal open={warning} remainingMs={remainingMs} onStay={stay} onSignOut={() => logout()} />
    </div>
  );
}
