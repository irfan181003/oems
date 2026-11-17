// NFR-21 | BR-26 | any role | 403 page — shown for another role's URL (inline, inside the app shell)
// and as the standalone /403 route.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homeFor } from '../layout/menu';

export default function AccessDenied({ inline = false }) {
  const { user } = useAuth();
  useEffect(() => {
    document.title = 'Access denied · OEMS';
  }, []);
  const card = (
    <div className="center-card" role="alert" style={inline ? { margin: '48px auto' } : undefined}>
      <span className="big-code" aria-hidden="true">403</span>
      <h1>Access denied</h1>
      <p className="muted">
        This page is not available for your role{user ? ` (${user.role})` : ''}. The attempt is not allowed by the
        system&apos;s role permissions.
      </p>
      <Link className="btn btn--primary" to={user ? homeFor(user.role) : '/login'}>
        {user ? 'Go to my home page' : 'Sign in'}
      </Link>
    </div>
  );
  return inline ? card : <div className="center-page">{card}</div>;
}
