/*
 * In-browser stand-in for the Express API, used by the GitHub Pages demo build.
 *
 * It implements the same endpoints, validation rules, role checks, and response shapes as
 * server/src so the React pages run unchanged. Data lives in localStorage (per browser) and
 * is regenerated from demoData.js each day until someone changes it.
 */
import { buildDemoData } from './demoData.js';

const STORAGE_KEY = 'mutya_demo_db_v1';
const VERSION = 1;
const TOKEN_HOURS = 8;

const roles = ['Owner', 'Manager', 'Cashier', 'Staff'];
const managers = ['Owner', 'Manager'];
const sellers = ['Owner', 'Manager', 'Cashier'];
const receivers = ['Owner', 'Manager', 'Staff'];
const paymentMethods = ['Cash', 'GCash', 'Bank Transfer', 'Other'];
const paymentStatuses = ['Paid', 'Pending', 'Cancelled', 'Refunded'];
const transactionTypes = ['STOCK_RECEIVING', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT'];

class DemoError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---- Storage -----------------------------------------------------------------------------
let database = null;

const pad = (value) => String(value).padStart(2, '0');
const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function freshDatabase() {
  return { version: VERSION, seededOn: localDateKey(new Date()), modified: false, tables: JSON.parse(JSON.stringify(buildDemoData(new Date()))) };
}

function db() {
  if (database) return database;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === VERSION && (saved.modified || saved.seededOn === localDateKey(new Date()))) database = saved;
  } catch {
    // Unreadable or missing storage falls through to a fresh dataset.
  }
  if (!database) {
    database = freshDatabase();
    persist();
  }
  return database;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(database)); } catch { /* storage full or disabled: keep in memory */ }
}

function commit() {
  database.modified = true;
  persist();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) database = null; });
}

export function resetDemoData() {
  database = freshDatabase();
  persist();
}

// ---- Helpers -------------------------------------------------------------------------------
const t = () => db().tables;
const nowIso = () => new Date().toISOString();
const round2 = (value) => Math.round(Number(value) * 100) / 100;
const round3 = (value) => Math.round(Number(value) * 1000) / 1000;
const toCents = (value) => Math.round(Number(value) * 100);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const contains = (value, search) => String(value ?? '').toLowerCase().includes(search.toLowerCase());
const byId = (table, id) => t()[table].find((row) => row.id === Number(id));
const nextId = (table) => t()[table].reduce((max, row) => Math.max(max, row.id), 0) + 1;
const sortBy = (rows, ...keys) => [...rows].sort((a, b) => {
  for (const key of keys) {
    const descending = key.startsWith('-');
    const field = descending ? key.slice(1) : key;
    const left = a[field] ?? '';
    const right = b[field] ?? '';
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    if (order !== 0) return descending ? -order : order;
  }
  return 0;
});
const employeeName = (employeeId) => {
  const employee = byId('employees', employeeId);
  return employee ? `${employee.first_name} ${employee.last_name}` : '';
};
const userName = (userId) => {
  const user = byId('users', userId);
  return user ? employeeName(user.employee_id) : '';
};
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const inDateRange = (value, from, to) => {
  const key = localDateKey(value);
  return (!from || key >= from) && (!to || key <= to);
};
const isToday = (value) => localDateKey(value) === localDateKey(new Date());
const daysAgoKey = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateKey(date);
};
function requireNumber(value, label, { positive = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) {
    throw new DemoError(400, positive ? `${label} must be greater than zero` : `${label} must be zero or greater`);
  }
  return number;
}
function assertUnique(table, field, value, exceptId) {
  if (t()[table].some((row) => row[field] === value && row.id !== exceptId)) {
    throw new DemoError(409, 'A record with the same unique value already exists');
  }
}
function generateNumber(prefix) {
  const date = localDateKey(new Date()).replaceAll('-', '');
  return `${prefix}-${date}-${String(Date.now()).slice(-8)}`;
}
const stockStatus = (product) => Number(product.stock_quantity) === 0 ? 'Out of Stock'
  : Number(product.stock_quantity) <= Number(product.reorder_level) ? 'Low Stock' : 'In Stock';

function publicUser(user) {
  const employee = byId('employees', user.employee_id);
  return { id: user.id, employeeId: user.employee_id, username: user.username, role: user.role, status: user.status, firstName: employee?.first_name, lastName: employee?.last_name, position: employee?.position };
}

function addLog(productId, userId, type, quantity, previousStock, newStock, referenceType, referenceId, reason = null) {
  t().inventory_logs.push({
    id: nextId('inventory_logs'), product_id: productId, user_id: userId, transaction_type: type, quantity: round3(quantity),
    previous_stock: round3(previousStock), new_stock: round3(newStock), reference_type: referenceType, reference_id: referenceId,
    reason, created_at: nowIso()
  });
}

// ---- Auth ------------------------------------------------------------------------------------
function authenticate(token) {
  const [prefix, userId, expires] = String(token || '').split('.');
  if (prefix !== 'demo' || !userId) throw new DemoError(401, 'Authentication required');
  if (Number(expires) < Date.now()) throw new DemoError(401, 'Invalid or expired token');
  const user = byId('users', userId);
  const employee = user && byId('employees', user.employee_id);
  if (!user || user.status !== 'Active' || employee?.status !== 'Active') throw new DemoError(401, 'Account is no longer active');
  return { userId: user.id, username: user.username, role: user.role };
}

function login({ body }) {
  const username = text(body?.username);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password) throw new DemoError(400, 'Username and password are required');
  const user = t().users.find((row) => row.username === username);
  const employee = user && byId('employees', user.employee_id);
  if (!user || user.status !== 'Active' || employee?.status !== 'Active' || user.password !== password) {
    throw new DemoError(401, 'Invalid username or password');
  }
  user.last_login = nowIso();
  persist();
  return { message: 'Login successful', data: { token: `demo.${user.id}.${Date.now() + TOKEN_HOURS * 3600 * 1000}`, user: publicUser(user) } };
}

