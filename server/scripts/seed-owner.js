import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const password = process.env.SEED_ADMIN_PASSWORD;
if (!password || password.length < 8) {
  throw new Error('Set SEED_ADMIN_PASSWORD to a local password of at least 8 characters before seeding.');
}

const passwordHash = await bcrypt.hash(password, 12);
const connection = await pool.getConnection();

try {
  await connection.beginTransaction();
  const [employees] = await connection.query(
    `INSERT INTO employees (employee_code, first_name, last_name, position, hire_date)
     VALUES (?, ?, ?, ?, CURRENT_DATE)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    ['EMP-0001', 'System', 'Administrator', 'Owner']
  );
  const employeeId = employees.insertId;
  await connection.query(
    `INSERT INTO users (employee_id, username, password_hash, role)
     VALUES (?, ?, ?, 'Owner')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'Owner', status = 'Active'`,
    [employeeId, 'admin', passwordHash]
  );
  await connection.commit();
  console.log('Owner account ready: username admin');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
