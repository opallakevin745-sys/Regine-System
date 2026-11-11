import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8');
const { name: databaseName, ...connectionConfig } = env.db;
const connection = await mysql.createConnection({ ...connectionConfig, multipleStatements: true });

async function columnExists(table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
     WHERE LOWER(table_schema) = LOWER(?) AND table_name = ? AND column_name = ?`,
    [databaseName, table, column]
  );
  return Number(rows[0].count) > 0;
}

try {
  await connection.query(schema);
  await connection.query(`USE \`${databaseName}\``);

  // Idempotent upgrades for databases created by earlier versions of the schema.
  await connection.query("ALTER TABLE payments MODIFY COLUMN payment_status ENUM('Paid', 'Pending', 'Cancelled', 'Refunded') NOT NULL DEFAULT 'Paid'");
  await connection.query("ALTER TABLE inventory_logs MODIFY COLUMN transaction_type ENUM('STOCK_RECEIVING', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT') NOT NULL");
  if (!(await columnExists('inventory_logs', 'reason'))) {
    await connection.query('ALTER TABLE inventory_logs ADD COLUMN reason VARCHAR(255) NULL AFTER reference_id');
  }
  if (!(await columnExists('payments', 'amount_tendered'))) {
    await connection.query('ALTER TABLE payments ADD COLUMN amount_tendered DECIMAL(12,2) NULL AFTER amount');
    // Older rows stored the tendered cash in `amount`; keep it as tendered and apply the sale total.
    await connection.query(
      `UPDATE payments p INNER JOIN sales s ON s.id = p.sale_id
       SET p.amount_tendered = p.amount, p.amount = LEAST(p.amount, s.total_amount)`
    );
  }
  if (!(await columnExists('payments', 'change_amount'))) {
    await connection.query('ALTER TABLE payments ADD COLUMN change_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER amount_tendered');
    await connection.query('UPDATE payments SET change_amount = GREATEST(COALESCE(amount_tendered, amount) - amount, 0)');
  }
  console.log(`Database schema ready: ${databaseName}`);
} finally {
  await connection.end();
}