// ---- Master data -------------------------------------------------------------------------------
function categoryRow(category) {
  return { ...category, product_count: t().products.filter((product) => product.category_id === category.id).length };
}

function productRow(product) {
  return { ...product, category_name: byId('categories', product.category_id)?.category_name, is_low_stock: Number(product.stock_quantity) <= Number(product.reorder_level) ? 1 : 0 };
}

function productFields(body) {
  const product_name = text(body?.product_name);
  const product_code = text(body?.product_code);
  if (!product_name || !product_code) throw new DemoError(400, 'Product code and product name are required');
  const category_id = Number(body.category_id);
  if (!Number.isInteger(category_id)) throw new DemoError(400, 'A valid category is required');
  const category = byId('categories', category_id);
  if (!category || category.status !== 'Active') throw new DemoError(400, 'A valid active category is required');
  return {
    category_id, product_code, product_name,
    description: text(String(body.description ?? '')) || null,
    unit: text(String(body.unit ?? '')) || 'piece',
    cost_price: round2(requireNumber(body.cost_price, 'Cost price')),
    selling_price: round2(requireNumber(body.selling_price, 'Selling price')),
    reorder_level: round3(requireNumber(body.reorder_level ?? 0, 'Reorder level'))
  };
}

function supplierFields(body) {
  const supplier_code = text(body?.supplier_code);
  const supplier_name = text(body?.supplier_name);
  if (!supplier_code || !supplier_name) throw new DemoError(400, 'Supplier code and supplier name are required');
  return { supplier_code, supplier_name, contact_person: text(String(body.contact_person ?? '')) || null, phone: text(String(body.phone ?? '')) || null, address: text(String(body.address ?? '')) || null };
}

function employeeFields(body) {
  const fields = {
    employee_code: text(body?.employee_code), first_name: text(body?.first_name), last_name: text(body?.last_name),
    position: text(body?.position), hire_date: text(body?.hire_date), phone: text(String(body?.phone ?? '')) || null
  };
  if (!fields.employee_code || !fields.first_name || !fields.last_name || !fields.position || !fields.hire_date) {
    throw new DemoError(400, 'Employee code, name, position, and hire date are required');
  }
  return fields;
}

function employeeRow(employee) {
  const user = t().users.find((row) => row.employee_id === employee.id);
  return { ...employee, user_id: user?.id ?? null, username: user?.username ?? null, role: user?.role ?? null, user_status: user?.status ?? null };
}

function userRow(user) {
  const employee = byId('employees', user.employee_id);
  const { password, ...rest } = user;
  return { ...rest, employee_code: employee?.employee_code, first_name: employee?.first_name, last_name: employee?.last_name, position: employee?.position };
}

function crud(table, key, { list, fields, label }) {
  return {
    list,
    get: ({ params }) => {
      const row = byId(table, params[0]);
      if (!row) throw new DemoError(404, `${label} not found`);
      return { data: { [key]: table === 'products' ? productRow(row) : table === 'categories' ? categoryRow(row) : table === 'employees' ? employeeRow(row) : row } };
    },
    create: ({ body }) => {
      const values = fields(body);
      const uniqueField = { categories: 'category_name', products: 'product_code', suppliers: 'supplier_code', employees: 'employee_code' }[table];
      assertUnique(table, uniqueField, values[uniqueField]);
      const id = nextId(table);
      t()[table].push({ id, ...values, ...(table === 'products' ? { stock_quantity: 0 } : {}), status: 'Active', created_at: nowIso(), updated_at: nowIso() });
      commit();
      return { status: 201, message: `${label} created`, data: { id } };
    },
    update: ({ params, body }) => {
      const values = fields(body);
      const row = byId(table, params[0]);
      if (!row) throw new DemoError(404, `${label} not found`);
      const uniqueField = { categories: 'category_name', products: 'product_code', suppliers: 'supplier_code', employees: 'employee_code' }[table];
      assertUnique(table, uniqueField, values[uniqueField], row.id);
      Object.assign(row, values, { updated_at: nowIso() });
      commit();
      return { message: `${label} updated` };
    },
    status: ({ params, body }) => {
      if (!['Active', 'Inactive'].includes(body?.status)) throw new DemoError(400, `Invalid ${label.toLowerCase()} status`);
      const row = byId(table, params[0]);
      if (!row) throw new DemoError(404, `${label} not found`);
      if (table === 'employees') {
        const account = t().users.find((user) => user.employee_id === row.id);
        if (account?.role === 'Owner' && body.status !== 'Active') throw new DemoError(403, 'The Owner employee account is protected');
        if (body.status === 'Inactive' && account) account.status = 'Inactive';
      }
      row.status = body.status;
      row.updated_at = nowIso();
      commit();
      return { message: `${label} status updated` };
    }
  };
}

const categoriesApi = crud('categories', 'category', {
  label: 'Category',
  fields: (body) => {
    const category_name = text(body?.category_name);
    if (!category_name) throw new DemoError(400, 'Category name is required');
    return { category_name, description: text(String(body.description ?? '')) || null };
  },
  list: ({ query }) => {
    const search = text(query.search);
    const rows = t().categories.filter((row) => contains(row.category_name, search) && (!['Active', 'Inactive'].includes(query.status) || row.status === query.status));
    return { data: { categories: sortBy(rows, 'category_name').map(categoryRow) } };
  }
});

const productsApi = crud('products', 'product', {
  label: 'Product',
  fields: productFields,
  list: ({ query }) => {
    const search = text(query.search);
    const rows = t().products.filter((row) => (contains(row.product_name, search) || contains(row.product_code, search))
      && (!query.category_id || row.category_id === Number(query.category_id))
      && (!['Active', 'Inactive'].includes(query.status) || row.status === query.status)
      && (query.low_stock !== 'true' || Number(row.stock_quantity) <= Number(row.reorder_level)));
    return { data: { products: sortBy(rows, 'product_name').map(productRow) } };
  }
});

