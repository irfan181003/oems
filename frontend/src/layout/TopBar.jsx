// Top bar: user name, role badge, "Session ends in mm:ss" hint, Logout (role strip is the 3px top border)
import { mmss, WARN_MS } from '../auth/useIdleTimer';

export default function TopBar({ user, remainingMs, onLogout, onToggleMenu, menuOpen }) {
  const soon = remainingMs <= WARN_MS;
  return (
    <header className="topbar">
      <button
        type="button"
        className="btn btn--ghost btn--icon topbar__menu"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-controls="sidebar"
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className="topbar__spacer" />
      <span className="badge badge--role">{user.role}</span>
      <div className="topbar__user">
        <span className="topbar__name">{user.name}</span>
        <span className={`topbar__session${soon ? ' topbar__session--soon' : ''}`}>
          Session ends in <span className="mono">{mmss(remainingMs)}</span>
        </span>
      </div>
      <button type="button" className="btn" onClick={onLogout}>
        Logout
      </button>
    </header>
  );
}
