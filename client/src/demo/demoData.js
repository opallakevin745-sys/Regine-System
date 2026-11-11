/*
 * Sample business data for Mutya Licios Lechon Manok.
 *
 * Shared by the in-browser demo API (GitHub Pages build) and server/scripts/seed-demo.js,
 * so the hosted demo and a locally seeded MySQL database contain the same kind of records.
 * The month of activity is simulated relative to `now`: stock only moves through receiving,
 * sales, cancellations, and adjustments, and every movement has a matching inventory log,
 * exactly like the real API. A fixed random seed keeps the dataset stable between runs.
 */

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const SIMULATED_DAYS = 30;

const employees = [
  { id: 1, employee_code: 'EMP-0001', first_name: 'System', last_name: 'Administrator', position: 'Owner', phone: '0917 555 0101', hire_date: '2022-01-10', status: 'Active' },
  { id: 2, employee_code: 'EMP-0002', first_name: 'Maria', last_name: 'Santos', position: 'Store Manager', phone: '0917 555 0102', hire_date: '2022-03-01', status: 'Active' },
  { id: 3, employee_code: 'EMP-0003', first_name: 'Jose', last_name: 'Reyes', position: 'Cashier', phone: '0918 555 0103', hire_date: '2023-06-15', status: 'Active' },
  { id: 4, employee_code: 'EMP-0004', first_name: 'Ana', last_name: 'Cruz', position: 'Cashier', phone: '0919 555 0104', hire_date: '2024-02-01', status: 'Active' },
  { id: 5, employee_code: 'EMP-0005', first_name: 'Mark', last_name: 'Dela Cruz', position: 'Inventory Staff', phone: '0920 555 0105', hire_date: '2023-09-20', status: 'Active' },
  { id: 6, employee_code: 'EMP-0006', first_name: 'Liza', last_name: 'Garcia', position: 'Head Cook', phone: '0921 555 0106', hire_date: '2022-05-12', status: 'Active' },
  { id: 7, employee_code: 'EMP-0007', first_name: 'Ramon', last_name: 'Bautista', position: 'Roaster', phone: '0922 555 0107', hire_date: '2023-01-08', status: 'Active' },
  { id: 8, employee_code: 'EMP-0008', first_name: 'Paolo', last_name: 'Mendoza', position: 'Cashier', phone: '0923 555 0108', hire_date: '2023-04-03', status: 'Inactive' }
];

const users = [
  { id: 1, employee_id: 1, username: 'admin', password: 'admin123', role: 'Owner', status: 'Active' },
  { id: 2, employee_id: 2, username: 'manager', password: 'manager123', role: 'Manager', status: 'Active' },
  { id: 3, employee_id: 3, username: 'cashier', password: 'cashier123', role: 'Cashier', status: 'Active' },
  { id: 4, employee_id: 4, username: 'cashier2', password: 'cashier123', role: 'Cashier', status: 'Active' },
  { id: 5, employee_id: 5, username: 'staff', password: 'staff123', role: 'Staff', status: 'Active' },
  { id: 6, employee_id: 8, username: 'pmendoza', password: 'inactive123', role: 'Cashier', status: 'Inactive' }
];

const categories = [
  { id: 1, category_name: 'Lechon Manok', description: 'Charcoal-roasted whole, half, and quarter chickens', status: 'Active' },
  { id: 2, category_name: 'Liempo & Grilled', description: 'Roasted pork belly and grilled skewers', status: 'Active' },
  { id: 3, category_name: 'Rice & Sides', description: 'Rice cups, pickles, and party trays', status: 'Active' },
  { id: 4, category_name: 'Sauces & Condiments', description: 'House sauces, vinegar, and gravy', status: 'Active' },
  { id: 5, category_name: 'Beverages', description: 'Bottled water, softdrinks, and juices', status: 'Active' },
  { id: 6, category_name: 'Holiday Specials', description: 'Seasonal bundles offered during the holidays', status: 'Inactive' }
];