const suppliersApi = crud('suppliers', 'supplier', {
  label: 'Supplier',
  fields: supplierFields,
  list: ({ query }) => {
    const search = text(query.search);
    const rows = t().suppliers.filter((row) => (contains(row.supplier_code, search) || contains(row.supplier_name, search))
      && (!['Active', 'Inactive'].includes(query.status) || row.status === query.status));
    return { data: { suppliers: sortBy(rows, 'supplier_name') } };
  }
});

const employeesApi = crud('employees', 'employee', {
  label: 'Employee',
  fields: employeeFields,
  list: ({ query }) => {
    const search = text(query.search);
    const rows = t().employees.filter((row) => (contains(row.employee_code, search) || contains(row.first_name, search) || contains(row.last_name, search))
      && (!['Active', 'Inactive'].includes(query.status) || row.status === query.status)
      && (!query.position || row.position === query.position));
    return { data: { employees: sortBy(rows, 'last_name', 'first_name').map(employeeRow) } };
  }
});

// ---- Users ------------------------------------------------------------------------------------------
function validPassword(value) {
  if (typeof value !== 'string' || value.length < 8) throw new DemoError(400, 'Password must be at least 8 characters');
  return value;
}

const usersApi = {
  list: () => ({ data: { users: sortBy(t().users.map(userRow), 'last_name', 'first_name') } }),
  get: ({ params }) => {
    const user = byId('users', params[0]);
    if (!user) throw new DemoError(404, 'User account not found');
    return { data: { user: userRow(user) } };
  },
  create: ({ body }) => {
    const employeeId = Number(body?.employee_id);
    const username = text(body?.username);
    if (!Number.isInteger(employeeId) || !username || !roles.includes(body?.role)) throw new DemoError(400, 'Employee, username, and valid role are required');
    const employee = byId('employees', employeeId);
    if (!employee || employee.status !== 'Active') throw new DemoError(400, 'An active employee is required');
    const password = validPassword(body.password);
    assertUnique('users', 'username', username);
    assertUnique('users', 'employee_id', employeeId);
    const id = nextId('users');
    t().users.push({ id, employee_id: employeeId, username, password, role: body.role, status: 'Active', last_login: null, created_at: nowIso(), updated_at: nowIso() });
    commit();
    return { status: 201, message: 'User account created', data: { id } };
  },
  update: ({ params, body }) => {
    const user = byId('users', params[0]);
    if (!user) throw new DemoError(404, 'User account not found');
    const username = text(body?.username);
    if (!username) throw new DemoError(400, 'Username is required');
    if (!roles.includes(body?.role) || !['Active', 'Inactive'].includes(body?.status)) throw new DemoError(400, 'Valid role and status are required');
    if (user.role === 'Owner' && (body.role !== 'Owner' || body.status === 'Inactive')) throw new DemoError(403, 'The Owner account is protected');
    assertUnique('users', 'username', username, user.id);
    Object.assign(user, { username, role: body.role, status: body.status, updated_at: nowIso() });
    commit();
    return { message: 'User account updated' };
  },
  status: ({ params, body }) => {
    const user = byId('users', params[0]);
    if (!user) throw new DemoError(404, 'User account not found');
    if (user.role === 'Owner' && body?.status !== 'Active') throw new DemoError(403, 'The Owner account is protected');
    if (!['Active', 'Inactive'].includes(body?.status)) throw new DemoError(400, 'Invalid user status');
    user.status = body.status;
    user.updated_at = nowIso();
    commit();
    return { message: 'User status updated' };
  },
  resetPassword: ({ params, body }) => {
    const user = byId('users', params[0]);
    if (!user) throw new DemoError(404, 'User account not found');
    if (user.role === 'Owner') throw new DemoError(403, 'The Owner account credentials are protected');
    user.password = validPassword(body?.new_password);
    commit();
    return { message: 'Password reset successfully' };
  }
};

// ---- Inventory ------------------------------------------------------------------------------------------
function inventoryRow(product) {
  const { id, product_code, product_name, unit, stock_quantity, reorder_level, status } = product;
  return { id, product_code, product_name, category_name: byId('categories', product.category_id)?.category_name, unit, stock_quantity, reorder_level, status, stock_status: stockStatus(product) };
}

function logRow(log) {
  const user = byId('users', log.user_id);
  const product = byId('products', log.product_id);
  return { ...log, product_name: product?.product_name, unit: product?.unit, username: user?.username, performed_by: userName(log.user_id) };
}

const inventoryApi = {
  list: ({ query }) => {
    const search = text(query.search);
    return { data: { inventory: sortBy(t().products.filter((row) => contains(row.product_name, search)), 'product_name').map(inventoryRow) } };
  },
  lowStock: () => ({ data: { products: sortBy(t().products.filter((row) => row.status === 'Active' && Number(row.stock_quantity) <= Number(row.reorder_level)), 'stock_quantity', 'product_name').map(inventoryRow) } }),
  product: ({ params }) => {
    const product = byId('products', params[0]);
    if (!product) throw new DemoError(404, 'Inventory product not found');
    return { data: { inventory: inventoryRow(product) } };
  },
  logs: ({ params }) => {
    const product = byId('products', params[0]);
    if (!product) throw new DemoError(404, 'Product not found');
    const logs = sortBy(t().inventory_logs.filter((log) => log.product_id === product.id), '-created_at', '-id').map(logRow);
    return { data: { product: { id: product.id, product_name: product.product_name }, logs } };
  },
  adjust: ({ body, user }) => {
    const quantity = Number(body?.quantity);
    if (!Number.isFinite(quantity) || quantity === 0) throw new DemoError(400, 'Adjustment quantity cannot be zero');
    const reason = text(String(body?.reason ?? ''));
    if (!reason) throw new DemoError(400, 'An adjustment reason is required');
    const product = byId('products', body?.product_id);
    if (!product) throw new DemoError(404, 'Product not found');
    const previous = Number(product.stock_quantity);
    const next = round3(previous + quantity);
    if (next < 0) throw new DemoError(409, 'Adjustment would create negative inventory');
    product.stock_quantity = next;
    addLog(product.id, user.userId, 'ADJUSTMENT', quantity, previous, next, 'ADJUSTMENT', product.id, reason);
    commit();
    return { status: 201, message: 'Inventory adjusted', data: { adjustment: { product_id: product.id, previous_stock: previous, new_stock: next, quantity, reason } } };
  }
};

