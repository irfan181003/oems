// any role | 404 page
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homeFor } from '../layout/menu';

export default function NotFound() {
  const { user } = useAuth();
  useEffect(() => {
    document.title = 'Page not found · OEMS';
  }, []);
  return (
    <div className="center-page">
      <div className="center-card">
        <span className="big-code" aria-hidden="true">404</span>
        <h1>Page not found</h1>
        <p className="muted">The address you opened does not exist.</p>
        <Link className="btn btn--primary" to={user ? homeFor(user.role) : '/login'}>
          {user ? 'Go to my home page' : 'Sign in'}
        </Link>
      </div>
    </div>
  );
}
