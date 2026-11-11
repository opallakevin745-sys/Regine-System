import { pool } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

export async function listCategories(req, res, next) {
  try {
    const search = `%${String(req.query.search || '').trim()}%`;
    const values = [search];
    const where = ['c.category_name LIKE ?'];
    if (['Active', 'Inactive'].includes(req.query.status)) {
      where.push('c.status = ?');
      values.push(req.query.status);
    }
    const [rows] = await pool.query(
      `SELECT c.id, c.category_name, c.description, c.status, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c WHERE ${where.join(' AND ')} ORDER BY c.category_name`,
      values
    );
    res.json({ success: true, data: { categories: rows } });
  } catch (error) { next(error); }
}

export async function getCategory(req, res, next) {
  try {
    const [[category]] = await pool.query('SELECT id, category_name, description, status, created_at, updated_at FROM categories WHERE id = ?', [req.params.id]);
    if (!category) throw new HttpError(404, 'Category not found');
    res.json({ success: true, data: { category } });
  } catch (error) { next(error); }
}

export async function createCategory(req, res, next) {
  try {
    const name = String(req.body?.category_name || '').trim();
    if (!name) throw new HttpError(400, 'Category name is required');
    const [result] = await pool.query('INSERT INTO categories (category_name, description) VALUES (?, ?)', [name, req.body.description?.trim() || null]);
    res.status(201).json({ success: true, message: 'Category created', data: { id: result.insertId } });
  } catch (error) { next(error); }
}

export async function updateCategory(req, res, next) {
  try {
    const name = String(req.body?.category_name || '').trim();
    if (!name) throw new HttpError(400, 'Category name is required');
    const [result] = await pool.query('UPDATE categories SET category_name = ?, description = ? WHERE id = ?', [name, req.body.description?.trim() || null, req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'Category not found');
    res.json({ success: true, message: 'Category updated' });
  } catch (error) { next(error); }
}

export async function updateCategoryStatus(req, res, next) {
  try {
    const status = req.body?.status;
    if (!['Active', 'Inactive'].includes(status)) throw new HttpError(400, 'Invalid category status');
    const [result] = await pool.query('UPDATE categories SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'Category not found');
    res.json({ success: true, message: 'Category status updated' });
  } catch (error) { next(error); }
}