// ---- Sales & payments --------------------------------------------------------------------------------------
const paymentFor = (saleId) => t().payments.find((payment) => payment.sale_id === saleId);

function saleRow(sale) {
  const payment = paymentFor(sale.id);
  return {
    id: sale.id, sale_number: sale.sale_number, sale_date: sale.sale_date, subtotal: sale.subtotal, discount: sale.discount,
    total_amount: sale.total_amount, sale_status: sale.sale_status, employee_name: employeeName(sale.employee_id),
    payment_method: payment?.payment_method ?? null, payment_amount: payment?.amount ?? null, payment_status: payment?.payment_status ?? null,
    item_count: t().sale_items.filter((item) => item.sale_id === sale.id).length
  };
}

const salesApi = {
  list: ({ query }) => {
    const status = text(query.status);
    const from = isoDate.test(text(query.from)) ? text(query.from) : '';
    const to = isoDate.test(text(query.to)) ? text(query.to) : '';
    const search = text(query.search);
    const rows = t().sales.filter((sale) => (!['Completed', 'Pending', 'Cancelled'].includes(status) || sale.sale_status === status)
      && inDateRange(sale.sale_date, from, to)
      && (!search || contains(sale.sale_number, search) || contains(employeeName(sale.employee_id), search)));
    return { data: { sales: sortBy(rows, '-sale_date', '-id').slice(0, 200).map(saleRow) } };
  },
  get: ({ params }) => {
    const sale = byId('sales', params[0]);
    if (!sale) throw new DemoError(404, 'Sale not found');
    const payment = paymentFor(sale.id);
    const items = t().sale_items.filter((item) => item.sale_id === sale.id).map((item) => {
      const product = byId('products', item.product_id);
      return { id: item.id, product_id: item.product_id, product_code: product?.product_code, product_name: product?.product_name, unit: product?.unit, quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal };
    });
    return {
      data: {
        sale: {
          ...saleRow(sale), amount_tendered: payment?.amount_tendered ?? null, change_amount: payment?.change_amount ?? 0,
          reference_number: payment?.reference_number ?? null, items
        }
      }
    };
  },
  create: ({ body, user }) => {
    const items = body?.items;
    const payment = body?.payment;
    if (!Array.isArray(items) || items.length === 0) throw new DemoError(400, 'At least one sale item is required');
    if (!payment || !paymentMethods.includes(payment.payment_method)) throw new DemoError(400, 'A valid payment method is required');
    const account = byId('users', user.userId);
    if (!account || account.status !== 'Active') throw new DemoError(401, 'Active employee account not found');

    const grouped = new Map();
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = requireNumber(item.quantity, 'Quantity', { positive: true });
      if (!Number.isInteger(productId)) throw new DemoError(400, 'Invalid product');
      grouped.set(productId, round3((grouped.get(productId) || 0) + quantity));
    }
    const lines = [...grouped].map(([productId, quantity]) => {
      const product = byId('products', productId);
      if (!product || product.status !== 'Active') throw new DemoError(404, 'One or more products were not found or are inactive');
      if (Number(product.stock_quantity) < quantity) throw new DemoError(409, `Insufficient stock for ${product.product_name}`);
      return { product, quantity, subtotalCents: Math.round(toCents(product.selling_price) * quantity) };
    });
    const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
    const discountCents = toCents(requireNumber(body.discount ?? 0, 'Discount'));
    if (discountCents > subtotalCents) throw new DemoError(400, 'Discount cannot exceed the subtotal');
    const totalCents = subtotalCents - discountCents;
    const paidCents = toCents(requireNumber(payment.amount, 'Payment amount'));
    if (paidCents < totalCents) throw new DemoError(400, 'Payment amount is less than the sale total');

    const id = nextId('sales');
    const time = nowIso();
    const saleNumber = generateNumber('SAL');
    t().sales.push({ id, sale_number: saleNumber, employee_id: account.employee_id, sale_date: time, subtotal: subtotalCents / 100, discount: discountCents / 100, total_amount: totalCents / 100, sale_status: 'Completed', created_at: time, updated_at: time });
    for (const line of lines) {
      const previous = Number(line.product.stock_quantity);
      const next = round3(previous - line.quantity);
      t().sale_items.push({ id: nextId('sale_items'), sale_id: id, product_id: line.product.id, quantity: line.quantity, unit_price: line.product.selling_price, subtotal: line.subtotalCents / 100, created_at: time });
      line.product.stock_quantity = next;
      addLog(line.product.id, user.userId, 'SALE', -line.quantity, previous, next, 'SALE', id);
    }
    t().payments.push({
      id: nextId('payments'), sale_id: id, payment_date: time, amount: totalCents / 100, amount_tendered: paidCents / 100,
      change_amount: (paidCents - totalCents) / 100, payment_method: payment.payment_method,
      reference_number: text(String(payment.reference_number ?? '')) || null, payment_status: 'Paid', created_at: time, updated_at: time
    });
    commit();
    return {
      status: 201, message: 'Sale completed',
      data: { sale: { id, sale_number: saleNumber, subtotal: (subtotalCents / 100).toFixed(2), discount: (discountCents / 100).toFixed(2), total_amount: (totalCents / 100).toFixed(2), amount_paid: (paidCents / 100).toFixed(2), change: ((paidCents - totalCents) / 100).toFixed(2) } }
    };
  },
  cancel: ({ params, user }) => {
    const sale = byId('sales', params[0]);
    if (!sale) throw new DemoError(404, 'Sale not found');
    if (sale.sale_status !== 'Completed') throw new DemoError(409, 'Only completed sales can be cancelled once');
    for (const item of t().sale_items.filter((row) => row.sale_id === sale.id)) {
      const product = byId('products', item.product_id);
      const previous = Number(product.stock_quantity);
      const next = round3(previous + Number(item.quantity));
      product.stock_quantity = next;
      addLog(product.id, user.userId, 'SALE_CANCELLED', item.quantity, previous, next, 'SALE', sale.id, 'Completed sale cancellation');
    }
    sale.sale_status = 'Cancelled';
    sale.updated_at = nowIso();
    const payment = paymentFor(sale.id);
    if (payment) Object.assign(payment, { payment_status: 'Cancelled', updated_at: nowIso() });
    commit();
    return { message: 'Sale cancelled and inventory restored', data: { sale: { id: sale.id, status: 'Cancelled' } } };
  },
  status: ({ params, body }) => {
    if (!['Pending', 'Cancelled'].includes(body?.status)) throw new DemoError(400, 'Only Pending or Cancelled status may be requested');
    const sale = byId('sales', params[0]);
    if (!sale) throw new DemoError(404, 'Sale not found');
    if (sale.sale_status === 'Completed') throw new DemoError(409, 'Completed sales cannot be changed without a stock-reversing workflow');
    sale.sale_status = body.status;
    commit();
    return { message: 'Sale status updated' };
  }
};

