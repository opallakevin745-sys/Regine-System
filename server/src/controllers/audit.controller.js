import { pool } from '../config/db.js';

const transactionTypes = ['STOCK_RECEIVING', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT'];
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export async function listAudit(req, res, next) {
  try {
    const values = [];
    const where = [];
    const productId = Number(req.query.product_id);
    const type = text(req.query.transaction_type);
    const search = text(req.query.search);
    if (Number.isSafeInteger(productId) && productId > 0) { where.push('l.product_id = ?'); values.push(productId); }
    if (transactionTypes.includes(type)) { where.push('l.transaction_type = ?'); values.push(type); }
    if (search) {
      where.push("(p.product_name LIKE ? OR l.reason LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)");
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const [rows] = await pool.query(
      `SELECT l.id, l.created_at, l.product_id, p.product_name, p.unit, l.transaction_type, l.quantity, l.previous_stock, l.new_stock,
        l.reference_type, l.reference_id, l.reason, u.username, CONCAT(e.first_name, ' ', e.last_name) AS performed_by
       FROM inventory_logs l INNER JOIN products p ON p.id = l.product_id INNER JOIN users u ON u.id = l.user_id
       INNER JOIN employees e ON e.id = u.employee_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY l.created_at DESC, l.id DESC LIMIT 1000`,
      values
    );
    res.json({ success: true, data: { logs: rows } });
  } catch (error) { next(error); }
}
