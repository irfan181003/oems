// NFR-22 | BR-27 | Public | API: POST /auth/login, GET /auth/me
// Centred card; employee ID or e-mail + password; generic error message; shows nothing about roles.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { takeFlash } from '../auth/session';
import FormField from '../components/FormField';
import { homeFor } from '../layout/menu';

/**
 * Only plain in-app paths may be used as the post-login destination: must start with a single "/" and contain no
 * backslash or scheme (guards against open redirects such as "//evil.example" or "/\evil.example").
 */
function safeInternalPath(p) {
  if (typeof p !== 'string') return null;
  return /^\/(?![/\\])[A-Za-z0-9/_\-.]*$/.test(p) ? p : null;
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [flash] = useState(() => takeFlash());
  const [form, setForm] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Sign in · OEMS';
  }, []);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const fe = {};
    if (!form.login.trim()) fe.login = 'Enter your Employee ID or Email Address';
    if (!form.password) fe.password = 'Enter your password';
    setErrors(fe);
    setError('');
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      const me = await login(form.login.trim(), form.password);
      const from = safeInternalPath(location.state && location.state.from);
      navigate(from && from !== '/login' ? from : homeFor(me.role), { replace: true });
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 429) setError('Too many sign-in attempts. Please wait a few minutes and try again.');
      else if (err instanceof ApiError && err.status === 0) setError(err.message);
      else setError('Invalid login or password.');
    }
  };

  return (
    <div className="center-page">
      <form className="center-card" onSubmit={onSubmit} noValidate aria-describedby={error ? 'login-error' : undefined}>
        <div>
          <h1>Sign in</h1>
          <p className="muted">Office Employee Management System</p>
        </div>
        {flash && <div className="alert alert--info">{flash}</div>}
        {error && (
          <div className="alert alert--error" id="login-error" role="alert">
            {error}
          </div>
        )}
        <FormField label="Employee ID or Email Address" error={errors.login} required>
          <input
            className="input"
            name="login"
            autoComplete="username"
            value={form.login}
            onChange={onChange}
            autoFocus
          />
        </FormField>
        <FormField label="Password" error={errors.password} required>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={onChange}
          />
        </FormField>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