function paymentRow(payment) {
  const sale = byId('sales', payment.sale_id);
  const { created_at, updated_at, ...rest } = payment;
  return { ...rest, sale_number: sale?.sale_number, employee_name: employeeName(sale?.employee_id) };
}

const paymentsApi = {
  list: ({ query }) => {
    const method = text(query.payment_method);
    const status = text(query.status);
    const search = text(query.search);
    const from = isoDate.test(text(query.from)) ? text(query.from) : '';
    const to = isoDate.test(text(query.to)) ? text(query.to) : '';
    const rows = t().payments.filter((payment) => (!paymentMethods.includes(method) || payment.payment_method === method)
      && (!paymentStatuses.includes(status) || payment.payment_status === status)
      && inDateRange(payment.payment_date, from, to)
      && (!search || contains(byId('sales', payment.sale_id)?.sale_number, search) || contains(payment.reference_number, search)));
    return { data: { payments: sortBy(rows, '-payment_date', '-id').slice(0, 200).map(paymentRow) } };
  }
};

// ---- Stock receiving ------------------------------------------------------------------------------------------
function receivingRow(receiving) {
  const supplier = byId('suppliers', receiving.supplier_id);
  return { ...receiving, supplier_name: supplier?.supplier_name, received_by_name: employeeName(receiving.received_by), item_count: t().stock_receiving_items.filter((item) => item.receiving_id === receiving.id).length };
}

const receivingApi = {
  list: ({ query }) => {
    const search = text(query.search);
    const supplierId = Number(query.supplier_id);
    const rows = t().stock_receiving.filter((row) => (!search || contains(row.receiving_number, search) || contains(row.reference_number, search) || contains(byId('suppliers', row.supplier_id)?.supplier_name, search))
      && (!(supplierId > 0) || row.supplier_id === supplierId));
    return { data: { receiving: sortBy(rows, '-receiving_date', '-id').slice(0, 200).map(receivingRow) } };
  },
  get: ({ params }) => {
    const receiving = byId('stock_receiving', params[0]);
    if (!receiving) throw new DemoError(404, 'Receiving transaction not found');
    const items = t().stock_receiving_items.filter((item) => item.receiving_id === receiving.id).map((item) => {
      const product = byId('products', item.product_id);
      return { product_id: item.product_id, product_code: product?.product_code, product_name: product?.product_name, unit: product?.unit, quantity: item.quantity, unit_cost: item.unit_cost, subtotal: item.subtotal };
    });
    return { data: { receiving: { ...receivingRow(receiving), items } } };
  },
  create: ({ body, user }) => {
    const supplierId = Number(body?.supplier_id);
    if (!Number.isInteger(supplierId)) throw new DemoError(400, 'A valid supplier is required');
    if (!Array.isArray(body?.items) || body.items.length === 0) throw new DemoError(400, 'At least one receiving item is required');
    const supplier = byId('suppliers', supplierId);
    if (!supplier || supplier.status !== 'Active') throw new DemoError(404, 'Supplier was not found or is inactive');
    const account = byId('users', user.userId);
    const seen = new Set();
    const lines = body.items.map((item) => {
      const productId = Number(item.product_id);
      if (!Number.isInteger(productId)) throw new DemoError(400, 'Invalid product');
      const quantity = requireNumber(item.quantity, 'Quantity', { positive: true });
      const unitCost = requireNumber(item.unit_cost, 'Unit cost');
      if (seen.has(productId)) throw new DemoError(400, 'A product may only appear once in a receiving transaction');
      seen.add(productId);
      const product = byId('products', productId);
      if (!product || product.status !== 'Active') throw new DemoError(404, 'One or more products were not found or are inactive');
      return { product, quantity: round3(quantity), unitCost: round2(unitCost), subtotalCents: Math.round(toCents(unitCost) * quantity) };
    });
    const id = nextId('stock_receiving');
    const time = nowIso();
    const totalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
    const receivingNumber = generateNumber('REC');
    t().stock_receiving.push({ id, receiving_number: receivingNumber, supplier_id: supplierId, received_by: account.employee_id, receiving_date: time, reference_number: text(String(body.reference_number ?? '')) || null, total_cost: totalCents / 100, status: 'Completed', created_at: time, updated_at: time });
    for (const line of lines) {
      const previous = Number(line.product.stock_quantity);
      const next = round3(previous + line.quantity);
      t().stock_receiving_items.push({ id: nextId('stock_receiving_items'), receiving_id: id, product_id: line.product.id, quantity: line.quantity, unit_cost: line.unitCost, subtotal: line.subtotalCents / 100, created_at: time });
      line.product.stock_quantity = next;
      addLog(line.product.id, user.userId, 'STOCK_RECEIVING', line.quantity, previous, next, 'STOCK_RECEIVING', id);
    }
    commit();
    return { status: 201, message: 'Stock receiving completed', data: { receiving: { id, receiving_number: receivingNumber, total_cost: (totalCents / 100).toFixed(2) } } };
  }
};

