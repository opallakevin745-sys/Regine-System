import { pool } from '../config/db.js';
import { HttpError, centsToMoney, generateNumber, moneyToCents, requireNonNegativeNumber, requirePositiveNumber } from '../utils/http-error.js';

export async function createReceiving({ userId, supplierId, items, referenceNumber }) {
  if (!Number.isInteger(Number(supplierId))) throw new HttpError(400, 'A valid supplier is required');
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'At least one receiving item is required');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[supplier]] = await connection.query("SELECT id FROM suppliers WHERE id = ? AND status = 'Active' FOR SHARE", [supplierId]);
    if (!supplier) throw new HttpError(404, 'Supplier was not found or is inactive');
    const [[receiver]] = await connection.query('SELECT employee_id FROM users WHERE id = ? AND status = \'Active\'', [userId]);
    if (!receiver) throw new HttpError(401, 'Active employee account not found');

    const grouped = new Map();
    for (const item of items) {
      const productId = Number(item.product_id);
      if (!Number.isInteger(productId)) throw new HttpError(400, 'Invalid product');
      const quantity = requirePositiveNumber(item.quantity, 'Quantity');
      const unitCost = requireNonNegativeNumber(item.unit_cost, 'Unit cost');
      if (grouped.has(productId)) throw new HttpError(400, 'A product may only appear once in a receiving transaction');
      grouped.set(productId, { quantity, unitCost });
    }

    const products = [];
    for (const productId of [...grouped.keys()].sort((a, b) => a - b)) {
      const [[product]] = await connection.query('SELECT id, product_name, stock_quantity FROM products WHERE id = ? AND status = \'Active\' FOR UPDATE', [productId]);
      if (!product) throw new HttpError(404, 'One or more products were not found or are inactive');
      products.push({ ...product, ...grouped.get(productId) });
    }
    const totalCostCents = products.reduce((sum, product) => sum + moneyToCents(product.unitCost) * product.quantity, 0);
    const receivingNumber = generateNumber('REC');
    const [receivingResult] = await connection.query(
      `INSERT INTO stock_receiving (receiving_number, supplier_id, received_by, reference_number, total_cost, status)
       VALUES (?, ?, ?, ?, ?, 'Completed')`,
      [receivingNumber, supplierId, receiver.employee_id, referenceNumber || null, centsToMoney(totalCostCents)]
    );

    for (const product of products) {
      const itemSubtotalCents = moneyToCents(product.unitCost) * product.quantity;
      const previousStock = Number(product.stock_quantity);
      const newStock = previousStock + product.quantity;
      await connection.query(
        `INSERT INTO stock_receiving_items (receiving_id, product_id, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?)`,
        [receivingResult.insertId, product.id, product.quantity, product.unitCost, centsToMoney(itemSubtotalCents)]
      );
      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, product.id]);
      await connection.query(
        `INSERT INTO inventory_logs (product_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id)
         VALUES (?, ?, 'STOCK_RECEIVING', ?, ?, ?, 'STOCK_RECEIVING', ?)`,
        [product.id, userId, product.quantity, previousStock, newStock, receivingResult.insertId]
      );
    }
    await connection.commit();
    return { id: receivingResult.insertId, receiving_number: receivingNumber, total_cost: centsToMoney(totalCostCents) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
