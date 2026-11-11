import { Router } from 'express';
import { adjustInventory } from '../services/inventory.service.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken, authorizeRoles('Owner', 'Manager'));
router.post('/', async (req, res, next) => { try { const adjustment = await adjustInventory({ userId: req.user.userId, productId: Number(req.body?.product_id), quantity: req.body?.quantity, reason: req.body?.reason }); res.status(201).json({ success: true, message: 'Inventory adjusted', data: { adjustment } }); } catch (error) { next(error); } });
export default router;
