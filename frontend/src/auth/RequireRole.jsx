// NFR-21 | BR-26 — route guard. Not logged in -> /login; wrong role -> the 403 page (URL kept).
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AccessDenied from '../pages/AccessDenied';

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <AccessDenied inline />;
  return children;
}
