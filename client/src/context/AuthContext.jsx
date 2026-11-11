import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, setUnauthorizedHandler } from '../api';

const AuthContext = createContext(null);
const devBypass = import.meta.env.VITE_AUTH_BYPASS === 'true';
const devUser = { username: 'admin', role: 'Owner', firstName: 'System', lastName: 'Administrator' };

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
      return () => setUnauthorizedHandler(() => {});
    }

    if (!localStorage.getItem('mutya_token')) {
      setLoading(false);
      return () => setUnauthorizedHandler(() => {});
    }

    apiRequest('/auth/me')
      .then((response) => setUser(response.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    return () => setUnauthorizedHandler(() => {});
  }, []);

  async function login(username, password) {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('mutya_token', response.data.token);
    setUser(response.data.user);
  }

  async function logout() {
    const token = localStorage.getItem('mutya_token');
    localStorage.removeItem('mutya_token');
    setUser(null);
    setLoading(false);

    try {
      if (token) await apiRequest('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {}
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