const suppliers = [
  { id: 1, supplier_code: 'SUP-001', supplier_name: 'Golden Harvest Poultry Farm', contact_person: 'Ramon Villanueva', phone: '0917 555 2001', address: 'Lipa City, Batangas', status: 'Active' },
  { id: 2, supplier_code: 'SUP-002', supplier_name: 'San Isidro Meat Trading', contact_person: 'Teresa Aquino', phone: '0918 555 2002', address: 'Sta. Rosa, Laguna', status: 'Active' },
  { id: 3, supplier_code: 'SUP-003', supplier_name: 'Metro Beverage Distributors', contact_person: 'Carlo Mercado', phone: '0919 555 2003', address: 'Pasig City, Metro Manila', status: 'Active' },
  { id: 4, supplier_code: 'SUP-004', supplier_name: 'Kusina Provisions & Condiments', contact_person: 'Grace Navarro', phone: '0920 555 2004', address: 'Marikina City, Metro Manila', status: 'Active' },
  { id: 5, supplier_code: 'SUP-005', supplier_name: 'Bigas Express Rice Trading', contact_person: 'Danilo Ramos', phone: '0921 555 2005', address: 'Cabanatuan City, Nueva Ecija', status: 'Active' },
  { id: 6, supplier_code: 'SUP-006', supplier_name: 'Laguna Charcoal Depot', contact_person: 'Edwin Flores', phone: '0922 555 2006', address: 'Calamba, Laguna', status: 'Inactive' }
];