// ---- Dashboard ------------------------------------------------------------------------------------------
function dashboard({ user }) {
  const completed = t().sales.filter((sale) => sale.sale_status === 'Completed');
  const today = completed.filter((sale) => isToday(sale.sale_date));
  const weekStart = daysAgoKey(6);
  const week = completed.filter((sale) => localDateKey(sale.sale_date) >= weekStart);
  const monthStart = daysAgoKey(29);
  const activeProducts = t().products.filter((product) => product.status === 'Active');
  const sum = (rows, field) => round2(rows.reduce((total, row) => total + Number(row[field]), 0));
  const account = byId('users', user.userId);
  const mine = today.filter((sale) => sale.employee_id === account?.employee_id);

  const chart = new Map();
  for (const sale of week) {
    const key = localDateKey(sale.sale_date);
    const day = chart.get(key) || { sale_date: key, total_sales: 0, transactions: 0 };
    day.total_sales = round2(day.total_sales + Number(sale.total_amount));
    day.transactions += 1;
    chart.set(key, day);
  }
  const mix = new Map();
  for (const payment of t().payments.filter((row) => row.payment_status === 'Paid' && isToday(row.payment_date))) {
    const entry = mix.get(payment.payment_method) || { payment_method: payment.payment_method, amount: 0, count: 0 };
    entry.amount = round2(entry.amount + Number(payment.amount));
    entry.count += 1;
    mix.set(payment.payment_method, entry);
  }
  const monthSaleIds = new Set(completed.filter((sale) => localDateKey(sale.sale_date) >= monthStart).map((sale) => sale.id));
  const top = new Map();
  for (const item of t().sale_items.filter((row) => monthSaleIds.has(row.sale_id))) {
    const product = byId('products', item.product_id);
    const entry = top.get(item.product_id) || { id: item.product_id, product_name: product?.product_name, unit: product?.unit, quantity_sold: 0, revenue: 0 };
    entry.quantity_sold = round3(entry.quantity_sold + Number(item.quantity));
    entry.revenue = round2(entry.revenue + Number(item.subtotal));
    top.set(item.product_id, entry);
  }

  return {
    data: {
      summary: {
        todaySales: sum(today, 'total_amount'),
        todayTransactions: today.length,
        totalProducts: activeProducts.length,
        lowStockCount: activeProducts.filter((product) => Number(product.stock_quantity) > 0 && Number(product.stock_quantity) <= Number(product.reorder_level)).length,
        outOfStockCount: activeProducts.filter((product) => Number(product.stock_quantity) === 0).length,
        activeEmployees: t().employees.filter((employee) => employee.status === 'Active').length
      },
      myToday: { sales: sum(mine, 'total_amount'), transactions: mine.length },
      period: { sales: sum(week, 'total_amount'), transactions: week.length, averageTransaction: week.length ? round2(sum(week, 'total_amount') / week.length) : 0 },
      chart: sortBy([...chart.values()], 'sale_date'),
      paymentMix: sortBy([...mix.values()], '-amount'),
      topProducts: sortBy([...top.values()], '-revenue').slice(0, 5),
      lowStock: sortBy(activeProducts.filter((product) => Number(product.stock_quantity) <= Number(product.reorder_level)), 'stock_quantity', 'product_name').slice(0, 8)
        .map(({ id, product_name, stock_quantity, reorder_level, unit }) => ({ id, product_name, stock_quantity, reorder_level, unit })),
      recentSales: sortBy(t().sales, '-sale_date', '-id').slice(0, 8)
        .map((sale) => ({ id: sale.id, sale_number: sale.sale_number, sale_date: sale.sale_date, total_amount: sale.total_amount, sale_status: sale.sale_status, employee_name: employeeName(sale.employee_id) }))
    }
  };
}

// ---- Reports ------------------------------------------------------------------------------------------
function reportDates(query) {
  const check = (value, label) => {
    if (!value) return '';
    if (!isoDate.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) throw new DemoError(400, `${label} must be a valid date in YYYY-MM-DD format`);
    return value;
  };
  const from = check(text(query.date_from), 'Start date');
  const to = check(text(query.date_to), 'End date');
  if (from && to && from > to) throw new DemoError(400, 'Start date must be on or before end date');
  return { from, to };
}
const optionalId = (value) => (value === undefined || value === '' ? null : Number(value));

