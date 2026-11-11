import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { publicUser } from '../utils/user.js';

const userQuery = `
  SELECT u.id, u.employee_id, u.username, u.password_hash, u.role, u.status,
         e.first_name, e.last_name, e.position, e.status AS employee_status
  FROM users u
  INNER JOIN employees e ON e.id = u.employee_id
`;

function createToken(user) {
  return jwt.sign({ userId: user.id, username: user.username, role: user.role }, env.jwtSecret, { expiresIn: '8h' });
}

export async function login(req, res, next) {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const [rows] = await pool.query(`${userQuery} WHERE u.username = ? LIMIT 1`, [username]);
    const user = rows[0];
    if (!user || user.status !== 'Active' || user.employee_status !== 'Active' || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    return res.json({ success: true, message: 'Login successful', data: { token: createToken(user), user: publicUser(user) } });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const [rows] = await pool.query(`${userQuery} WHERE u.id = ? LIMIT 1`, [req.user.userId]);
    const user = rows[0];
    if (!user || user.status !== 'Active' || user.employee_status !== 'Active') {
      return res.status(401).json({ success: false, message: 'Account is no longer active' });
    }
    return res.json({ success: true, data: { user: publicUser(user) } });
  } catch (error) {
    return next(error);
  }
}

export function logout(req, res) {
  res.json({ success: true, message: 'Logout successful' });
}
