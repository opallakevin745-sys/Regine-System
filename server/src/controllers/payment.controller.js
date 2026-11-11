import { pool } from '../config/db.js';

export async function listPayments(req, res, next) {
  try { const [rows] = await pool.query(`SELECT p.id, p.sale_id, s.sale_number, p.payment_date, p.amount, p.payment_method, p.reference_number, p.payment_status FROM payments p INNER JOIN sales s ON s.id = p.sale_id ORDER BY p.payment_date DESC LIMIT 200`); res.json({ success: true, data: { payments: rows } }); } catch (error) { next(error); }
}
