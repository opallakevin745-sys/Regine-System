import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute, { RequireRole } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { CrudPage, InventoryPage, PaymentsPage, ReceivingPage, SalesPage } from './pages/OperationsPage';
import { AuditPage, EmployeePage, ReportsPage, UserPage } from './pages/AdminPages';
import './styles.css';
import './operations.css';
import './adjustment.css';
import './final.css';
import './theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route element={<RequireRole roles={['Owner', 'Manager', 'Cashier', 'Staff']} />}>
                <Route path="/categories" element={<CrudPage mode="categories" />} />
                <Route path="/products" element={<CrudPage mode="products" />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/suppliers" element={<CrudPage mode="suppliers" />} />
              </Route>
              <Route element={<RequireRole roles={['Owner', 'Manager', 'Cashier']} />}>
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/new" element={<SalesPage />} />
                <Route path="/sales/:id" element={<SalesPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
              </Route>
              <Route element={<RequireRole roles={['Owner', 'Manager', 'Staff']} />}>
                <Route path="/stock-receiving" element={<ReceivingPage />} />
                <Route path="/stock-receiving/new" element={<ReceivingPage />} />
              </Route>
              <Route element={<RequireRole roles={['Owner', 'Manager']} />}>
                <Route path="/employees" element={<EmployeePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditPage />} />
              </Route>
              <Route element={<RequireRole roles={['Owner']} />}>
                <Route path="/users" element={<UserPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
