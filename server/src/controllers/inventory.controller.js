import { pool } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

export async function listInventory(req, res, next) {
  try {
    const [rows] = await pool.query(`SELECT p.id, p.product_code, p.product_name, c.category_name, p.unit, p.stock_quantity, p.reorder_level, p.status, CASE WHEN p.stock_quantity = 0 THEN 'Out of Stock' WHEN p.stock_quantity <= p.reorder_level THEN 'Low Stock' ELSE 'In Stock' END AS stock_status FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE p.product_name LIKE ? ORDER BY p.product_name`, [`%${String(req.query.search || '').trim()}%`]);
    res.json({ success: true, data: { inventory: rows } });
  } catch (error) { next(error); }
}

export async function lowStock(req, res, next) {
  try { const [rows] = await pool.query(`SELECT p.id, p.product_code, p.product_name, c.category_name, p.unit, p.stock_quantity, p.reorder_level, p.status FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE p.status = 'Active' AND p.stock_quantity <= p.reorder_level ORDER BY p.stock_quantity, p.product_name`); res.json({ success: true, data: { products: rows } }); } catch (error) { next(error); }
}

export async function getInventoryProduct(req, res, next) {
  try {
    const [[product]] = await pool.query(`SELECT p.id, p.product_code, p.product_name, c.category_name, p.unit, p.stock_quantity, p.reorder_level, p.status, CASE WHEN p.stock_quantity = 0 THEN 'Out of Stock' WHEN p.stock_quantity <= p.reorder_level THEN 'Low Stock' ELSE 'In Stock' END AS stock_status FROM products p INNER JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, [req.params.productId]);
    if (!product) throw new HttpError(404, 'Inventory product not found');
    res.json({ success: true, data: { inventory: product } });
  } catch (error) { next(error); }
}

export async function productLogs(req, res, next) {
  try {
    const [[product]] = await pool.query('SELECT id, product_name FROM products WHERE id = ?', [req.params.productId]);
    if (!product) throw new HttpError(404, 'Product not found');
    const [logs] = await pool.query(`SELECT l.id, l.transaction_type, l.quantity, l.previous_stock, l.new_stock, l.reference_type, l.reference_id, l.reason, l.created_at, u.username, CONCAT(e.first_name, ' ', e.last_name) AS performed_by FROM inventory_logs l INNER JOIN users u ON u.id = l.user_id INNER JOIN employees e ON e.id = u.employee_id WHERE l.product_id = ? ORDER BY l.created_at DESC`, [req.params.productId]);
    res.json({ success: true, data: { product, logs } });
  } catch (error) { next(error); }
}
