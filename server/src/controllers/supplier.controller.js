import { pool } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

export async function listSuppliers(req, res, next) {
  try {
    const search = `%${String(req.query.search || '').trim()}%`;
    const values = [search, search];
    const where = ['(supplier_code LIKE ? OR supplier_name LIKE ?)'];
    if (['Active', 'Inactive'].includes(req.query.status)) {
      where.push('status = ?');
      values.push(req.query.status);
    }
    const [rows] = await pool.query(`SELECT id, supplier_code, supplier_name, contact_person, phone, address, status, created_at, updated_at FROM suppliers WHERE ${where.join(' AND ')} ORDER BY supplier_name`, values);
    res.json({ success: true, data: { suppliers: rows } });
  } catch (error) { next(error); }
}

export async function getSupplier(req, res, next) {
  try {
    const [[supplier]] = await pool.query('SELECT id, supplier_code, supplier_name, contact_person, phone, address, status, created_at, updated_at FROM suppliers WHERE id = ?', [req.params.id]);
    if (!supplier) throw new HttpError(404, 'Supplier not found');
    res.json({ success: true, data: { supplier } });
  } catch (error) { next(error); }
}

function fields(body) {
  const supplierCode = String(body?.supplier_code || '').trim();
  const supplierName = String(body?.supplier_name || '').trim();
  if (!supplierCode || !supplierName) throw new HttpError(400, 'Supplier code and supplier name are required');
  return [supplierCode, supplierName, String(body.contact_person || '').trim() || null, String(body.phone || '').trim() || null, String(body.address || '').trim() || null];
}

export async function createSupplier(req, res, next) {
  try { const [result] = await pool.query('INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone, address) VALUES (?, ?, ?, ?, ?)', fields(req.body)); res.status(201).json({ success: true, message: 'Supplier created', data: { id: result.insertId } }); } catch (error) { next(error); }
}

export async function updateSupplier(req, res, next) {
  try { const [result] = await pool.query('UPDATE suppliers SET supplier_code = ?, supplier_name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?', [...fields(req.body), req.params.id]); if (!result.affectedRows) throw new HttpError(404, 'Supplier not found'); res.json({ success: true, message: 'Supplier updated' }); } catch (error) { next(error); }
}

export async function updateSupplierStatus(req, res, next) {
  try { if (!['Active', 'Inactive'].includes(req.body?.status)) throw new HttpError(400, 'Invalid supplier status'); const [result] = await pool.query('UPDATE suppliers SET status = ? WHERE id = ?', [req.body.status, req.params.id]); if (!result.affectedRows) throw new HttpError(404, 'Supplier not found'); res.json({ success: true, message: 'Supplier status updated' }); } catch (error) { next(error); }
}
