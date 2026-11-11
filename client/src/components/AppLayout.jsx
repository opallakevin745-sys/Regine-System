import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isDemo } from '../api';
import { ROLE_GROUPS } from '../lib/roles';
import Icon from './Icon';

export const navigation = [
  { group: 'Overview', items: [{ label: 'Dashboard', to: '/dashboard', icon: 'dashboard', roles: ROLE_GROUPS.everyone }] },
  {
    group: 'Sales',
    items: [
      { label: 'Point of Sale', to: '/sales/new', icon: 'pos', roles: ROLE_GROUPS.sellers },
      { label: 'Sales History', to: '/sales', icon: 'receipt', roles: ROLE_GROUPS.sellers, end: true },
      { label: 'Payments', to: '/payments', icon: 'payments', roles: ROLE_GROUPS.sellers }
    ]
  },
  {
    group: 'Inventory',
    items: [
      { label: 'Products', to: '/products', icon: 'products', roles: ROLE_GROUPS.everyone },
      { label: 'Categories', to: '/categories', icon: 'categories', roles: ROLE_GROUPS.everyone },
      { label: 'Inventory', to: '/inventory', icon: 'inventory', roles: ROLE_GROUPS.everyone },
      { label: 'Stock Receiving', to: '/stock-receiving', icon: 'receiving', roles: ROLE_GROUPS.receivers },
      { label: 'Suppliers', to: '/suppliers', icon: 'suppliers', roles: ROLE_GROUPS.everyone }
    ]
  },
  {
    group: 'Administration',
    items: [
      { label: 'Employees', to: '/employees', icon: 'employees', roles: ROLE_GROUPS.managers },
      { label: 'User Accounts', to: '/users', icon: 'users', roles: ROLE_GROUPS.owner },
      { label: 'Reports', to: '/reports', icon: 'reports', roles: ROLE_GROUPS.managers },
      { label: 'Audit Trail', to: '/audit', icon: 'audit', roles: ROLE_GROUPS.managers }
    ]
  }
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle('has-menu', menuOpen);
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    if (menuOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const groups = navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(user?.role)) }))
    .filter((group) => group.items.length);
  const initials = `${user?.firstName?.[0] || user?.username?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  async function resetDemo() {
    if (!window.confirm('Reset the demo? All changes made in this browser will be replaced with fresh sample data.')) return;
    setResetting(true);
    const { resetDemoData } = await import('../demo/demoServer.js');
    resetDemoData();
    window.location.reload();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className={`sidebar-backdrop${menuOpen ? ' is-visible' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} id="app-navigation" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">ML</span>
          <span className="brand-text"><strong>Mutya Licios</strong><small>Lechon Manok</small></span>
          <button type="button" className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.group}>
              <span className="nav-group-label">{group.group}</span>
              {group.items.map((item) => (
                <NavLink className="nav-item" to={item.to} end={item.end} key={item.to}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          {isDemo && (
            <div className="demo-card">
              <strong>Demo mode</strong>
              <span>Sample data is saved in this browser only.</span>
              <button type="button" onClick={resetDemo} disabled={resetting}><Icon name="refresh" size={14} />{resetting ? 'Resetting…' : 'Reset demo data'}</button>
            </div>
          )}
          <button type="button" className="nav-item logout-button" onClick={logout}><Icon name="logout" /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="app-navigation"
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar-brand" aria-hidden="true"><span className="brand-mark">ML</span><strong>Mutya Licios</strong></div>
          <div className="topbar-greeting">
            <strong>{greeting()}, {user?.firstName || user?.username}</strong>
            <span>{today}</span>
          </div>
          {isDemo && <span className="demo-pill">Demo</span>}
          <div className="user-chip" title={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}>
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="user-chip-text"><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.role}</small></span>
          </div>
        </header>
        <main className="main-content" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