// par = level each delivery tops the shelf up to; finalState marks products that should end the
// month low on stock or sold out so the inventory warnings have something to show.
const products = [
  { id: 1, category_id: 1, supplier_id: 1, product_code: 'LM-001', product_name: 'Whole Lechon Manok', unit: 'piece', cost_price: 215, selling_price: 340, reorder_level: 15, par: 60, description: 'Charcoal-roasted whole chicken stuffed with lemongrass' },
  { id: 2, category_id: 1, supplier_id: 1, product_code: 'LM-002', product_name: 'Half Lechon Manok', unit: 'piece', cost_price: 112, selling_price: 180, reorder_level: 10, par: 40, description: 'Half of a roasted chicken' },
  { id: 3, category_id: 1, supplier_id: 1, product_code: 'LM-003', product_name: 'Spicy Whole Lechon Manok', unit: 'piece', cost_price: 230, selling_price: 365, reorder_level: 8, par: 18, finalState: 'low', description: 'Whole roasted chicken with chili-garlic rub' },
  { id: 4, category_id: 1, supplier_id: 1, product_code: 'LM-004', product_name: 'Lechon Manok Quarter Leg', unit: 'piece', cost_price: 58, selling_price: 95, reorder_level: 12, par: 40, description: 'Leg quarter, ideal for solo meals' },
  { id: 5, category_id: 2, supplier_id: 2, product_code: 'LG-001', product_name: 'Lechon Liempo', unit: 'kg', cost_price: 330, selling_price: 520, reorder_level: 4, par: 20, description: 'Slow-roasted pork belly sold by weight' },
  { id: 6, category_id: 2, supplier_id: 2, product_code: 'LG-002', product_name: 'Pork BBQ Skewer', unit: 'stick', cost_price: 18, selling_price: 35, reorder_level: 30, par: 110, description: 'Sweet-style grilled pork barbecue' },
  { id: 7, category_id: 2, supplier_id: 2, product_code: 'LG-003', product_name: 'Chicken Isaw Skewer', unit: 'stick', cost_price: 5, selling_price: 12, reorder_level: 40, par: 120, description: 'Grilled chicken intestine skewer' },
  { id: 8, category_id: 3, supplier_id: 5, product_code: 'RS-001', product_name: 'Plain Rice', unit: 'cup', cost_price: 9, selling_price: 20, reorder_level: 40, par: 260, description: 'Steamed white rice' },
  { id: 9, category_id: 3, supplier_id: 5, product_code: 'RS-002', product_name: 'Java Rice', unit: 'cup', cost_price: 13, selling_price: 30, reorder_level: 30, par: 100, description: 'Annatto-butter fried rice' },
  { id: 10, category_id: 3, supplier_id: 4, product_code: 'RS-003', product_name: 'Atchara', unit: 'pack', cost_price: 16, selling_price: 35, reorder_level: 12, par: 40, finalState: 'low', description: 'Pickled green papaya' },
  { id: 11, category_id: 3, supplier_id: 4, product_code: 'RS-004', product_name: 'Pancit Canton Party Tray', unit: 'tray', cost_price: 165, selling_price: 290, reorder_level: 3, par: 14, finalState: 'low', description: 'Stir-fried noodles good for 4 to 5 persons' },
  { id: 12, category_id: 4, supplier_id: 4, product_code: 'SC-001', product_name: 'Lechon Liver Sauce', unit: 'bottle', cost_price: 28, selling_price: 50, reorder_level: 15, par: 60, description: 'Sweet liver-based dipping sauce, 300 ml' },
  { id: 13, category_id: 4, supplier_id: 4, product_code: 'SC-002', product_name: 'Spiced Cane Vinegar', unit: 'bottle', cost_price: 22, selling_price: 40, reorder_level: 15, par: 40, description: 'Garlic and chili cane vinegar, 350 ml' },
  { id: 14, category_id: 4, supplier_id: 4, product_code: 'SC-003', product_name: 'Gravy Cup', unit: 'cup', cost_price: 7, selling_price: 15, reorder_level: 25, par: 80, description: 'House gravy, 2 oz cup' },
  { id: 15, category_id: 5, supplier_id: 3, product_code: 'BV-001', product_name: 'Bottled Water 500ml', unit: 'bottle', cost_price: 11, selling_price: 20, reorder_level: 24, par: 100, description: 'Purified drinking water' },
  { id: 16, category_id: 5, supplier_id: 3, product_code: 'BV-002', product_name: 'Cola 1.5L', unit: 'bottle', cost_price: 58, selling_price: 90, reorder_level: 12, par: 50, description: 'Family-size cola' },
  { id: 17, category_id: 5, supplier_id: 3, product_code: 'BV-003', product_name: 'Canned Soda 330ml', unit: 'can', cost_price: 29, selling_price: 45, reorder_level: 24, par: 96, finalState: 'out', description: 'Assorted canned softdrinks' },
  { id: 18, category_id: 5, supplier_id: 3, product_code: 'BV-004', product_name: 'Calamansi Juice', unit: 'glass', cost_price: 12, selling_price: 35, reorder_level: 20, par: 50, description: 'Freshly squeezed calamansi, 12 oz' },
  { id: 19, category_id: 6, supplier_id: 1, product_code: 'HS-001', product_name: 'Holiday Lechon Bundle', unit: 'bundle', cost_price: 650, selling_price: 999, reorder_level: 0, par: 0, status: 'Inactive', description: '2 whole lechon manok, pancit tray, and 1.5L cola' }
];

// Deliveries: [supplier id, every N days, first simulated day, hour, minute].
const deliverySchedule = [
  [1, 2, 2, 6, 30],
  [2, 3, 3, 7, 15],
  [3, 7, 1, 10, 30],
  [4, 7, 3, 9, 15],
  [5, 7, 5, 8, 0]
];

