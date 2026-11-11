import { pool } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';

const paymentMethods = ['Cash', 'GCash', 'Bank Transfer', 'Other'];
const paymentStatuses = ['Paid', 'Pending', 'Cancelled', 'Refunded'];

function parseDate(value, label) {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must be a valid date in YYYY-MM-DD format`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${label} must be a valid date in YYYY-MM-DD format`);
  }
  return value;
}

function dateFilters(alias, query) {
  const from = parseDate(query.date_from, 'Start date');
  const to = parseDate(query.date_to, 'End date');
  if (from && to && from > to) throw new HttpError(400, 'Start date must be on or before end date');
  const clauses = [];
  const values = [];
  if (from) { clauses.push(`${alias} >= ?`); values.push(`${from} 00:00:00`); }
  if (to) { clauses.push(`${alias} < DATE_ADD(?, INTERVAL 1 DAY)`); values.push(`${to} 00:00:00`); }
  return { clauses, values };
}

function optionalId(value, label) {
  if (value === undefined || value === '') return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, `${label} must be a valid positive ID`);
  return id;
}

function reportError(error, next) { next(error); }

export async function salesReport(req, res, next) {
  try {
    const { clauses, values } = dateFilters('s.sale_date', req.query);
    const categoryId = optionalId(req.query.category_id, 'Category ID');
    const status = req.query.status;
    const employeeId = optionalId(req.query.employee_id, 'Employee ID');
    if (status && !['Completed', 'Pending', 'Cancelled'].includes(status)) throw new HttpError(400, 'Invalid sale status');
    if (status) { clauses.push('s.sale_status = ?'); values.push(status); }
    if (employeeId) { clauses.push('s.employee_id = ?'); values.push(employeeId); }
    if (categoryId) {
      clauses.push(`EXISTS (SELECT 1 FROM sale_items filter_si JOIN products filter_p ON filter_p.id = filter_si.product_id
        WHERE filter_si.sale_id = s.id AND filter_p.category_id = ?)`);
      values.push(categoryId);
    }
    const predicate = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT s.id, s.sale_number, s.sale_date, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
        s.subtotal, s.discount, s.total_amount, s.sale_status
       FROM sales s INNER JOIN employees e ON e.id = s.employee_id ${predicate}
       ORDER BY s.sale_date DESC LIMIT 1000`, values
    );
    const summaryClauses = [...clauses];
    const summaryValues = [...values];
    if (!status) summaryClauses.push("s.sale_status = 'Completed'");
    const summaryPredicate = summaryClauses.length ? `WHERE ${summaryClauses.join(' AND ')}` : '';
    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS totalTransactions, COALESCE(SUM(s.subtotal), 0) AS grossSales,
        COALESCE(SUM(s.discount), 0) AS discounts, COALESCE(SUM(s.total_amount), 0) AS netSales
       FROM sales s ${summaryPredicate}`, summaryValues
    );
    res.json({ success: true, data: { rows, summary } });
  } catch (error) { reportError(error, next); }
}

export async function productSalesReport(req, res, next) {
  try {
    const { clauses, values } = dateFilters('s.sale_date', req.query);
    const categoryId = optionalId(req.query.category_id, 'Category ID');
    clauses.unshift("s.sale_status = 'Completed'");
    if (categoryId) { clauses.push('p.category_id = ?'); values.push(categoryId); }
    const predicate = clauses.join(' AND ');
    const orderBy = req.query.sort === 'revenue' ? 'revenue DESC' : 'quantity_sold DESC';
    const [rows] = await pool.query(
      `SELECT p.product_name, SUM(si.quantity) AS quantity_sold, SUM(si.subtotal) AS revenue
       FROM sale_items si INNER JOIN sales s ON s.id = si.sale_id INNER JOIN products p ON p.id = si.product_id
       WHERE ${predicate} GROUP BY p.id, p.product_name ORDER BY ${orderBy}`, values
    );
    const [[summary]] = await pool.query(
      `SELECT COALESCE(SUM(si.quantity), 0) AS quantitySold, COALESCE(SUM(si.subtotal), 0) AS revenue
       FROM sale_items si INNER JOIN sales s ON s.id = si.sale_id INNER JOIN products p ON p.id = si.product_id
       WHERE ${predicate}`, values
    );
    res.json({ success: true, data: { rows, summary } });
  } catch (error) { reportError(error, next); }
}

