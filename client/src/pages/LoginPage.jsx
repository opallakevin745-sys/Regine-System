import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // After sign-in, return to the page that required login (or the dashboard).
  if (user) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  async function signIn(username, password) {
    setError('');
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (requestError) {
      setError(requestError.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-art" aria-hidden="true">
        <div className="login-art-inner">
          <span className="brand-mark large">ML</span>
          <h1>Built around <em>good food</em> and good work.</h1>
          <p>Sales, stock, suppliers, and people for Mutya Licios Lechon Manok, all in one workspace.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-brand"><span className="brand-mark">ML</span><span><strong>Mutya Licios</strong><small>Lechon Manok</small></span></div>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your operations workspace.</p>

          <form onSubmit={(event) => { event.preventDefault(); signIn(form.username, form.password); }} noValidate>
            <label className="field">
              <span className="field-label">Username</span>
              <input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Enter username" autoCapitalize="none" />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="password-input">
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter password" />
                <button type="button" className="icon-button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </span>
            </label>
            {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
            <button className="btn btn-primary btn-block btn-lg" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'} <Icon name="arrowRight" size={18} />
            </button>
          </form>

          <small className="login-note">Authorized personnel only</small>
        </div>
      </section>
    </main>
  );
}
