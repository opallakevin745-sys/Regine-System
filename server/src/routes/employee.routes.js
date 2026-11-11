import { Router } from 'express';
import { createEmployee, getEmployee, listEmployees, updateEmployee, updateEmployeeStatus } from '../controllers/employee.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorize.js';
const router = Router();
router.use(authenticateToken);
// Employee records (phones, hire dates, linked accounts) are visible to Owner and Manager only.
router.get('/', authorizeRoles('Owner', 'Manager'), listEmployees);
router.get('/:id', authorizeRoles('Owner', 'Manager'), getEmployee);
router.post('/', authorizeRoles('Owner', 'Manager'), createEmployee);
router.put('/:id', authorizeRoles('Owner', 'Manager'), updateEmployee);
router.patch('/:id/status', authorizeRoles('Owner', 'Manager'), updateEmployeeStatus);
export default router;
