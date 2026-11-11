import { pool } from '../config/db.js';
import { createSale } from '../services/sales.service.js';
import { cancelSale } from '../services/inventory.service.js';
import { HttpError } from '../utils/http-error.js';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export async function listSales(req, res, next) {
  try {
    const values = [];
    const where = ['1 = 1'];
    const status = text(req.query.status);
    const from = text(req.query.from);
    const to = text(req.query.to);
    const search = text(req.query.search);
    if (['Completed', 'Pending', 'Cancelled'].includes(status)) { where.push('s.sale_status = ?'); values.push(status); }
    if (isoDate.test(from)) { where.push('s.sale_date >= ?'); values.push(`${from} 00:00:00`); }
    if (isoDate.test(to)) { where.push('s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(`${to} 00:00:00`); }
    if (search) {
      where.push("(s.sale_number LIKE ? OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?)");
      values.push(`%${search}%`, `%${search}%`);
    }
    const [rows] = await pool.query(
      `SELECT s.id, s.sale_number, s.sale_date, s.subtotal, s.discount, s.total_amount, s.sale_status,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name, p.payment_method, p.amount AS payment_amount, p.payment_status,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
       FROM sales s INNER JOIN employees e ON e.id = s.employee_id LEFT JOIN payments p ON p.sale_id = s.id
       WHERE ${where.join(' AND ')} ORDER BY s.sale_date DESC, s.id DESC LIMIT 200`,
      values
    );
    res.json({ success: true, data: { sales: rows } });
  } catch (error) { next(error); }
}

export async function getSale(req, res, next) {
  try {
    const [[sale]] = await pool.query(
      `SELECT s.id, s.sale_number, s.sale_date, s.subtotal, s.discount, s.total_amount, s.sale_status,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name, p.payment_method, p.amount AS payment_amount,
        p.amount_tendered, p.change_amount, p.reference_number, p.payment_status
       FROM sales s INNER JOIN employees e ON e.id = s.employee_id LEFT JOIN payments p ON p.sale_id = s.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sale) throw new HttpError(404, 'Sale not found');
    const [items] = await pool.query(
      `SELECT si.id, si.product_id, p.product_code, p.product_name, p.unit, si.quantity, si.unit_price, si.subtotal
       FROM sale_items si INNER JOIN products p ON p.id = si.product_id WHERE si.sale_id = ? ORDER BY si.id`,
      [req.params.id]
    );
    res.json({ success: true, data: { sale: { ...sale, items } } });
  } catch (error) { next(error); }
}

export async function postSale(req, res, next) {
  try {
    const sale = await createSale({ userId: req.user.userId, items: req.body?.items, discount: req.body?.discount, payment: req.body?.payment });
    res.status(201).json({ success: true, message: 'Sale completed', data: { sale } });
  } catch (error) { next(error); }
}

export async function updateSaleStatus(req, res, next) {
  try {
    if (!['Pending', 'Cancelled'].includes(req.body?.status)) throw new HttpError(400, 'Only Pending or Cancelled status may be requested');
    const [[sale]] = await pool.query('SELECT sale_status FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) throw new HttpError(404, 'Sale not found');
    if (sale.sale_status === 'Completed') throw new HttpError(409, 'Completed sales cannot be changed without a stock-reversing workflow');
    await pool.query('UPDATE sales SET sale_status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true, message: 'Sale status updated' });
  } catch (error) { next(error); }
}

export async function cancelCompletedSale(req, res, next) {
  try {
    const sale = await cancelSale({ userId: req.user.userId, saleId: Number(req.params.id) });
    res.json({ success: true, message: 'Sale cancelled and inventory restored', data: { sale } });
  } catch (error) { next(error); }
}
