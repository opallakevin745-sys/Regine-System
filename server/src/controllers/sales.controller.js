import { pool } from '../config/db.js';
import { createSale } from '../services/sales.service.js';
import { cancelSale } from '../services/inventory.service.js';
import { HttpError } from '../utils/http-error.js';

export async function listSales(req, res, next) {
  try {
    const values = [];
    const where = ['1 = 1'];
    if (req.query.status && ['Completed', 'Pending', 'Cancelled'].includes(req.query.status)) { where.push('s.sale_status = ?'); values.push(req.query.status); }
    if (req.query.from) { where.push('DATE(s.sale_date) >= ?'); values.push(req.query.from); }
    if (req.query.to) { where.push('DATE(s.sale_date) <= ?'); values.push(req.query.to); }
    if (req.query.search) { where.push('s.sale_number LIKE ?'); values.push(`%${req.query.search.trim()}%`); }
    const [rows] = await pool.query(`SELECT s.id, s.sale_number, s.sale_date, s.subtotal, s.discount, s.total_amount, s.sale_status, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, p.payment_method, p.amount AS payment_amount, p.payment_status FROM sales s INNER JOIN employees e ON e.id = s.employee_id LEFT JOIN payments p ON p.sale_id = s.id WHERE ${where.join(' AND ')} ORDER BY s.sale_date DESC LIMIT 200`, values);
    res.json({ success: true, data: { sales: rows } });
  } catch (error) { next(error); }
}

export async function getSale(req, res, next) {
  try {
    const [[sale]] = await pool.query(`SELECT s.id, s.sale_number, s.sale_date, s.subtotal, s.discount, s.total_amount, s.sale_status, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, p.payment_method, p.amount AS payment_amount, p.reference_number, p.payment_status FROM sales s INNER JOIN employees e ON e.id = s.employee_id LEFT JOIN payments p ON p.sale_id = s.id WHERE s.id = ?`, [req.params.id]);
    if (!sale) throw new HttpError(404, 'Sale not found');
    const [items] = await pool.query('SELECT si.id, si.product_id, p.product_code, p.product_name, si.quantity, si.unit_price, si.subtotal FROM sale_items si INNER JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?', [req.params.id]);
    res.json({ success: true, data: { sale: { ...sale, items } } });
  } catch (error) { next(error); }
}

export async function postSale(req, res, next) {
  try { const sale = await createSale({ userId: req.user.userId, items: req.body?.items, discount: req.body?.discount, payment: req.body?.payment }); res.status(201).json({ success: true, message: 'Sale completed', data: { sale } }); } catch (error) { next(error); }
}

export async function updateSaleStatus(req, res, next) {
  try {
    if (!['Pending', 'Cancelled'].includes(req.body?.status)) throw new HttpError(400, 'Only Pending or Cancelled status may be requested');
    const [[sale]] = await pool.query('SELECT sale_status FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) throw new HttpError(404, 'Sale not found');
    if (sale.sale_status === 'Completed') throw new HttpError(409, 'Completed sales cannot be changed without a stock-reversing workflow');
    const [result] = await pool.query('UPDATE sales SET sale_status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true, message: 'Sale status updated' });
  } catch (error) { next(error); }
}

export async function cancelCompletedSale(req, res, next) {
  try {
    const sale = await cancelSale({ userId: req.user.userId, saleId: Number(req.params.id) });
    res.json({ success: true, message: 'Sale cancelled and inventory restored', data: { sale } });
  } catch (error) { next(error); }
}
