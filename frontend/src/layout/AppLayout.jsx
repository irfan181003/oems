// Signed-in shell: sidebar + top bar + idle timer + routed content
import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => setMenuOpen(false), [location.pathname]);

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
