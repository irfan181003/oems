// Left sidebar: only the menu items allowed for the logged-in role (layout/menu.js)
import { NavLink } from 'react-router-dom';
import { menuFor } from './menu';

export default function Sidebar({ role, open, onNavigate }) {
  const items = menuFor(role);
  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`} id="sidebar" aria-label="Main menu">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M3 8h10M3 12h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span>
          <span className="brand__title">OEMS</span>
          <br />
          <span className="brand__sub">Office Employee Management</span>
        </span>
      </div>
      <nav className="nav">
        <span className="nav__label">{role}</span>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="nav__link" onClick={onNavigate}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
