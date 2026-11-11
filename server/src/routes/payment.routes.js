import { Router } from 'express';
import { listPayments } from '../controllers/payment.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorize.js';
const router = Router();
router.use(authenticateToken);
router.get('/', authorizeRoles('Owner', 'Manager', 'Cashier'), listPayments);
export default router;