const mainItems = [[1, 30], [2, 22], [3, 6], [4, 12], [5, 10], [6, 12], [7, 6], [11, 3]];
const extraItems = [[8, 25], [9, 10], [10, 8], [12, 12], [13, 6], [14, 10], [15, 10], [16, 10], [17, 8], [18, 6]];
const quantityChoices = {
  1: [[1, 80], [2, 17], [3, 3]], 2: [[1, 85], [2, 15]], 3: [[1, 1]], 4: [[1, 50], [2, 35], [3, 15]],
  5: [[0.25, 15], [0.5, 40], [0.75, 15], [1, 22], [1.5, 8]], 6: [[2, 25], [3, 20], [4, 30], [6, 25]],
  7: [[5, 50], [10, 50]], 11: [[1, 1]], 8: [[1, 35], [2, 35], [3, 20], [4, 10]], 9: [[1, 50], [2, 35], [3, 15]],
  10: [[1, 1]], 12: [[1, 1]], 13: [[1, 1]], 14: [[1, 70], [2, 30]], 15: [[1, 55], [2, 30], [3, 15]],
  16: [[1, 1]], 17: [[1, 45], [2, 35], [4, 20]], 18: [[1, 70], [2, 30]]
};
// Busier on Friday through Sunday (index = Date#getDay()).
const salesPerDay = [26, 15, 14, 16, 17, 22, 28];

const plannedAdjustments = [
  { day: 6, hour: 15, minute: 20, productId: 1, quantity: -2, userId: 2, reason: 'Spoiled after chiller power outage' },
  { day: 11, hour: 19, minute: 45, productId: 8, quantity: 5, userId: 2, reason: 'Physical count correction' },
  { day: 15, hour: 8, minute: 10, productId: 12, quantity: -3, userId: 1, reason: 'Expired bottles removed from shelf' },
  { day: 20, hour: 17, minute: 30, productId: 16, quantity: -1, userId: 2, reason: 'Bottle damaged during handling' },
  { day: 25, hour: 13, minute: 5, productId: 6, quantity: -6, userId: 2, reason: 'Dropped skewers during grilling' }
];
const cancelledSaleDays = [9, 17, 26];

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (value, length = 2) => String(value).padStart(length, '0');
const dateKey = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const cents = (pesos) => Math.round(pesos * 100);
const money = (centValue) => Math.round(centValue) / 100;
const milli = (quantity) => Math.round(quantity * 1000);
const quantity = (milliValue) => milliValue / 1000;

