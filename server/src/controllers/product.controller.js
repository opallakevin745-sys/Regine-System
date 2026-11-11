import { pool } from '../config/db.js';
import { HttpError, requireNonNegativeNumber } from '../utils/http-error.js';

const selectProducts = `SELECT p.id, p.category_id, c.category_name, p.product_code, p.product_name, p.description, p.unit, p.cost_price, p.selling_price, p.stock_quantity, p.reorder_level, p.status, p.created_at, p.updated_at, (p.stock_quantity <= p.reorder_level) AS is_low_stock FROM products p INNER JOIN categories c ON c.id = p.category_id`;

export async function listProducts(req, res, next) {
  try {
    const values = [];
    const where = ['(p.product_name LIKE ? OR p.product_code LIKE ?)'];
    const search = `%${String(req.query.search || '').trim()}%`;
    values.push(search, search);
    if (req.query.category_id) { where.push('p.category_id = ?'); values.push(Number(req.query.category_id)); }
    if (['Active', 'Inactive'].includes(req.query.status)) { where.push('p.status = ?'); values.push(req.query.status); }
    if (req.query.low_stock === 'true') where.push('p.stock_quantity <= p.reorder_level');
    const [rows] = await pool.query(`${selectProducts} WHERE ${where.join(' AND ')} ORDER BY p.product_name`, values);
    res.json({ success: true, data: { products: rows } });
  } catch (error) { next(error); }
}

export async function getProduct(req, res, next) {
  try {
    const [[product]] = await pool.query(`${selectProducts} WHERE p.id = ?`, [req.params.id]);
    if (!product) throw new HttpError(404, 'Product not found');
    res.json({ success: true, data: { product } });
  } catch (error) { next(error); }
}

async function validateCategory(categoryId) {
  const [[category]] = await pool.query("SELECT id FROM categories WHERE id = ? AND status = 'Active'", [categoryId]);
  if (!category) throw new HttpError(400, 'A valid active category is required');
}

function productFields(body) {
  const productName = String(body?.product_name || '').trim();
  const productCode = String(body?.product_code || '').trim();
  if (!productName || !productCode) throw new HttpError(400, 'Product code and product name are required');
  const categoryId = Number(body.category_id);
  if (!Number.isInteger(categoryId)) throw new HttpError(400, 'A valid category is required');
  const costPrice = requireNonNegativeNumber(body.cost_price, 'Cost price');
  const sellingPrice = requireNonNegativeNumber(body.selling_price, 'Selling price');
  const reorderLevel = requireNonNegativeNumber(body.reorder_level ?? 0, 'Reorder level');
  return { productName, productCode, categoryId, costPrice, sellingPrice, reorderLevel, unit: String(body.unit || 'piece').trim() || 'piece', description: String(body.description || '').trim() || null };
}

export async function createProduct(req, res, next) {
  try {
    const fields = productFields(req.body);
    await validateCategory(fields.categoryId);
    const [result] = await pool.query(`INSERT INTO products (category_id, product_code, product_name, description, unit, cost_price, selling_price, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [fields.categoryId, fields.productCode, fields.productName, fields.description, fields.unit, fields.costPrice, fields.sellingPrice, fields.reorderLevel]);
    res.status(201).json({ success: true, message: 'Product created', data: { id: result.insertId } });
  } catch (error) { next(error); }
}

export async function updateProduct(req, res, next) {
  try {
    const fields = productFields(req.body);
    await validateCategory(fields.categoryId);
    const [result] = await pool.query(`UPDATE products SET category_id = ?, product_code = ?, product_name = ?, description = ?, unit = ?, cost_price = ?, selling_price = ?, reorder_level = ? WHERE id = ?`, [fields.categoryId, fields.productCode, fields.productName, fields.description, fields.unit, fields.costPrice, fields.sellingPrice, fields.reorderLevel, req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'Product not found');
    res.json({ success: true, message: 'Product updated' });
  } catch (error) { next(error); }
}

export async function updateProductStatus(req, res, next) {
  try {
    if (!['Active', 'Inactive'].includes(req.body?.status)) throw new HttpError(400, 'Invalid product status');
    const [result] = await pool.query('UPDATE products SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'Product not found');
    res.json({ success: true, message: 'Product status updated' });
  } catch (error) { next(error); }
}
