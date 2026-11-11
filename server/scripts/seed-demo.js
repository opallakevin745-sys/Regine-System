/*
 * Loads one month of sample business data (the same generator the GitHub Pages demo uses).
 *
 *   npm run db:demo
 *
 * Requirements: schema created (npm run db:init) and the Owner account seeded (npm run db:seed).
 * The existing Owner login is kept as-is. Demo staff accounts are created with the passwords
 * listed in README.md (override them all with SEED_DEMO_PASSWORD). The script refuses to run
 * when the database already holds business records, so it never mixes into real data.
 */
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { buildDemoData } from '../../client/src/demo/demoData.js';

const businessTables = ['categories', 'products', 'suppliers', 'sales', 'stock_receiving', 'inventory_logs'];
const insertOrder = ['employees', 'users', 'categories', 'suppliers', 'products', 'stock_receiving', 'stock_receiving_items', 'sales', 'sale_items', 'payments', 'inventory_logs'];

const connection = await pool.getConnection();
try {
  for (const table of businessTables) {
    const [[{ count }]] = await connection.query(`SELECT COUNT(*) AS count FROM ${table}`);
    if (Number(count) > 0) throw new Error(`Demo data was not loaded: table "${table}" already has ${count} row(s). Use an empty database.`);
  }
  const [[owner]] = await connection.query("SELECT u.id, u.employee_id FROM users u WHERE u.id = 1 AND u.role = 'Owner'");
  if (!owner || owner.employee_id !== 1) throw new Error('Owner account (user 1 / employee 1) not found. Run "npm run db:seed" first.');
  const [[{ extraEmployees }]] = await connection.query('SELECT COUNT(*) AS extraEmployees FROM employees WHERE id <> 1');
  if (Number(extraEmployees) > 0) throw new Error('Demo data was not loaded: employees other than the Owner already exist.');

  const data = buildDemoData(new Date());
  // Keep the real Owner employee and login untouched.
  data.employees = data.employees.filter((employee) => employee.id !== 1);
  const passwordOverride = process.env.SEED_DEMO_PASSWORD;
  data.users = await Promise.all(
    data.users
      .filter((user) => user.id !== 1)
      .map(async ({ password, ...user }) => ({ ...user, password_hash: await bcrypt.hash(passwordOverride || password, 10) }))
  );

  await connection.beginTransaction();
  for (const table of insertOrder) {
    const rows = data[table];
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    for (let start = 0; start < rows.length; start += 500) {
      const chunk = rows.slice(start, start + 500);
      await connection.query(
        `INSERT INTO ${table} (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ?`,
        [chunk.map((row) => columns.map((column) => row[column]))]
      );
    }
    console.log(`  ${table.padEnd(22)} ${rows.length}`);
  }
  await connection.commit();
  console.log('Demo data loaded. Staff logins: manager, cashier, cashier2, staff (see README for passwords).');
} catch (error) {
  await connection.rollback().catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
