import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-screen">Checking secure session...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

export function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Checking secure session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <section className="operation-page"><div className="inline-error" role="alert">Access denied. Your account does not have permission to view this page.</div></section>;
  }
  return <Outlet />;
}