const reports = {
  sales: ({ query }) => {
    const { from, to } = reportDates(query);
    const categoryId = optionalId(query.category_id);
    const status = text(query.status);
    const employeeId = optionalId(query.employee_id);
    const matches = (sale) => inDateRange(sale.sale_date, from, to)
      && (!status || sale.sale_status === status)
      && (!employeeId || sale.employee_id === employeeId)
      && (!categoryId || t().sale_items.some((item) => item.sale_id === sale.id && byId('products', item.product_id)?.category_id === categoryId));
    const rows = sortBy(t().sales.filter(matches), '-sale_date', '-id').slice(0, 1000).map((sale) => ({
      id: sale.id, sale_number: sale.sale_number, sale_date: sale.sale_date, employee_name: employeeName(sale.employee_id),
      subtotal: sale.subtotal, discount: sale.discount, total_amount: sale.total_amount, sale_status: sale.sale_status
    }));
    const counted = t().sales.filter((sale) => matches(sale) && (status || sale.sale_status === 'Completed'));
    const total = (field) => round2(counted.reduce((sum, sale) => sum + Number(sale[field]), 0));
    return { data: { rows, summary: { totalTransactions: counted.length, grossSales: total('subtotal'), discounts: total('discount'), netSales: total('total_amount') } } };
  },
  'product-sales': ({ query }) => {
    const { from, to } = reportDates(query);
    const categoryId = optionalId(query.category_id);
    const saleIds = new Set(t().sales.filter((sale) => sale.sale_status === 'Completed' && inDateRange(sale.sale_date, from, to)).map((sale) => sale.id));
    const totals = new Map();
    for (const item of t().sale_items.filter((row) => saleIds.has(row.sale_id))) {
      const product = byId('products', item.product_id);
      if (categoryId && product?.category_id !== categoryId) continue;
      const entry = totals.get(item.product_id) || { product_name: product?.product_name, quantity_sold: 0, revenue: 0 };
      entry.quantity_sold = round3(entry.quantity_sold + Number(item.quantity));
      entry.revenue = round2(entry.revenue + Number(item.subtotal));
      totals.set(item.product_id, entry);
    }
    const rows = sortBy([...totals.values()], query.sort === 'revenue' ? '-revenue' : '-quantity_sold');
    return { data: { rows, summary: { quantitySold: round3(rows.reduce((sum, row) => sum + row.quantity_sold, 0)), revenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)) } } };
  },
  inventory: ({ query }) => {
    const categoryId = optionalId(query.category_id);
    const rows = sortBy(t().products.filter((product) => !categoryId || product.category_id === categoryId), 'product_name').map((product) => ({
      product_code: product.product_code, product_name: product.product_name, category_id: product.category_id,
      category_name: byId('categories', product.category_id)?.category_name, stock_quantity: product.stock_quantity, reorder_level: product.reorder_level,
      cost_price: product.cost_price, selling_price: product.selling_price, stock_status: stockStatus(product),
      inventory_value: round2(Number(product.stock_quantity) * Number(product.cost_price))
    }));
    return { data: { rows, summary: { inventoryValue: round2(rows.reduce((sum, row) => sum + row.inventory_value, 0)) } } };
  },
  'stock-receiving': ({ query }) => {
    const { from, to } = reportDates(query);
    const supplierId = optionalId(query.supplier_id);
    const matching = t().stock_receiving.filter((row) => inDateRange(row.receiving_date, from, to) && (!supplierId || row.supplier_id === supplierId));
    const rows = sortBy(matching, '-receiving_date', '-id').slice(0, 1000).map((row) => ({
      id: row.id, receiving_number: row.receiving_number, receiving_date: row.receiving_date, supplier_id: row.supplier_id,
      supplier_name: byId('suppliers', row.supplier_id)?.supplier_name, employee_name: employeeName(row.received_by), total_cost: row.total_cost, status: row.status
    }));
    return { data: { rows, summary: { totalTransactions: matching.length, totalCost: round2(matching.reduce((sum, row) => sum + Number(row.total_cost), 0)) } } };
  },
  payments: ({ query }) => {
    const { from, to } = reportDates(query);
    const method = text(query.payment_method);
    const status = text(query.status);
    if (method && !paymentMethods.includes(method)) throw new DemoError(400, 'Invalid payment method');
    if (status && !paymentStatuses.includes(status)) throw new DemoError(400, 'Invalid payment status');
    const matching = t().payments.filter((payment) => inDateRange(payment.payment_date, from, to) && (!method || payment.payment_method === method) && (!status || payment.payment_status === status));
    const rows = sortBy(matching, '-payment_date', '-id').slice(0, 1000).map((payment) => ({
      payment_date: payment.payment_date, sale_number: byId('sales', payment.sale_id)?.sale_number, payment_method: payment.payment_method,
      reference_number: payment.reference_number, amount: payment.amount, payment_status: payment.payment_status
    }));
    const counted = status ? matching : matching.filter((payment) => payment.payment_status === 'Paid');
    const summary = { Cash: 0, GCash: 0, 'Bank Transfer': 0, Other: 0, total: 0 };
    for (const payment of counted) {
      summary[payment.payment_method] = round2(summary[payment.payment_method] + Number(payment.amount));
      summary.total = round2(summary.total + Number(payment.amount));
    }
    return { data: { rows, summary } };
  },
  suppliers: ({ query }) => {
    const { from, to } = reportDates(query);
    const supplierId = optionalId(query.supplier_id);
    const rows = t().suppliers.filter((supplier) => !supplierId || supplier.id === supplierId).map((supplier) => {
      const receipts = t().stock_receiving.filter((row) => row.supplier_id === supplier.id && inDateRange(row.receiving_date, from, to));
      const last = receipts.reduce((latest, row) => (!latest || row.receiving_date > latest ? row.receiving_date : latest), null);
      return { id: supplier.id, supplier_name: supplier.supplier_name, status: supplier.status, receiving_count: receipts.length, total_supply_cost: round2(receipts.reduce((sum, row) => sum + Number(row.total_cost), 0)), last_receiving_date: last };
    });
    return {
      data: {
        rows: sortBy(rows, '-total_supply_cost'),
        summary: { supplierCount: rows.length, receivingCount: rows.reduce((sum, row) => sum + row.receiving_count, 0), totalSupplyCost: round2(rows.reduce((sum, row) => sum + row.total_supply_cost, 0)) }
      }
    };
  }
};

