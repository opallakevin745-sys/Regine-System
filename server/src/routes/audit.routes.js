import { Router } from 'express';
import { listAudit } from '../controllers/audit.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorize.js';
const router = Router();
router.use(authenticateToken, authorizeRoles('Owner', 'Manager'));
router.get('/', listAudit);
export default router;
