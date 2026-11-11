import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8');
const { name: databaseName, ...connectionConfig } = env.db;
const connection = await mysql.createConnection({ ...connectionConfig, multipleStatements: true });

try {
  await connection.query(schema);
  await connection.query("ALTER TABLE payments MODIFY COLUMN payment_status ENUM('Paid', 'Pending', 'Cancelled', 'Refunded') NOT NULL DEFAULT 'Paid'");
  await connection.query("ALTER TABLE inventory_logs MODIFY COLUMN transaction_type ENUM('STOCK_RECEIVING', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT') NOT NULL");
  const [reasonColumns] = await connection.query(`SELECT COUNT(*) AS count FROM information_schema.columns WHERE LOWER(table_schema) = LOWER(?) AND table_name = 'inventory_logs' AND column_name = 'reason'`, [env.db.name]);
  if (Number(reasonColumns[0].count) === 0) await connection.query('ALTER TABLE inventory_logs ADD COLUMN reason VARCHAR(255) NULL AFTER reference_id');
  console.log(`Database schema ready: ${env.db.name}`);
} finally {
  await connection.end();
}
