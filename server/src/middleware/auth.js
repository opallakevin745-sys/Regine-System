import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

export async function authenticateToken(req, res, next) {
  if (env.authBypass) {
    req.user = { userId: 1, username: 'admin', role: 'Owner' };
    return next();
  }

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const claims = jwt.verify(token, env.jwtSecret);
    const userId = Number(claims.userId);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const [[user]] = await pool.query(
      `SELECT u.id, u.username, u.role, u.status, e.status AS employee_status
       FROM users u INNER JOIN employees e ON e.id = u.employee_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );
    if (!user || user.status !== 'Active' || user.employee_status !== 'Active') {
      return res.status(401).json({ success: false, message: 'Account is no longer active' });
    }

    req.user = { userId: user.id, username: user.username, role: user.role };
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError' && error.name !== 'NotBeforeError') {
      return next(error);
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
