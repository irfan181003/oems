// Empty, error and access-denied states used inside cards and tables
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { homeFor } from '../layout/menu';

export function EmptyState({ title = 'Nothing here yet', children }) {
  return (
    <div className="state" role="status">
      <p className="state__title">{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Friendly "Access denied" block (BR-26). */
export function AccessDeniedState() {
  const { user } = useAuth();
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Access denied</p>
      <p>Your role does not allow this. The attempt has been recorded.</p>
      {user && (
        <Link className="btn" to={homeFor(user.role)}>
          Go to my home page
        </Link>
      )}
    </div>
  );
}

/** Error with a retry button; a 403 shows the access-denied state instead. */
export function ErrorState({ error, onRetry }) {
  if (error instanceof ApiError && error.status === 403) return <AccessDeniedState />;
  const message = error ? error.message : 'Something went wrong.';
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Could not load this data</p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