export function buildDemoData(now = new Date()) {
  const random = createRandom(20260115);
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const weighted = (choices) => {
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;
    for (const [value, weight] of choices) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return choices[choices.length - 1][0];
  };
  const pickDistinct = (choices, count) => {
    const pool = [...choices];
    const picked = [];
    while (picked.length < count && pool.length) {
      const value = weighted(pool);
      picked.push(value);
      pool.splice(pool.findIndex(([candidate]) => candidate === value), 1);
    }
    return picked;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayStart = (day) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (SIMULATED_DAYS - 1 - day));
  const at = (day, hour, minute) => new Date(dayStart(day).getTime() + (hour * 60 + minute) * MINUTE);
  const latestEventTime = now.getTime() - 5 * MINUTE;
  const masterCreatedAt = new Date(dayStart(0).getTime() - 20 * DAY);

  const productById = new Map(products.map((product) => [product.id, product]));
  const stock = new Map(products.map((product) => [product.id, 0]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const userByEmployee = new Map(users.map((user) => [user.employee_id, user]));

  const tables = {
    employees: employees.map((employee) => ({ ...employee, created_at: masterCreatedAt, updated_at: masterCreatedAt })),
    users: users.map((user) => ({ ...user, last_login: null, created_at: masterCreatedAt, updated_at: masterCreatedAt })),
    categories: categories.map((category) => ({ ...category, created_at: masterCreatedAt, updated_at: masterCreatedAt })),
    suppliers: suppliers.map((supplier) => ({ ...supplier, created_at: masterCreatedAt, updated_at: masterCreatedAt })),
    products: [],
    stock_receiving: [],
    stock_receiving_items: [],
    sales: [],
    sale_items: [],
    payments: [],
    inventory_logs: []
  };

  const daySequence = new Map();
  const nextNumber = (prefix, date) => {
    const key = `${prefix}-${dateKey(date)}`;
    const next = (daySequence.get(key) || 0) + 1;
    daySequence.set(key, next);
    return `${key}-${pad(next, 4)}`;
  };

  function log(productId, userId, type, changeMilli, referenceType, referenceId, reason, createdAt) {
    const previous = stock.get(productId);
    const next = previous + changeMilli;
    stock.set(productId, next);
    tables.inventory_logs.push({
      id: tables.inventory_logs.length + 1,
      product_id: productId,
      user_id: userId,
      transaction_type: type,
      quantity: quantity(changeMilli),
      previous_stock: quantity(previous),
      new_stock: quantity(next),
      reference_type: referenceType,
      reference_id: referenceId,
      reason: reason || null,
      created_at: createdAt
    });
  }

  // ---- Build the event timeline ---------------------------------------------------------
  const events = [];
  const restockFrozenFrom = SIMULATED_DAYS - 7;

  for (const supplier of suppliers.filter((item) => item.status === 'Active')) {
    events.push({ type: 'receiving', at: at(0, 6, 10 + supplier.id * 7), supplierId: supplier.id, opening: true });
  }
  for (const [supplierId, every, firstDay, hour, minute] of deliverySchedule) {
    for (let day = firstDay; day < SIMULATED_DAYS; day += every) {
      events.push({ type: 'receiving', at: at(day, hour, minute + between(0, 20)), supplierId, frozen: day >= restockFrozenFrom });
    }
  }
  for (const adjustment of plannedAdjustments) {
    events.push({ type: 'adjustment', at: at(adjustment.day, adjustment.hour, adjustment.minute), ...adjustment });
  }

  for (let day = 0; day < SIMULATED_DAYS; day += 1) {
    const start = dayStart(day);
    const isToday = day === SIMULATED_DAYS - 1;
    let openAt = at(day, 9, 0).getTime();
    const closeAt = Math.min(at(day, 20, 30).getTime(), isToday ? latestEventTime : Infinity);
    if (isToday && closeAt - openAt < 2 * 60 * MINUTE) openAt = Math.max(start.getTime() + MINUTE, closeAt - 2 * 60 * MINUTE);
    if (closeAt <= openAt) continue;

    const fullDayCount = salesPerDay[start.getDay()] + between(-3, 3);
    const count = Math.max(1, Math.round(fullDayCount * Math.min(1, (closeAt - openAt) / (11.5 * 60 * MINUTE))));
    const joseOff = start.getDay() === 3 && !isToday;
    const anaOff = start.getDay() === 1;
    const sellers = joseOff ? [[4, 85], [2, 12], [1, 3]] : anaOff ? [[3, 85], [2, 12], [1, 3]] : [[3, 50], [4, 40], [2, 7], [1, 3]];

    const times = [];
    for (let index = 0; index < count; index += 1) {
      let time;
      const roll = random();
      if (isToday && closeAt < at(day, 20, 30).getTime()) {
        time = openAt + random() * (closeAt - openAt);
      } else if (roll < 0.4) {
        time = at(day, 12, 0).getTime() + normal() * 50 * MINUTE;
      } else if (roll < 0.85) {
        time = at(day, 18, 0).getTime() + normal() * 60 * MINUTE;
      } else {
        time = openAt + random() * (closeAt - openAt);
      }
      times.push(Math.min(closeAt, Math.max(openAt, time)));
    }
    times.sort((a, b) => a - b);

    const cancelIndex = cancelledSaleDays.includes(day) ? between(0, count - 1) : -1;
    times.forEach((time, index) => {
      const mains = pickDistinct(mainItems, random() < 0.15 ? 2 : 1);
      const extras = pickDistinct(extraItems, weighted([[0, 22], [1, 35], [2, 28], [3, 15]]));
      const sellerEmployeeId = isToday && index === 0 ? 3 : weighted(sellers);
      events.push({
        type: 'sale',
        at: new Date(time),
        employeeId: sellerEmployeeId,
        lines: [...mains, ...extras].map((productId) => ({ productId, quantity: weighted(quantityChoices[productId]) })),
        discounted: random() < 0.1,
        method: weighted([['Cash', 62], ['GCash', 28], ['Bank Transfer', 3], ['Other', 7]]),
        tenderStep: weighted([[0, 25], [50, 20], [100, 25], [500, 20], [1000, 10]]),
        cancelAfter: index === cancelIndex ? between(15, 45) : null
      });
    });
  }

  events.sort((a, b) => a.at - b.at);

  // ---- Replay the timeline ----------------------------------------------------------------
  function receive(supplierId, time, { opening = false, frozen = false, onlyProducts = null } = {}) {
    const receiverId = opening || random() < 0.25 ? 2 : 5;
    const lines = products
      .filter((product) => product.supplier_id === supplierId && product.status !== 'Inactive')
      .filter((product) => !onlyProducts || onlyProducts.includes(product.id))
      .filter((product) => !(frozen && product.finalState))
      .map((product) => {
        const needed = milli(product.par) - stock.get(product.id);
        const unitCost = Math.round(product.cost_price * (0.95 + random() * 0.1));
        return { product, quantityMilli: Math.max(0, Math.floor(needed / 1000) * 1000), unitCostCents: cents(unitCost) };
      })
      .filter((line) => line.quantityMilli > 0);
    if (!lines.length) return;

    const id = tables.stock_receiving.length + 1;
    const totalCents = lines.reduce((sum, line) => sum + Math.round((line.unitCostCents * line.quantityMilli) / 1000), 0);
    tables.stock_receiving.push({
      id,
      receiving_number: nextNumber('REC', time),
      supplier_id: supplierId,
      received_by: userById.get(receiverId).employee_id,
      receiving_date: time,
      reference_number: `DR-${between(10000, 99999)}`,
      total_cost: money(totalCents),
      status: 'Completed',
      created_at: time,
      updated_at: time
    });
    for (const line of lines) {
      tables.stock_receiving_items.push({
        id: tables.stock_receiving_items.length + 1,
        receiving_id: id,
        product_id: line.product.id,
        quantity: quantity(line.quantityMilli),
        unit_cost: money(line.unitCostCents),
        subtotal: money(Math.round((line.unitCostCents * line.quantityMilli) / 1000)),
        created_at: time
      });
      log(line.product.id, receiverId, 'STOCK_RECEIVING', line.quantityMilli, 'STOCK_RECEIVING', id, null, time);
    }
  }

  function adjust(productId, changeMilli, userId, reason, time) {
    const allowed = Math.max(changeMilli, -stock.get(productId));
    if (allowed === 0) return;
    log(productId, userId, 'ADJUSTMENT', allowed, 'ADJUSTMENT', productId, reason, time);
  }

  function sell(event) {
    const lines = [];
    for (const line of event.lines) {
      const available = stock.get(line.productId);
      const wanted = milli(line.quantity);
      const sold = Math.min(wanted, line.productId === 5 ? Math.floor(available / 250) * 250 : Math.floor(available / 1000) * 1000);
      if (sold > 0) lines.push({ product: productById.get(line.productId), quantityMilli: sold });
    }
    if (!lines.length) return;

    const user = userByEmployee.get(event.employeeId);
    const subtotalCents = lines.reduce((sum, line) => sum + Math.round((cents(line.product.selling_price) * line.quantityMilli) / 1000), 0);
    const discountCents = event.discounted ? Math.round(subtotalCents * 0.2) : 0;
    const totalCents = subtotalCents - discountCents;
    const step = event.method === 'Cash' ? event.tenderStep * 100 : 0;
    const tenderedCents = step ? Math.ceil(totalCents / step) * step : totalCents;
    const id = tables.sales.length + 1;
    const time = event.at;

    tables.sales.push({
      id,
      sale_number: nextNumber('SAL', time),
      employee_id: event.employeeId,
      sale_date: time,
      subtotal: money(subtotalCents),
      discount: money(discountCents),
      total_amount: money(totalCents),
      sale_status: 'Completed',
      created_at: time,
      updated_at: time
    });
    for (const line of lines) {
      tables.sale_items.push({
        id: tables.sale_items.length + 1,
        sale_id: id,
        product_id: line.product.id,
        quantity: quantity(line.quantityMilli),
        unit_price: line.product.selling_price,
        subtotal: money(Math.round((cents(line.product.selling_price) * line.quantityMilli) / 1000)),
        created_at: time
      });
      log(line.product.id, user.id, 'SALE', -line.quantityMilli, 'SALE', id, null, time);
    }
    const reference = event.method === 'GCash' ? `${between(1000, 9999)}${between(100000000, 999999999)}`
      : event.method === 'Bank Transfer' ? `BT${between(10000000, 99999999)}`
      : event.method === 'Other' ? `MAYA-${between(100000, 999999)}` : null;
    tables.payments.push({
      id,
      sale_id: id,
      payment_date: time,
      amount: money(totalCents),
      amount_tendered: money(tenderedCents),
      change_amount: money(tenderedCents - totalCents),
      payment_method: event.method,
      reference_number: reference,
      payment_status: 'Paid',
      created_at: time,
      updated_at: time
    });

    if (event.cancelAfter) {
      const cancelledAt = new Date(time.getTime() + event.cancelAfter * MINUTE);
      const sale = tables.sales[tables.sales.length - 1];
      const payment = tables.payments[tables.payments.length - 1];
      sale.sale_status = 'Cancelled';
      sale.updated_at = cancelledAt;
      payment.payment_status = 'Cancelled';
      payment.updated_at = cancelledAt;
      for (const line of lines) {
        log(line.product.id, 2, 'SALE_CANCELLED', line.quantityMilli, 'SALE', id, 'Completed sale cancellation', cancelledAt);
      }
    }
  }

  for (const event of events) {
    if (event.at.getTime() > latestEventTime) continue;
    if (event.type === 'receiving') receive(event.supplierId, event.at, event);
    else if (event.type === 'adjustment') adjust(event.productId, milli(event.quantity), event.userId, event.reason, event.at);
    else sell(event);
  }

  // ---- Settle the closing stock picture -----------------------------------------------------
  const settleAt = new Date(Math.max(latestEventTime + 2 * MINUTE, dayStart(SIMULATED_DAYS - 1).getTime() + MINUTE));
  const needsTopUp = products.filter((product) => product.status !== 'Inactive' && !product.finalState && stock.get(product.id) <= milli(product.reorder_level * 1.3));
  for (const supplierId of new Set(needsTopUp.map((product) => product.supplier_id))) {
    receive(supplierId, settleAt, { onlyProducts: needsTopUp.filter((product) => product.supplier_id === supplierId).map((product) => product.id) });
  }
  const adjustAt = new Date(settleAt.getTime() + MINUTE);
  for (const product of products.filter((item) => item.finalState)) {
    const current = stock.get(product.id);
    if (product.finalState === 'out' && current > 0) {
      adjust(product.id, -current, 2, 'Dented and leaking cans written off', adjustAt);
    } else if (product.finalState === 'low') {
      const target = milli(Math.max(1, Math.floor(product.reorder_level / 2)));
      if (current === 0 || current > milli(product.reorder_level)) {
        adjust(product.id, target - current, 2, 'Physical count correction', adjustAt);
      }
    }
  }

  // ---- Finish master records --------------------------------------------------------------
  tables.products = products.map(({ supplier_id, par, finalState, ...product }) => ({
    ...product,
    status: product.status || 'Active',
    stock_quantity: quantity(stock.get(product.id)),
    created_at: masterCreatedAt,
    updated_at: masterCreatedAt
  }));
  const lastLogin = { 1: 90, 2: 240, 3: 25, 4: 1440 + 300, 5: 1440 * 2 + 120, 6: 1440 * 40 };
  for (const user of tables.users) {
    user.last_login = new Date(now.getTime() - lastLogin[user.id] * MINUTE);
  }

  return tables;
}
