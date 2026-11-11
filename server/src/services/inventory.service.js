import { pool } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

export async function adjustInventory({ userId, productId, quantity, reason }) {
  const adjustment = Number(quantity);
  if (!Number.isFinite(adjustment) || adjustment === 0) throw new HttpError(400, 'Adjustment quantity cannot be zero');
  if (!String(reason || '').trim()) throw new HttpError(400, 'An adjustment reason is required');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[product]] = await connection.query('SELECT id, product_name, stock_quantity FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (!product) throw new HttpError(404, 'Product not found');
    const previousStock = Number(product.stock_quantity);
    const newStock = previousStock + adjustment;
    if (newStock < 0) throw new HttpError(409, 'Adjustment would create negative inventory');
    await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, productId]);
    await connection.query(`INSERT INTO inventory_logs (product_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, reason) VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, 'ADJUSTMENT', ?, ?)`, [productId, userId, adjustment, previousStock, newStock, productId, String(reason).trim()]);
    await connection.commit();
    return { product_id: productId, previous_stock: previousStock, new_stock: newStock, quantity: adjustment, reason: String(reason).trim() };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelSale({ userId, saleId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[sale]] = await connection.query('SELECT id, sale_status FROM sales WHERE id = ? FOR UPDATE', [saleId]);
    if (!sale) throw new HttpError(404, 'Sale not found');
    if (sale.sale_status !== 'Completed') throw new HttpError(409, 'Only completed sales can be cancelled once');
    const [items] = await connection.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ? ORDER BY product_id FOR UPDATE', [saleId]);
    for (const item of items) {
      const [[product]] = await connection.query('SELECT id, product_name, stock_quantity FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!product) throw new HttpError(409, 'A product from this sale no longer exists');
      const previousStock = Number(product.stock_quantity);
      const newStock = previousStock + Number(item.quantity);
      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, product.id]);
      await connection.query(`INSERT INTO inventory_logs (product_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, reason) VALUES (?, ?, 'SALE_CANCELLED', ?, ?, ?, 'SALE', ?, ?)`, [product.id, userId, item.quantity, previousStock, newStock, saleId, 'Completed sale cancellation']);
    }
    await connection.query("UPDATE sales SET sale_status = 'Cancelled' WHERE id = ?", [saleId]);
    await connection.query("UPDATE payments SET payment_status = 'Cancelled' WHERE sale_id = ?", [saleId]);
    await connection.commit();
    return { id: saleId, status: 'Cancelled' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