export async function inventoryReport(req, res, next) {
  try {
    const categoryId = optionalId(req.query.category_id, 'Category ID');
    const clauses = [];
    const values = [];
    if (categoryId) { clauses.push('p.category_id = ?'); values.push(categoryId); }
    const predicate = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT p.product_code, p.product_name, p.category_id, c.category_name, p.stock_quantity, p.reorder_level,
        p.cost_price, p.selling_price,
        CASE WHEN p.stock_quantity = 0 THEN 'Out of Stock' WHEN p.stock_quantity <= p.reorder_level THEN 'Low Stock' ELSE 'In Stock' END AS stock_status,
        (p.stock_quantity * p.cost_price) AS inventory_value
       FROM products p INNER JOIN categories c ON c.id = p.category_id ${predicate} ORDER BY p.product_name`, values
    );
    const [[summary]] = await pool.query(
      `SELECT COALESCE(SUM(p.stock_quantity * p.cost_price), 0) AS inventoryValue
       FROM products p ${predicate}`, values
    );
    res.json({ success: true, data: { rows, summary } });
  } catch (error) { reportError(error, next); }
}

export async function receivingReport(req, res, next) {
  try {
    const { clauses, values } = dateFilters('r.receiving_date', req.query);
    const supplierId = optionalId(req.query.supplier_id, 'Supplier ID');
    if (supplierId) { clauses.push('r.supplier_id = ?'); values.push(supplierId); }
    const predicate = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT r.id, r.receiving_number, r.receiving_date, r.supplier_id, s.supplier_name,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name, r.total_cost, r.status
       FROM stock_receiving r INNER JOIN suppliers s ON s.id = r.supplier_id
       INNER JOIN employees e ON e.id = r.received_by ${predicate}
       ORDER BY r.receiving_date DESC LIMIT 1000`, values
    );
    const [[summary]] = await pool.query(
      `SELECT COUNT(*) AS totalTransactions, COALESCE(SUM(r.total_cost), 0) AS totalCost
       FROM stock_receiving r ${predicate}`, values
    );
    res.json({ success: true, data: { rows, summary } });
  } catch (error) { reportError(error, next); }
}

export async function paymentReport(req, res, next) {
  try {
    const { clauses, values } = dateFilters('p.payment_date', req.query);
    const method = req.query.payment_method;
    const status = req.query.status;
    if (method && !paymentMethods.includes(method)) throw new HttpError(400, 'Invalid payment method');
    if (status && !paymentStatuses.includes(status)) throw new HttpError(400, 'Invalid payment status');
    if (method) { clauses.push('p.payment_method = ?'); values.push(method); }
    if (status) { clauses.push('p.payment_status = ?'); values.push(status); }
    const predicate = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT p.payment_date, s.sale_number, p.payment_method, p.reference_number, p.amount, p.payment_status
       FROM payments p INNER JOIN sales s ON s.id = p.sale_id ${predicate}
       ORDER BY p.payment_date DESC LIMIT 1000`, values
    );
    const totalsClauses = status ? [...clauses] : [...clauses, "p.payment_status = 'Paid'"];
    const totalsPredicate = totalsClauses.length ? `WHERE ${totalsClauses.join(' AND ')}` : '';
    const [methodTotals] = await pool.query(
      `SELECT p.payment_method, COALESCE(SUM(p.amount), 0) AS amount
       FROM payments p ${totalsPredicate} GROUP BY p.payment_method`, values
    );
    const [[totalRow]] = await pool.query(`SELECT COALESCE(SUM(p.amount), 0) AS total FROM payments p ${totalsPredicate}`, values);
    const summary = { Cash: 0, GCash: 0, 'Bank Transfer': 0, Other: 0, total: Number(totalRow.total) };
    for (const row of methodTotals) summary[row.payment_method] = Number(row.amount);
    res.json({ success: true, data: { rows, summary } });
  } catch (error) { reportError(error, next); }
}

export async function supplierReport(req, res, next) {
  try {
    const { clauses: receiptDateClauses, values: receiptDateValues } = dateFilters('r.receiving_date', req.query);
    const supplierId = optionalId(req.query.supplier_id, 'Supplier ID');
    const joinConditions = ['r.supplier_id = s.id', ...receiptDateClauses];
    const joinValues = [...receiptDateValues];
    const where = [];
    const values = [];
    if (supplierId) { where.push('s.id = ?'); values.push(supplierId); }
    const predicate = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT s.id, s.supplier_name, s.status, COUNT(r.id) AS receiving_count,
        COALESCE(SUM(r.total_cost), 0) AS total_supply_cost, MAX(r.receiving_date) AS last_receiving_date
       FROM suppliers s LEFT JOIN stock_receiving r ON ${joinConditions.join(' AND ')}
       ${predicate} GROUP BY s.id, s.supplier_name, s.status ORDER BY total_supply_cost DESC`,
      [...joinValues, ...values]
    );
    const [[summary]] = await pool.query(
      `SELECT COUNT(DISTINCT s.id) AS supplierCount, COUNT(r.id) AS receivingCount,
        COALESCE(SUM(r.total_cost), 0) AS totalSupplyCost
       FROM suppliers s LEFT JOIN stock_receiving r ON ${joinConditions.join(' AND ')} ${predicate}`,
      [...joinValues, ...values]
    );
    res.json({ success: true, data: { rows, summary } });
  } catch (error) { reportError(error, next); }
}