function audit({ query }) {
  const productId = Number(query.product_id);
  const type = text(query.transaction_type);
  const search = text(query.search);
  const rows = sortBy(t().inventory_logs, '-created_at', '-id').map(logRow).filter((log) => (!(productId > 0) || log.product_id === productId)
    && (!transactionTypes.includes(type) || log.transaction_type === type)
    && (!search || contains(log.product_name, search) || contains(log.reason, search) || contains(log.performed_by, search)));
  return { data: { logs: rows.slice(0, 1000) } };
}

// ---- Router ------------------------------------------------------------------------------------------
const anyone = null;
const routes = [
  ['POST', /^\/auth\/login$/, login, 'public'],
  ['GET', /^\/auth\/me$/, ({ user }) => ({ data: { user: publicUser(byId('users', user.userId)) } }), anyone],
  ['POST', /^\/auth\/logout$/, () => ({ message: 'Logout successful' }), anyone],

  ['GET', /^\/categories$/, categoriesApi.list, anyone],
  ['GET', /^\/categories\/(\d+)$/, categoriesApi.get, anyone],
  ['POST', /^\/categories$/, categoriesApi.create, managers],
  ['PUT', /^\/categories\/(\d+)$/, categoriesApi.update, managers],
  ['PATCH', /^\/categories\/(\d+)\/status$/, categoriesApi.status, managers],

  ['GET', /^\/products$/, productsApi.list, anyone],
  ['GET', /^\/products\/(\d+)$/, productsApi.get, anyone],
  ['POST', /^\/products$/, productsApi.create, managers],
  ['PUT', /^\/products\/(\d+)$/, productsApi.update, managers],
  ['PATCH', /^\/products\/(\d+)\/status$/, productsApi.status, managers],

  ['GET', /^\/suppliers$/, suppliersApi.list, anyone],
  ['GET', /^\/suppliers\/(\d+)$/, suppliersApi.get, anyone],
  ['POST', /^\/suppliers$/, suppliersApi.create, managers],
  ['PUT', /^\/suppliers\/(\d+)$/, suppliersApi.update, managers],
  ['PATCH', /^\/suppliers\/(\d+)\/status$/, suppliersApi.status, managers],

  ['GET', /^\/employees$/, employeesApi.list, managers],
  ['GET', /^\/employees\/(\d+)$/, employeesApi.get, managers],
  ['POST', /^\/employees$/, employeesApi.create, managers],
  ['PUT', /^\/employees\/(\d+)$/, employeesApi.update, managers],
  ['PATCH', /^\/employees\/(\d+)\/status$/, employeesApi.status, managers],

  ['GET', /^\/users$/, usersApi.list, ['Owner']],
  ['GET', /^\/users\/(\d+)$/, usersApi.get, ['Owner']],
  ['POST', /^\/users$/, usersApi.create, ['Owner']],
  ['PUT', /^\/users\/(\d+)$/, usersApi.update, ['Owner']],
  ['PATCH', /^\/users\/(\d+)\/status$/, usersApi.status, ['Owner']],
  ['POST', /^\/users\/(\d+)\/reset-password$/, usersApi.resetPassword, ['Owner']],

  ['POST', /^\/inventory\/adjustments$/, inventoryApi.adjust, managers],
  ['GET', /^\/inventory$/, inventoryApi.list, anyone],
  ['GET', /^\/inventory\/low-stock$/, inventoryApi.lowStock, anyone],
  ['GET', /^\/inventory\/(\d+)\/logs$/, inventoryApi.logs, anyone],
  ['GET', /^\/inventory\/(\d+)$/, inventoryApi.product, anyone],

  ['GET', /^\/sales$/, salesApi.list, sellers],
  ['GET', /^\/sales\/(\d+)$/, salesApi.get, sellers],
  ['POST', /^\/sales$/, salesApi.create, sellers],
  ['PATCH', /^\/sales\/(\d+)\/cancel$/, salesApi.cancel, managers],
  ['PATCH', /^\/sales\/(\d+)\/status$/, salesApi.status, managers],

  ['GET', /^\/payments$/, paymentsApi.list, sellers],

  ['GET', /^\/stock-receiving$/, receivingApi.list, receivers],
  ['GET', /^\/stock-receiving\/(\d+)$/, receivingApi.get, receivers],
  ['POST', /^\/stock-receiving$/, receivingApi.create, receivers],

  ['GET', /^\/dashboard\/summary$/, dashboard, anyone],
  ...Object.entries(reports).map(([name, handler]) => ['GET', new RegExp(`^/reports/${name}$`), handler, managers]),
  ['GET', /^\/audit$/, audit, managers],
  ['GET', /^\/health$/, () => ({ message: 'API is running', data: { database: 'browser demo' } }), 'public']
];

export async function handleDemoRequest({ method, path, body, token }) {
  await new Promise((resolve) => setTimeout(resolve, 60));
  const [rawPath, queryString = ''] = path.split('?');
  const cleanPath = rawPath.replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(new URLSearchParams(queryString));
  try {
    const route = routes.find(([routeMethod, pattern]) => routeMethod === method && pattern.test(cleanPath));
    if (!route) throw new DemoError(404, 'Endpoint not found');
    const [, pattern, handler, access] = route;
    const params = cleanPath.match(pattern).slice(1);
    let user = null;
    if (access !== 'public') {
      user = authenticate(token);
      if (Array.isArray(access) && !access.includes(user.role)) throw new DemoError(403, 'You are not authorized for this action');
    }
    const result = handler({ params, query, body, user });
    const { status = 200, ...payload } = result;
    return { status, body: JSON.parse(JSON.stringify({ success: true, ...payload })) };
  } catch (error) {
    if (error instanceof DemoError) return { status: error.status, body: { success: false, message: error.message } };
    console.error(error);
    return { status: 500, body: { success: false, message: 'An unexpected server error occurred' } };
  }
}
