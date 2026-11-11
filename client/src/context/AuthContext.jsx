import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, setUnauthorizedHandler } from '../api';

const AuthContext = createContext(null);
// Development-only shortcut; ignored in production builds.
const devBypass = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === 'true';
const devUser = { id: 1, username: 'admin', role: 'Owner', firstName: 'System', lastName: 'Administrator' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem('mutya_token');
      setUser(null);
      setLoading(false);
    });

    if (devBypass) {
      setUser(devUser);
      setLoading(false);
    } else if (!localStorage.getItem('mutya_token')) {
      setLoading(false);
    } else {
      apiRequest('/auth/me')
        .then((response) => setUser(response.data.user))
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    }
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const login = useCallback(async (username, password) => {
    const response = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    localStorage.setItem('mutya_token', response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem('mutya_token')) await apiRequest('/auth/logout', { method: 'POST' });
    } catch { /* the token is discarded either way */ }
    localStorage.removeItem('mutya_token');
    setUser(null);
    setLoading(false);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
