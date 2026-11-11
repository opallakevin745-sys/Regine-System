import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AccessDenied } from './ui';

function SessionCheck() {
  return <div className="loading-screen" role="status"><span className="spinner" aria-hidden="true" />Checking your session…</div>;
}

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SessionCheck />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

export function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <SessionCheck />;
  if (!user) return <Navigate to="/login" replace />;
  return roles.includes(user.role) ? <Outlet /> : <AccessDenied />;
}
