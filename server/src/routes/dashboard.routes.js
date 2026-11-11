import { Router } from 'express';
import { summary } from '../controllers/dashboard.controller.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.get('/summary', summary);
export default router;
