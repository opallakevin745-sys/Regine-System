import { pool } from '../config/db.js';
import { createReceiving } from '../services/stock-receiving.service.js';
import { HttpError } from '../utils/http-error.js';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const selectReceiving = `SELECT r.id, r.receiving_number, r.receiving_date, r.reference_number, r.total_cost, r.status,
  r.supplier_id, s.supplier_name, CONCAT(e.first_name, ' ', e.last_name) AS received_by_name,
  (SELECT COUNT(*) FROM stock_receiving_items ri WHERE ri.receiving_id = r.id) AS item_count
  FROM stock_receiving r INNER JOIN suppliers s ON s.id = r.supplier_id INNER JOIN employees e ON e.id = r.received_by`;

export async function listReceiving(req, res, next) {
  try {
    const where = ['1 = 1'];
    const values = [];
    const search = text(req.query.search);
    const supplierId = Number(req.query.supplier_id);
    if (search) { where.push('(r.receiving_number LIKE ? OR r.reference_number LIKE ? OR s.supplier_name LIKE ?)'); values.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (Number.isSafeInteger(supplierId) && supplierId > 0) { where.push('r.supplier_id = ?'); values.push(supplierId); }
    const [rows] = await pool.query(`${selectReceiving} WHERE ${where.join(' AND ')} ORDER BY r.receiving_date DESC, r.id DESC LIMIT 200`, values);
    res.json({ success: true, data: { receiving: rows } });
  } catch (error) { next(error); }
}

export async function getReceiving(req, res, next) {
  try {
    const [[receiving]] = await pool.query(`${selectReceiving} WHERE r.id = ?`, [req.params.id]);
    if (!receiving) throw new HttpError(404, 'Receiving transaction not found');
    const [items] = await pool.query(
      `SELECT ri.product_id, p.product_code, p.product_name, p.unit, ri.quantity, ri.unit_cost, ri.subtotal
       FROM stock_receiving_items ri INNER JOIN products p ON p.id = ri.product_id WHERE ri.receiving_id = ? ORDER BY ri.id`,
      [req.params.id]
    );
    res.json({ success: true, data: { receiving: { ...receiving, items } } });
  } catch (error) { next(error); }
}

export async function postReceiving(req, res, next) {
  try {
    const receiving = await createReceiving({ userId: req.user.userId, supplierId: req.body?.supplier_id, items: req.body?.items, referenceNumber: req.body?.reference_number });
    res.status(201).json({ success: true, message: 'Stock receiving completed', data: { receiving } });
  } catch (error) { next(error); }
}
