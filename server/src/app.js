import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { checkDatabase } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import categoryRoutes from './routes/category.routes.js';
import productRoutes from './routes/product.routes.js';
import salesRoutes from './routes/sales.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import stockReceivingRoutes from './routes/stock-receiving.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import userRoutes from './routes/user.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/report.routes.js';
import auditRoutes from './routes/audit.routes.js';
import adjustmentRoutes from './routes/adjustment.routes.js';
import { errorHandler, notFound } from './middleware/error-handler.js';

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? env.clientUrl : true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  let database = 'unavailable';
  try {
    await checkDatabase();
    database = 'connected';
  } catch {
    // Health remains useful when the API is running before MySQL is configured.
  }
  res.json({ success: true, message: 'API is running', data: { database } });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory/adjustments', adjustmentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stock-receiving', stockReceivingRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
