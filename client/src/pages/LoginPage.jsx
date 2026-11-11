import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password) return setError('Enter your username and password.');
    setSubmitting(true);
    try {
      await login(form.username, form.password);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-art"><div className="art-copy"><span className="eyebrow light">MUTYA LICIOS</span><h1>Built around<br /><i>good food</i> and<br />good work.</h1><p>A focused workspace for keeping every part of the business moving.</p></div><div className="art-stamp">ML<br /><small>EST. 2026</small></div></section><section className="login-panel"><div className="login-form-wrap"><div className="mobile-brand"><span className="brand-mark">ML</span><strong>Mutya Licios</strong></div><span className="eyebrow">STAFF ACCESS</span><h2>Welcome back</h2><p className="muted">Sign in to your operations workspace.</p><form onSubmit={handleSubmit} noValidate><label>Username<input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Enter username" /></label><label>Password<div className="password-input" style={{ position: 'relative' }}><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter password" style={{ paddingRight: '46px' }} /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '28px', height: '28px', border: 'none', background: 'transparent', color: '#7c827a', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer', margin: 0, lineHeight: 0 }}>{showPassword ? (<svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', stroke: 'currentColor', fill: 'none', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>) : (<svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', stroke: 'currentColor', fill: 'none', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', display: 'block' }}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>)}</button></div></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}<span>→</span></button></form><small className="login-note">Authorized personnel only</small></div></section></main>;
}
