import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navigation = [
  ['Dashboard', '/dashboard', '▣'],
  ['Sales', '/sales', '₱'],
  ['Products', '/products', '▦'],
  ['Categories', '/categories', '◈'],
  ['Inventory', '/inventory', '◫'],
  ['Suppliers', '/suppliers', '♧'],
  ['Stock Receiving', '/stock-receiving', '↓'],
  ['Payments', '/payments', '◎'],
  ['Employees', '/employees', '♙'],
  ['User Accounts', '/users', '⊙'],
  ['Reports', '/reports', '▤'],
  ['Audit', '/audit', '✓']
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const visibleNavigation = navigation.filter(([, path]) => {
    if (path === '/users') return user?.role === 'Owner';
    if (['/employees', '/reports', '/audit'].includes(path)) return ['Owner', 'Manager'].includes(user?.role);
    if (path === '/sales' || path === '/payments') return ['Owner', 'Manager', 'Cashier'].includes(user?.role);
    if (path === '/stock-receiving') return ['Owner', 'Manager', 'Staff'].includes(user?.role);
    return true;
  });

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop${menuOpen ? ' is-visible' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="sidebar-header"><div className="brand"><span className="brand-mark">ML</span><span><strong>Mutya Licios</strong><small>Lechon Manok</small></span></div></div>
        <nav>{visibleNavigation.map(([label, path, icon]) => <NavLink className="nav-item" to={path} key={label}><i>{icon}</i>{label}</NavLink>)}</nav>
        <button className="logout-button" onClick={logout}><span>↪</span> Sign out</button>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-brand"><span className="brand-mark">ML</span><span><strong>Mutya Licios</strong><small>Lechon Manok</small></span></div>
            <div><h1>Good day, {user?.firstName || user?.username}</h1></div>
          </div>
          <button
            type="button"
            className={`menu-button${menuOpen ? ' is-open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
