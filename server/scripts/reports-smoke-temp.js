import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: 'server/.env' });
const api = 'http://localhost:5006/api';
const marker = `ITP7-${Date.now()}`;
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
const fixture = { categories: [], suppliers: [], products: [], receiving: [], sales: [] };
let token;

function assert(condition, label, actual) {
  if (!condition) throw new Error(`FAIL ${label}${actual === undefined ? '' : `: ${JSON.stringify(actual)}`}`);
  console.log(`PASS ${label}`);
}

async function request(path, method = 'GET', body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

async function cleanup() {
  await db.beginTransaction();
  try {
    const saleIds = fixture.sales.map((sale) => sale.id);
    const receivingIds = fixture.receiving.map((receipt) => receipt.id);
    if (fixture.products.length) await db.query('DELETE FROM inventory_logs WHERE product_id IN (?)', [fixture.products]);
    if (saleIds.length) {
      await db.query('DELETE FROM payments WHERE sale_id IN (?)', [saleIds]);
      await db.query('DELETE FROM sale_items WHERE sale_id IN (?)', [saleIds]);
      await db.query('DELETE FROM sales WHERE id IN (?)', [saleIds]);
    }
    if (receivingIds.length) {
      await db.query('DELETE FROM stock_receiving_items WHERE receiving_id IN (?)', [receivingIds]);
      await db.query('DELETE FROM stock_receiving WHERE id IN (?)', [receivingIds]);
    }
    if (fixture.products.length) await db.query('DELETE FROM products WHERE id IN (?)', [fixture.products]);
    if (fixture.suppliers.length) await db.query('DELETE FROM suppliers WHERE id IN (?)', [fixture.suppliers]);
    if (fixture.categories.length) await db.query('DELETE FROM categories WHERE id IN (?)', [fixture.categories]);
    await db.commit();
    console.log('Temporary report categories/products/suppliers and linked transactions/logs cleaned by exact IDs.');
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

async function main() {
  try {
    const login = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: process.env.SEED_ADMIN_PASSWORD })
    });
    const loginBody = await login.json();
    assert(login.ok && loginBody.data?.user?.role === 'Owner', 'real Owner API login');
    token = loginBody.data.token;

    let result = await request('/categories', 'POST', { category_name: `${marker} Category A`, description: 'Temporary report filter A' });
    assert(result.status === 201, 'category A created');
    fixture.categories.push(result.body.data.id);
    result = await request('/categories', 'POST', { category_name: `${marker} Category B`, description: 'Temporary report filter B' });
    assert(result.status === 201, 'category B created');
    fixture.categories.push(result.body.data.id);
    result = await request('/suppliers', 'POST', { supplier_code: `${marker}-SA`, supplier_name: `${marker} Supplier A` });
    assert(result.status === 201, 'supplier A created');
    fixture.suppliers.push(result.body.data.id);
    result = await request('/suppliers', 'POST', { supplier_code: `${marker}-SB`, supplier_name: `${marker} Supplier B` });
    assert(result.status === 201, 'supplier B created');
    fixture.suppliers.push(result.body.data.id);

    for (const [index, categoryId] of fixture.categories.entries()) {
      result = await request('/products', 'POST', {
        category_id: categoryId,
        product_code: `${marker}-P${index + 1}`,
        product_name: `${marker} Product ${index + 1}`,
        unit: 'piece', cost_price: index ? 8 : 4, selling_price: index ? 20 : 10, reorder_level: 5
      });
      assert(result.status === 201, `product ${index + 1} created`);
      fixture.products.push(result.body.data.id);
    }

    const baseline = await request('/dashboard/summary');
    assert(baseline.status === 200, 'dashboard baseline endpoint');
    for (let index = 0; index < 2; index += 1) {
      result = await request('/stock-receiving', 'POST', {
        supplier_id: fixture.suppliers[index],
        items: [{ product_id: fixture.products[index], quantity: index ? 4 : 5, unit_cost: index ? 8 : 4 }]
      });
      assert(result.status === 201, `receiving ${index + 1} created`);
      fixture.receiving.push({ id: result.body.data.receiving.id, totalCost: Number(result.body.data.receiving.total_cost) });
    }
    for (let index = 0; index < 2; index += 1) {
      result = await request('/sales', 'POST', {
        items: [{ product_id: fixture.products[index], quantity: index ? 1 : 2 }],
        discount: 0,
        payment: { amount: 20, payment_method: index ? 'GCash' : 'Cash' }
      });
      assert(result.status === 201, `sale ${index + 1} created`);
      fixture.sales.push({ id: result.body.data.sale.id, sale_number: result.body.data.sale.sale_number });
    }

    const [[dates]] = await db.query("SELECT DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS day, DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), '%Y-%m-%d') AS older");
    await db.query("UPDATE sales SET sale_date = TIMESTAMP(CURRENT_DATE, '10:00:00') WHERE id = ?", [fixture.sales[0].id]);
    await db.query("UPDATE sales SET sale_date = TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), '10:00:00') WHERE id = ?", [fixture.sales[1].id]);
    await db.query("UPDATE payments SET payment_date = TIMESTAMP(CURRENT_DATE, '10:05:00') WHERE sale_id = ?", [fixture.sales[0].id]);
    await db.query("UPDATE payments SET payment_date = TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), '10:05:00') WHERE sale_id = ?", [fixture.sales[1].id]);
    await db.query("UPDATE stock_receiving SET receiving_date = TIMESTAMP(CURRENT_DATE, '09:00:00') WHERE id = ?", [fixture.receiving[0].id]);
    await db.query("UPDATE stock_receiving SET receiving_date = TIMESTAMP(DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), '09:00:00') WHERE id = ?", [fixture.receiving[1].id]);

    const categoryA = fixture.categories[0]; const categoryB = fixture.categories[1];
    const sameDay = await request(`/reports/sales?date_from=${dates.day}&date_to=${dates.day}&category_id=${categoryA}`);
    assert(sameDay.status === 200 && sameDay.body.data.rows.some((row) => row.sale_number === fixture.sales[0].sale_number), 'sales same-day start/end + category filter');
    assert(Number(sameDay.body.data.summary.totalTransactions) === 1 && Number(sameDay.body.data.summary.netSales) === 20, 'sales same-day backend totals');

    const multiDay = await request(`/reports/sales?date_from=${dates.older}&date_to=${dates.day}`);
    assert(multiDay.status === 200 && fixture.sales.every((sale) => multiDay.body.data.rows.some((row) => row.sale_number === sale.sale_number)), 'sales multi-day range includes both fixture days');
    const startOnly = await request(`/reports/sales?date_from=${dates.day}&category_id=${categoryA}`);
    assert(startOnly.body.data.rows.some((row) => row.sale_number === fixture.sales[0].sale_number) && !startOnly.body.data.rows.some((row) => row.sale_number === fixture.sales[1].sale_number), 'sales start-only filter');
    const endOnly = await request(`/reports/sales?date_to=${dates.older}&category_id=${categoryB}`);
    assert(endOnly.body.data.rows.some((row) => row.sale_number === fixture.sales[1].sale_number), 'sales end-only filter');
    const empty = await request(`/reports/sales?date_from=2100-01-01&date_to=2100-01-01&category_id=${categoryA}`);
    assert(empty.status === 200 && empty.body.data.rows.length === 0 && Number(empty.body.data.summary.totalTransactions) === 0, 'empty future date range returns empty rows and zero totals');
    const reversed = await request(`/reports/sales?date_from=${dates.day}&date_to=${dates.older}`);
    assert(reversed.status === 400, 'reversed date range is rejected clearly');
    const invalidDate = await request('/reports/sales?date_from=2026-02-31');
    assert(invalidDate.status === 400, 'invalid date is rejected clearly');

    const productSales = await request(`/reports/product-sales?date_from=${dates.day}&date_to=${dates.day}&category_id=${categoryA}`);
    assert(productSales.body.data.rows.length === 1 && Number(productSales.body.data.summary.quantitySold) === 2 && Number(productSales.body.data.summary.revenue) === 20, 'product-sales category/date filter and SQL totals');
    const inventory = await request(`/reports/inventory?category_id=${categoryA}`);
    assert(inventory.body.data.rows.length === 1 && inventory.body.data.rows[0].product_name === `${marker} Product 1`, 'inventory category filter');
    const [[inventoryValue]] = await db.query('SELECT SUM(stock_quantity * cost_price) AS total FROM products WHERE id = ?', [fixture.products[0]]);
    assert(Number(inventory.body.data.summary.inventoryValue) === Number(inventoryValue.total), 'inventory valuation matches MySQL');

    const receivedToday = await request(`/reports/stock-receiving?date_from=${dates.day}&date_to=${dates.day}&supplier_id=${fixture.suppliers[0]}`);
    assert(receivedToday.body.data.rows.length === 1 && receivedToday.body.data.rows[0].supplier_id === fixture.suppliers[0], 'receiving same-day supplier filter');
    assert(Number(receivedToday.body.data.summary.totalCost) === fixture.receiving[0].totalCost, 'receiving total matches transaction cost');
    const receivedEndOnly = await request(`/reports/stock-receiving?date_to=${dates.older}&supplier_id=${fixture.suppliers[1]}`);
    assert(receivedEndOnly.body.data.rows.some((row) => row.supplier_id === fixture.suppliers[1]), 'receiving end-only date and supplier filter');
    const supplierSummary = await request(`/reports/suppliers?date_from=${dates.day}&date_to=${dates.day}&supplier_id=${fixture.suppliers[0]}`);
    assert(supplierSummary.body.data.rows.length === 1 && Number(supplierSummary.body.data.rows[0].receiving_count) === 1 && Number(supplierSummary.body.data.rows[0].total_supply_cost) === fixture.receiving[0].totalCost, 'supplier report date and supplier filters');

    const payments = await request(`/reports/payments?date_from=${dates.day}&date_to=${dates.day}&payment_method=Cash`);
    assert(payments.body.data.rows.some((row) => row.sale_number === fixture.sales[0].sale_number), 'payment date filter returns same-day fixture payment');
    const [[paymentTotal]] = await db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_date >= CURRENT_DATE AND payment_date < DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY) AND payment_method = 'Cash'");
    assert(Number(payments.body.data.summary.total) === Number(paymentTotal.total), 'payment summary totals match MySQL');

    const dashboard = await request('/dashboard/summary');
    assert(dashboard.status === 200 && dashboard.body.data.topProducts.some((row) => row.product_name === `${marker} Product 1`), 'dashboard top product comes from current sales data');
    const [[activeProducts]] = await db.query("SELECT COUNT(*) AS count FROM products WHERE status = 'Active'");
    assert(Number(dashboard.body.data.summary.totalProducts) === Number(activeProducts.count), 'dashboard product total matches MySQL');
    console.log(`Test dates: same day ${dates.day}, older day ${dates.older}.`);
  } finally {
    await cleanup();
    await db.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
