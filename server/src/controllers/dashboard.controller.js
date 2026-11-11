import { pool } from '../config/db.js';

export async function summary(req, res, next) {
  try {
    const [[metrics]] = await pool.query(
      `SELECT
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE sale_status = 'Completed' AND DATE(sale_date) = CURRENT_DATE), 0) AS todaySales,
        (SELECT COUNT(*) FROM sales WHERE sale_status = 'Completed' AND DATE(sale_date) = CURRENT_DATE) AS todayTransactions,
        (SELECT COUNT(*) FROM products WHERE status = 'Active') AS totalProducts,
        (SELECT COUNT(*) FROM products WHERE status = 'Active' AND stock_quantity > 0 AND stock_quantity <= reorder_level) AS lowStockCount,
        (SELECT COUNT(*) FROM products WHERE status = 'Active' AND stock_quantity = 0) AS outOfStockCount,
        (SELECT COUNT(*) FROM employees WHERE status = 'Active') AS activeEmployees`
    );
    const [[myToday]] = await pool.query(
      `SELECT COALESCE(SUM(s.total_amount), 0) AS sales, COUNT(*) AS transactions
       FROM sales s INNER JOIN users u ON u.employee_id = s.employee_id
       WHERE u.id = ? AND s.sale_status = 'Completed' AND DATE(s.sale_date) = CURRENT_DATE`,
      [req.user.userId]
    );
    const [[period]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS sales, COUNT(*) AS transactions, COALESCE(AVG(total_amount), 0) AS averageTransaction
       FROM sales WHERE sale_status = 'Completed' AND sale_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY)`
    );
    const [chart] = await pool.query(
      `SELECT DATE(sale_date) AS sale_date, COALESCE(SUM(total_amount), 0) AS total_sales, COUNT(*) AS transactions
       FROM sales WHERE sale_status = 'Completed' AND sale_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY)
       GROUP BY DATE(sale_date) ORDER BY sale_date`
    );
    const [paymentMix] = await pool.query(
      `SELECT payment_method, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
       FROM payments WHERE payment_status = 'Paid' AND DATE(payment_date) = CURRENT_DATE
       GROUP BY payment_method ORDER BY amount DESC`
    );
    const [topProducts] = await pool.query(
      `SELECT p.id, p.product_name, p.unit, SUM(si.quantity) AS quantity_sold, SUM(si.subtotal) AS revenue
       FROM sale_items si INNER JOIN sales s ON s.id = si.sale_id INNER JOIN products p ON p.id = si.product_id
       WHERE s.sale_status = 'Completed' AND s.sale_date >= DATE_SUB(CURRENT_DATE, INTERVAL 29 DAY)
       GROUP BY p.id, p.product_name, p.unit ORDER BY revenue DESC LIMIT 5`
    );
    const [lowStock] = await pool.query(
      `SELECT id, product_name, stock_quantity, reorder_level, unit FROM products
       WHERE status = 'Active' AND stock_quantity <= reorder_level ORDER BY stock_quantity, product_name LIMIT 8`
    );
    const [recentSales] = await pool.query(
      `SELECT s.id, s.sale_number, s.sale_date, s.total_amount, s.sale_status, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM sales s INNER JOIN employees e ON e.id = s.employee_id ORDER BY s.sale_date DESC, s.id DESC LIMIT 8`
    );
    res.json({ success: true, data: { summary: metrics, myToday, period, chart, paymentMix, topProducts, lowStock, recentSales } });
  } catch (error) { next(error); }
}
