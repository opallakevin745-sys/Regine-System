import { pool } from '../config/db.js';
import { HttpError, centsToMoney, generateNumber, moneyToCents, requireNonNegativeNumber, requirePositiveNumber } from '../utils/http-error.js';

export async function createSale({ userId, items, discount = 0, payment }) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'At least one sale item is required');
  if (!payment || !['Cash', 'GCash', 'Bank Transfer', 'Other'].includes(payment.payment_method)) throw new HttpError(400, 'A valid payment method is required');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[employee]] = await connection.query('SELECT employee_id FROM users WHERE id = ? AND status = \'Active\'', [userId]);
    if (!employee) throw new HttpError(401, 'Active employee account not found');

    const grouped = new Map();
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = requirePositiveNumber(item.quantity, 'Quantity');
      if (!Number.isInteger(productId)) throw new HttpError(400, 'Invalid product');
      grouped.set(productId, (grouped.get(productId) || 0) + quantity);
    }

    const lockedProducts = [];
    for (const productId of [...grouped.keys()].sort((a, b) => a - b)) {
      const [[product]] = await connection.query(
        `SELECT id, product_name, selling_price, stock_quantity FROM products
         WHERE id = ? AND status = 'Active' FOR UPDATE`, [productId]
      );
      if (!product) throw new HttpError(404, 'One or more products were not found or are inactive');
      const quantity = grouped.get(productId);
      if (Number(product.stock_quantity) < quantity) throw new HttpError(409, `Insufficient stock for ${product.product_name}`);
      lockedProducts.push({ ...product, quantity });
    }

    const subtotalCents = lockedProducts.reduce((sum, product) => sum + moneyToCents(product.selling_price) * product.quantity, 0);
    const discountCents = moneyToCents(requireNonNegativeNumber(discount, 'Discount'));
    if (discountCents > subtotalCents) throw new HttpError(400, 'Discount cannot exceed the subtotal');
    const totalCents = subtotalCents - discountCents;
    const paymentCents = moneyToCents(requireNonNegativeNumber(payment.amount, 'Payment amount'));
    if (paymentCents < totalCents) throw new HttpError(400, 'Payment amount is less than the sale total');

    const saleNumber = generateNumber('SAL');
    const [saleResult] = await connection.query(
      `INSERT INTO sales (sale_number, employee_id, subtotal, discount, total_amount, sale_status)
       VALUES (?, ?, ?, ?, ?, 'Completed')`,
      [saleNumber, employee.employee_id, centsToMoney(subtotalCents), centsToMoney(discountCents), centsToMoney(totalCents)]
    );

    for (const product of lockedProducts) {
      const itemSubtotalCents = moneyToCents(product.selling_price) * product.quantity;
      const previousStock = Number(product.stock_quantity);
      const newStock = previousStock - product.quantity;
      await connection.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)`,
        [saleResult.insertId, product.id, product.quantity, product.selling_price, centsToMoney(itemSubtotalCents)]
      );
      const [updateResult] = await connection.query(
        'UPDATE products SET stock_quantity = ? WHERE id = ? AND stock_quantity >= ?',
        [newStock, product.id, product.quantity]
      );
      if (updateResult.affectedRows !== 1) throw new HttpError(409, `Insufficient stock for ${product.product_name}`);
      await connection.query(
        `INSERT INTO inventory_logs (product_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id)
         VALUES (?, ?, 'SALE', ?, ?, ?, 'SALE', ?)`,
        [product.id, userId, -product.quantity, previousStock, newStock, saleResult.insertId]
      );
    }

    // `amount` is what was applied to the sale; tendered cash and change are tracked separately
    // so payment totals and reports never count the change handed back to the customer.
    await connection.query(
      `INSERT INTO payments (sale_id, amount, amount_tendered, change_amount, payment_method, reference_number, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, 'Paid')`,
      [saleResult.insertId, centsToMoney(totalCents), centsToMoney(paymentCents), centsToMoney(paymentCents - totalCents), payment.payment_method, String(payment.reference_number || '').trim() || null]
    );
    await connection.commit();
    return { id: saleResult.insertId, sale_number: saleNumber, subtotal: centsToMoney(subtotalCents), discount: centsToMoney(discountCents), total_amount: centsToMoney(totalCents), amount_paid: centsToMoney(paymentCents), change: centsToMoney(paymentCents - totalCents) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
