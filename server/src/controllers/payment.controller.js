import { pool } from '../config/db.js';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export async function listPayments(req, res, next) {
  try {
    const where = ['1 = 1'];
    const values = [];
    const method = text(req.query.payment_method);
    const status = text(req.query.status);
    const search = text(req.query.search);
    const from = text(req.query.from);
    const to = text(req.query.to);
    if (['Cash', 'GCash', 'Bank Transfer', 'Other'].includes(method)) { where.push('p.payment_method = ?'); values.push(method); }
    if (['Paid', 'Pending', 'Cancelled', 'Refunded'].includes(status)) { where.push('p.payment_status = ?'); values.push(status); }
    if (search) { where.push('(s.sale_number LIKE ? OR p.reference_number LIKE ?)'); values.push(`%${search}%`, `%${search}%`); }
    if (isoDate.test(from)) { where.push('p.payment_date >= ?'); values.push(`${from} 00:00:00`); }
    if (isoDate.test(to)) { where.push('p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(`${to} 00:00:00`); }
    const [rows] = await pool.query(
      `SELECT p.id, p.sale_id, s.sale_number, p.payment_date, p.amount, p.amount_tendered, p.change_amount,
        p.payment_method, p.reference_number, p.payment_status, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM payments p INNER JOIN sales s ON s.id = p.sale_id INNER JOIN employees e ON e.id = s.employee_id
       WHERE ${where.join(' AND ')} ORDER BY p.payment_date DESC, p.id DESC LIMIT 200`,
      values
    );
    res.json({ success: true, data: { payments: rows } });
  } catch (error) { next(error); }
}
