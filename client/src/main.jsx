import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute, { RequireRole } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import { ROLE_GROUPS } from './lib/roles';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PosPage from './pages/PosPage';
import { SaleDetailPage, SalesHistoryPage } from './pages/SalesPages';
import PaymentsPage from './pages/PaymentsPage';
import { CategoriesPage, ProductsPage, SuppliersPage } from './pages/CatalogPages';
import InventoryPage from './pages/InventoryPage';
import { NewReceivingPage, ReceivingListPage } from './pages/ReceivingPages';
import { EmployeesPage, UsersPage } from './pages/PeoplePages';
import { AuditPage, ReportsPage } from './pages/InsightPages';
import './styles/app.css';

// On GitHub Pages the app lives under /<repository>/; BASE_URL carries that prefix.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route element={<RequireRole roles={ROLE_GROUPS.sellers} />}>
                <Route path="/sales" element={<SalesHistoryPage />} />
                <Route path="/sales/new" element={<PosPage />} />
                <Route path="/sales/:id" element={<SaleDetailPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
              </Route>
              <Route element={<RequireRole roles={ROLE_GROUPS.receivers} />}>
                <Route path="/stock-receiving" element={<ReceivingListPage />} />
                <Route path="/stock-receiving/new" element={<NewReceivingPage />} />
              </Route>
              <Route element={<RequireRole roles={ROLE_GROUPS.managers} />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditPage />} />
              </Route>
              <Route element={<RequireRole roles={ROLE_GROUPS.owner} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
