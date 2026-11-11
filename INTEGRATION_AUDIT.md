# Regine-System Integration Audit

Audit performed 2026-09-26 against the checked-out workspace. This is an inspection artifact only: no application code, schema, or business data was changed. Verification used the current local environment, including its development authentication bypass; production configuration and role-specific live API behavior were not independently tested.

## A. Current Architecture

- Root: npm scripts; `client/`: React 19 + Vite 6 + React Router 7; `server/`: Node ESM + Express 5 + mysql2; database: MySQL/InnoDB.
- Browser routes are registered in `client/src/main.jsx`. `client/src/api.js` centralizes fetch, bearer token, JSON response parsing, and errors. There is no separate frontend service/hooks layer.
- Express mounts feature routers directly in `server/src/app.js`; `server/src/routes/index.js` only re-exports auth routes and is not used by the app.
- Defaults in `server/src/config/env.js`: API 5006, database `mutya_licios_lechon_manok`; `client/vite.config.js`: Vite 5180, proxy to 5006. Local `server/.env` overrides DB to `regineLechon`; schema and README also specify `regineLechon`.
- `client/.env.local` and `server/.env` both set their respective auth bypass flags to true. In that configuration the client fabricates an Owner identity and the API middleware fabricates Owner user id 1. This is not safe for a LAN-accessible run or production build/deployment.
- No customer table, page, route, or customer CRUD was found. Customer references are limited to docs stating the module is absent.

## B. Project File Structure

- `client/src/main.jsx`: route composition; `client/src/api.js`: HTTP helper.
- `client/src/context/AuthContext.jsx`; `client/src/components/ProtectedRoute.jsx`, `AppLayout.jsx`.
- Pages: `LoginPage.jsx`, `DashboardPage.jsx`, `OperationsPage.jsx` (categories/products/suppliers, inventory, sales, receiving, payments), `AdminPages.jsx` (employees/users/reports/audit).
- `server/src/app.js`, `server.js`, `config/`, `routes/`, `controllers/`, `services/`, `middleware/`, `utils/`.
- `server/database/schema.sql`; `server/scripts/init-db.js`, `seed-owner.js`.
- No test/spec files were found. `server/database/README.md` is stale: it says the schema creates only four tables, while the current schema creates eleven.

## C. Database Tables and Relationships

All tables use InnoDB, unsigned auto-increment primary keys, and `created_at` timestamps. Mutable master/transaction headers generally also have `updated_at`. There is no standalone audit-events table; `inventory_logs` is the stock movement ledger.

| Table                   | Key columns, constraints, indexes, relationships                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `employees`             | PK `id`; unique `employee_code`; first/last name, position, phone, hire_date, `status` Active/Inactive; indexes status and `(last_name, first_name)`; created/updated timestamps. Parent of `users`, `sales`, and receiving via `received_by`.                                                                                                               |
| `users`                 | PK `id`; unique FK `employee_id` → employees (delete restrict/update cascade); unique username; password_hash, role enum Owner/Manager/Cashier/Staff, status, last_login, created/updated; `(role,status)` index. Employee-to-user is one-to-zero-or-one.                                                                                                    |
| `categories`            | PK `id`; unique category_name; description, status, created/updated; status index. Parent of products.                                                                                                                                                                                                                                                       |
| `products`              | PK `id`; FK category_id → categories (delete restrict); unique product_code; product_name, description, unit, cost/selling price, stock_quantity, reorder_level, status, created/updated; category/status and stock/reorder indexes; checks prices and stock/reorder nonnegative. Parent of sale/receiving items and inventory logs.                         |
| `sales`                 | PK `id`; unique sale_number; FK employee_id → employees (delete restrict); sale_date, subtotal, discount, total_amount, sale_status Completed/Pending/Cancelled, created/updated; date/status index; totals check. Header for sale_items and payments.                                                                                                       |
| `sale_items`            | PK `id`; FKs sale_id → sales (delete cascade), product_id → products (delete restrict); quantity, unit_price, subtotal, created_at; indexes by sale and product; positive quantity/nonnegative amounts checks. No unique `(sale_id, product_id)` constraint.                                                                                                 |
| `payments`              | PK `id`; unique FK sale_id → sales (delete cascade); payment_date, amount, payment_method enum Cash/GCash/Bank Transfer/Other, reference_number, payment_status Paid/Pending/Cancelled/Refunded, created/updated; date/status index; amount nonnegative check. One payment row per sale.                                                                     |
| `suppliers`             | PK `id`; unique supplier_code; name/contact/phone/address/status, created/updated; `(status,supplier_name)` index. Parent of receiving headers.                                                                                                                                                                                                              |
| `stock_receiving`       | PK `id`; unique receiving_number; FKs supplier_id → suppliers and received_by → employees (delete restrict); date/reference/total_cost/status Completed/Cancelled, created/updated; date/status index; total-cost check. Header for receiving items.                                                                                                         |
| `stock_receiving_items` | PK `id`; FKs receiving_id → stock_receiving (delete cascade), product_id → products (delete restrict); quantity, unit_cost, subtotal, created_at; indexes by receiving and product; positive quantity/nonnegative cost checks. No unique `(receiving_id, product_id)` constraint.                                                                            |
| `inventory_logs`        | PK `id` BIGINT; FKs product_id → products and user_id → users (delete restrict); transaction_type enum STOCK_RECEIVING/SALE/SALE_CANCELLED/ADJUSTMENT, signed quantity, previous_stock/new_stock, reference_type/reference_id, reason, created_at; indexes `(product_id,created_at)` and `(reference_type,reference_id)`. No FK on polymorphic reference_id. |

Master data owners are `employees`, `categories`, `products`, and `suppliers`; dependent account/catalog/transaction rows reference them. `sales`, `sale_items`, `payments`, `stock_receiving`, and `stock_receiving_items` are business transaction records. `inventory_logs` is historical stock history. Transactions and logs should not be directly edited/deleted after posting; current API offers no delete routes, and restrictive FKs protect history. Products/category/supplier/employee/user master records are deactivated rather than deleted through current UI/API.

Relationship map:

```text
employees ──< users ──< inventory_logs >── products >── categories
    │                    ▲                     │
    ├──< sales ──< sale_items >────────────────┤
    │      └── 0/1 payments                    │
    └──< stock_receiving >── suppliers          │
              └──< stock_receiving_items >──────┘
```

## D. Frontend Pages

Every listed operational page calls the shared API helper and consumes the standard `{ success, data }` response unless noted. All routes except `/login` are wrapped in authentication-only `ProtectedRoute`; route registration itself does not enforce roles.

| Page/route                                                 | API and database                                                                                                    | Roles shown in sidebar | Main actions and states                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login `/login`                                             | POST `/auth/login`; users/employees                                                                                 | Public                 | Username/password, show/hide password, submitting/error; redirects to prior route or dashboard.                                                                     |
| Dashboard `/dashboard`                                     | GET `/dashboard/summary`; sales/items/products/employees                                                            | All roles              | Live metric cards, 7-day chart, low stock, top products, recent sales; loading and error, empty-state lists.                                                        |
| Categories `/categories`                                   | GET/POST/PUT/PATCH `/categories`; categories                                                                        | All roles              | Search, create/edit/activate/deactivate; loading/error/success/empty.                                                                                               |
| Products `/products`                                       | GET/POST/PUT/PATCH `/products`, GET `/categories?status=Active`; products/categories                                | All roles              | Search, category dropdown, create/edit/activate/deactivate; live list and stock. Category status filter is ignored by backend.                                      |
| Inventory `/inventory`                                     | GET `/inventory`, GET `/inventory/:id/logs`; products/categories/logs/users/employees                               | All roles              | Stock list and per-product history; error/empty. No adjustment form/action.                                                                                         |
| Sales `/sales`, `/sales/new`, `/sales/:id`                 | GET/POST `/sales`, GET `/products?status=Active`, GET/PATCH `/sales/:id/cancel`; sales/items/payments/products/logs | Owner/Manager/Cashier  | POS cart, quantity, discount, payment method/amount, complete; history/detail/cancel; success/error/empty. No pagination/filter controls despite API query options. |
| Payments `/payments`                                       | GET `/payments`; payments/sales                                                                                     | Owner/Manager/Cashier  | Read-only payment list; error/empty.                                                                                                                                |
| Suppliers `/suppliers`                                     | GET/POST/PUT/PATCH `/suppliers`; suppliers                                                                          | All roles              | Search, create/edit/activate/deactivate; loading/error/success/empty.                                                                                               |
| Stock receiving `/stock-receiving`, `/stock-receiving/new` | GET/POST `/stock-receiving`, GET `/suppliers`, GET `/products`; receiving/items/products/logs                       | Owner/Manager/Staff    | Supplier/product selection, quantities/costs, total, complete, recent history; error/success/empty. History has no detail link.                                     |
| Employees `/employees`                                     | GET/POST/PUT/PATCH `/employees`; employees/users                                                                    | Owner/Manager          | Search is not exposed; add/edit/deactivate/activate; loading is implicit, error/success/empty.                                                                      |
| Users `/users`                                             | GET/POST/PATCH `/users`, GET `/employees?status=Active`; users/employees                                            | Owner only             | Create account, role selection (Manager/Cashier/Staff), activate/deactivate; no edit-role or reset-password UI.                                                     |
| Reports `/reports`                                         | GET `/reports/{sales,product-sales,inventory,stock-receiving,payments,suppliers}`; corresponding source tables      | Owner/Manager          | Report type/date range/apply, totals and dynamic table; loading/error/empty. Some report handlers ignore submitted dates.                                           |
| Audit `/audit`                                             | GET `/audit`; inventory_logs/products/users/employees                                                               | Owner/Manager          | Stock movement ledger; error/empty. UI does not expose the API's product/type filters.                                                                              |

## E. Backend API Routes

All success bodies use `{ success: true, message?, data? }`; errors use `{ success: false, message }`. Authentication failures are 401, role failures 403, validation 400, not found 404, uniqueness/reference conflicts 409, unexpected errors 500. There is no pagination envelope; list endpoints cap some results in SQL and others are unbounded.

| Module / endpoint                                                                                         | Auth and roles                                                  | Handler / data effect                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health `GET /api/health`                                                                                  | Public                                                          | `app.js`; SELECT 1; 200 even if DB unavailable, data.database says connected/unavailable.                                                                                                      |
| Auth `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`                                  | Login public; me/logout JWT                                     | `auth.controller`; users/employees. Logout only returns success; client discards token.                                                                                                        |
| Categories `GET /api/categories`, `GET /:id`                                                              | Any authenticated role                                          | Read categories. `POST /`, `PUT /:id`, `PATCH /:id/status` Owner/Manager; create/update/status categories. List recognizes search, not status.                                                 |
| Products `GET /api/products`, `GET /:id`                                                                  | Any authenticated role                                          | Read products/categories. `POST /`, `PUT /:id`, `PATCH /:id/status` Owner/Manager; product master writes; no stock editing.                                                                    |
| Employees `GET /api/employees`, `GET /:id`                                                                | Any authenticated role                                          | Read employees and linked user identity/role. `POST /`, `PUT /:id`, `PATCH /:id/status` Owner/Manager; employee status uses transaction and deactivates linked user on employee deactivation.  |
| Users `GET /api/users`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id/status`, `POST /:id/reset-password` | Owner only for all                                              | `user.controller`; users/employees; password bcrypt hash. Owner account protected.                                                                                                             |
| Suppliers `GET /api/suppliers`, `GET /:id`                                                                | Any authenticated role                                          | Read suppliers. `POST /`, `PUT /:id`, `PATCH /:id/status` Owner/Manager; supplier master writes. List recognizes search, not status.                                                           |
| Inventory `GET /api/inventory`, `GET /low-stock`, `GET /:productId/logs`, `GET /:productId`               | Any authenticated role                                          | Read product stock/status and ledger. Route order places `/low-stock` and `/:productId/logs` before `/:productId`; no observed conflict.                                                       |
| Adjustment `POST /api/inventory/adjustments/`                                                             | Owner/Manager                                                   | `adjustment.routes` → `adjustInventory`; products/logs. Mounted before `/api/inventory`; no conflict with GET inventory routes.                                                                |
| Sales `GET /api/sales`, `GET /:id`, `POST /`, `PATCH /:id/cancel`, `PATCH /:id/status`                    | Reads/create Owner/Manager/Cashier; cancel/status Owner/Manager | `sales.controller` and `sales.service`/`inventory.service`; sales/items/payments/products/logs. List supports status/from/to/search, caps 200. Generic status endpoint has no frontend caller. |
| Payments `GET /api/payments`                                                                              | Owner/Manager/Cashier                                           | Read payments/sales, cap 200. Payment creation occurs only inside sale service; there is no standalone create/update route.                                                                    |
| Receiving `GET /api/stock-receiving`, `GET /:id`, `POST /`                                                | Owner/Manager/Staff                                             | `stock-receiving.controller` and service; receiving/items/suppliers/employees/products/logs; list caps 200.                                                                                    |
| Dashboard `GET /api/dashboard/summary`                                                                    | Any authenticated role                                          | `dashboard.controller`; sales/items/products/employees; summary/chart/top/low/recent data.                                                                                                     |
| Reports `GET /api/reports/{sales,product-sales,inventory,stock-receiving,payments,suppliers}`             | Owner/Manager                                                   | `report.controller`; source tables listed in section O; report outputs rows and optional summary.                                                                                              |
| Audit `GET /api/audit`                                                                                    | Owner/Manager                                                   | `audit.controller`; logs/products/users/employees; filters product_id/transaction_type; cap 1000.                                                                                              |

No client/backend path mismatch was found for endpoints the UI currently calls. Backend-only endpoints include employee/user detail, user PUT/reset-password, generic sale status, inventory low-stock/product, receiving detail, and inventory adjustment. These are not necessarily broken, but they are not exposed by the current UI.

## F. Authentication and Authorization Flow

```text
LoginPage → AuthContext.login → POST /api/auth/login
  → validate username/password, bcrypt compare, update last_login
  → sign JWT { userId, username, role }, expires in 8h; return public user
  → store mutya_token in localStorage; set React user
  → ProtectedRoute checks user; AppLayout filters sidebar by role
  → apiRequest attaches Bearer token
  → authenticateToken verifies signature/expiry → authorizeRoles where declared
  → controllers/services → MySQL → JSON response → page state/load()
```

On refresh, AuthProvider calls `/auth/me`; inactive/missing user makes it clear the token, and protected routes redirect to login. Normal logout calls `/auth/logout` then removes the local token; there is no server-side revocation. A role change/deactivation does not invalidate an already issued JWT in `authenticateToken`; protected APIs can still accept that token for up to eight hours because the middleware only verifies JWT claims. `/me` checks active status only at initial app hydration. An API 401 during an already-open session does not globally clear auth state. This can leave stale UI identity and repeated 401s, not a random successful logout.

The client dev bypass and server `AUTH_BYPASS` are separate switches. Both are true in current local files. The server bypass hardcodes `userId: 1, role: Owner`, skipping token verification. Production must never enable it; Vite's `VITE_AUTH_BYPASS` is compiled into client JS.

## G. Frontend → API Connections

- `apiRequest()` prefixes `VITE_API_URL` or `/api`, sends JSON and optional bearer token, parses JSON, throws the server `message` on non-2xx. In dev Vite proxies `/api` to port 5006; local `client/.env.example` uses `http://localhost:5006/api`.
- Existing feature pages use real requests and backend-matching routes. Response dereferences such as `response.data.products`, `response.data.sale`, and `response.data.logs` match controller response envelopes.
- Status writes refresh the relevant list by calling `load()` in categories/products/suppliers/employees/users. Sale creation reloads sales/products; receiving reloads receiving/products/suppliers; cancellation reloads only the detail response.
- Adjustment API is not connected to any frontend control/page. Payments and audit are read-only. User reset/edit APIs are not connected to UI controls.
- No mock business arrays/statistics were found in `client/src`. The dashboard's numeric values come from SQL. Static card/report-option arrays and payment options are UI configuration, not records.

## H. API → Database Connections

- Auth/login/me: `users` joined to `employees`; bcrypt hash and `last_login`.
- Categories/products/suppliers/employees/users CRUD: corresponding master tables; products join categories; employees/users join by employee_id.
- Sales: `sales`, `sale_items`, `payments`, `products`, `inventory_logs`, `employees`, `users`.
- Receiving: `stock_receiving`, `stock_receiving_items`, `suppliers`, `employees`, `products`, `inventory_logs`, `users`.
- Inventory/adjustment/audit: product stock plus `inventory_logs`; users/employees supply actor identity.
- Dashboard and reports query transaction/master tables directly through controllers; no separate reporting service or cache.
- SQL response identifiers/fields consistently use schema snake_case except deliberate aliases (employee_name, is_low_stock, totalTransactions, etc.); the frontend uses these same fields. MySQL DECIMAL values may arrive as strings; UI numeric formatting uses Number where required.

## I. Inventory Data Flow

`GET /api/inventory` derives status from `products.stock_quantity` and `reorder_level`; it is a live query. Stock writes occur only in sale, cancellation, receiving, and adjustment service transactions. Each flow updates product stock and inserts one inventory_logs row per affected product. UI history joins actor and employee for `performed_by`. No direct stock-edit field exists in product CRUD.

## J. Sales Data Flow

`SalesPage` submits product IDs, quantities, discount, and payment method/amount. `createSale` begins transaction, requires an active user-to-employee link, groups duplicate items, locks active products in sorted order, checks available stock, computes cents-based totals, validates discount and payment >= total, inserts sale and items, decrements stock conditionally, inserts SALE logs, inserts one Paid payment (tender amount, including any change), then commits. Any error rolls back all writes. UI reloads the sales list after success; navigating to other pages remounts/fetches their data, but there is no global invalidation or polling.

## K. Sale Cancellation Data Flow

Owner/Manager `PATCH /api/sales/:id/cancel` calls `cancelSale`: transaction locks sale, requires status Completed, locks its items/products, restores each quantity, inserts SALE_CANCELLED logs, sets sale Cancelled and payment Cancelled, then commits. A repeated cancellation fails with 409 before stock changes, and rollback covers the full sequence. It does not issue a refund record or change payment amount; payment status is only Cancelled. Sale detail fetches after cancellation; sales list/dashboard/payments are not proactively invalidated in shared state.

## L. Stock Receiving Data Flow

Owner/Manager/Staff POST receiving validates active supplier, active logged-in employee, nonempty unique product rows, positive quantities, nonnegative costs, and active products. Transaction locks supplier and products, records receiving header/items and total, increments product stock, writes STOCK_RECEIVING logs with actor/reference, then commits; failures rollback. Frontend computes displayed total but server recomputes it. Current UI sends no optional reference_number. Receiving unit_cost is stored on item/header but is not copied to `products.cost_price`; the inventory valuation report therefore uses the product master cost, not the latest receiving cost. Receiving list refreshes on success, but history rows have no detail/action link even though GET `/:id` exists.

## M. Inventory Adjustment Data Flow

Owner/Manager `POST /api/inventory/adjustments/` accepts product_id, signed quantity, reason. Service rejects zero/non-finite amounts and blank reason, locks product, rejects negative resulting stock, updates stock and writes ADJUSTMENT log in one transaction with user ID, product ID as reference_id, and reason. Any nonblank free-text reason is allowed; service does not require product Active. There is no adjustment UI, so API is currently the only entry point. Route mounting and ordering are safe: adjustment router is mounted separately before inventory's GET router.

## N. Dashboard Data Flow

`GET /api/dashboard/summary` queries: today's completed sales and count from `sales`; total active products, low-stock (positive stock only), out-of-stock from `products`; active employee count from `employees`; last seven days sales/transactions/average and chart from `sales`; all-time top products from `sale_items` + completed `sales` + `products`; low stock list from products; last eight sales from sales/employees (includes any statuses). Frontend keys align with response. No KPI values are hardcoded. Chart query returns only dates with sales, not zero-filled days.

## O. Reports Data Flow

| Report          | Query sources and filters                                                                                          | Actual behavior / gap                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sales           | sales + employees; date_from/date_to, optional status/employee_id; rows max 1000; summary count/gross/discount/net | Date controls work. With no status, summary counts completed sales while rows include all statuses. With status specified, summary follows that status. |
| Product sales   | sale_items + sales + products; completed only; date_from/date_to; optional sort=revenue                            | Date controls work; rows quantity and revenue; no summary.                                                                                              |
| Inventory       | products + categories                                                                                              | Current stock/cost valuation; no date filter implemented, though shared UI sends dates.                                                                 |
| Stock receiving | receiving + supplier + employee; date_from/date_to, supplier_id; rows max 1000, total cost summary                 | Date controls work; page has no supplier selector, only date range.                                                                                     |
| Payments        | payments + sales; date_from/date_to, payment_method, status; rows max 1000, totals by method                       | Date controls work; page exposes only date range. Totals aggregate recorded tender amounts, including canceled/refunded rows unless filtered.           |
| Suppliers       | suppliers LEFT JOIN receiving; count/cost/last date                                                                | No date filter implemented, despite shared UI sending dates.                                                                                            |

Report response mapping is consistent: handlers return `data.rows` and, where supported, `data.summary`; UI uses dynamic row columns. Summary formatting treats every numeric summary value as currency, so Sales `totalTransactions` is rendered as a peso amount. Inventory/supplier date fields are misleading because queries ignore them.

## P. Audit Log Data Flow

`inventory_logs` captures transaction type, signed quantity, before/after stock, product, user, reference type/id, reason where supplied, and timestamp. SALE and STOCK_RECEIVING record actor and transaction references but no reason. SALE_CANCELLED records the actor/reason and original sale reference. ADJUSTMENT records actor/reason but uses product ID as reference_id, not a separate adjustment record. `GET /api/audit` joins products/users/employees and returns actor name, filters product/type, maximum 1000. There is no generic audit log for master-data edits, account changes, login/logout, or payment updates; those actions are either not audited or do not exist.

## Q. Hardcoded/Mock Data Found

- No fake product, sale, inventory, report, or dashboard datasets were found in `client/src`.
- `client/src/context/AuthContext.jsx`: fixed `devUser` Owner identity is used only when `VITE_AUTH_BYPASS=true`; current `client/.env.local` enables it.
- `server/src/middleware/auth.js`: bypass claims userId 1 / admin / Owner when `AUTH_BYPASS=true`; current `server/.env` enables it.
- Dashboard card labels/tone keys, report options, supported payment methods, and display label “Real database data” are static UI definitions/labels, not fake metrics.

## R. Broken or Missing Connections

- No API URL/HTTP-method mismatch was found for current UI callers.
- Missing UI connection: inventory adjustment endpoint; receiving detail endpoint; user edit-role/reset-password endpoints; employee search filters; audit filters.
- Category dropdown calls `/categories?status=Active`, but category list ignores status, so inactive categories appear and create/update rejects them server-side.
- Report page sends from/to for every report, while Inventory and Suppliers ignore those query values.
- `PaymentsPage` shows status but always assigns CSS class `paid`; cancelled/refunded rows may be styled as paid.
- Generic sale status endpoint can change non-completed sale status without coordinating payment/inventory; there is no frontend caller. Completed-sale cancellation uses the separate correct reversing workflow.
- No 404/401/403/409/500 was observed in the successful local health/build/dashboard checks; no exhaustive CRUD/error case suite exists.

## S. Field/Response Mismatches

- Main response envelope matches: API helper returns full JSON; pages access `.data.{resource}`.
- Schema SQL columns and most UI form/list fields agree in snake_case. Intentional aliases include `employee_name`, `received_by_name`, `is_low_stock`, `stock_status`, and camelCase dashboard/report summary keys; callers match them.
- Category status query mismatch: UI sends `status=Active`; backend ignores it.
- Sales list query parameters are `from`/`to`; reports use `date_from`/`date_to`; respective frontends currently use no sales list filters and correctly use report names.
- Received-list UI displays receiving_number/supplier_name/receiving_date/total_cost which match backend fields, though ignores received_by_name/status/reference_number.
- Numeric summary formatter bug: totalTransactions is treated as money. DECIMAL fields can be strings; current display code generally converts amounts using Number.
- `server/src/config/env.js` default DB is `mutya_licios_lechon_manok`, unlike schema/docs `regineLechon`; checked local env overrides correctly. Fresh installs relying on defaults can target the wrong database.
- Receiving unit_cost and product cost_price are distinct; report inventory valuation reads cost_price, not latest receiving cost.

## T. Role/Permission Mismatches

- Backend is the security boundary for writes and sensitive modules; sidebar filtering is not a route guard. All non-login React routes are only authentication-protected.
- Owner: all modules; user API Owner-only; reports/audit, employee writes, catalog/supplier writes, sale cancel, adjustment allowed.
- Manager: same operational modules except User Accounts; reports/audit, employee/catalog/supplier writes, sale cancel, adjustment allowed.
- Cashier: Dashboard, Sales, Payments in sidebar; backend additionally permits authenticated reads of categories/products/suppliers/inventory/employees/dashboard, but denies their writes and reports/audit/user access. Direct page URLs can still mount pages where backend GET access is broad; `/employees` direct access exposes employee records to any authenticated user despite hidden sidebar link.
- Staff: Dashboard, Products, Categories, Inventory, Suppliers, Stock Receiving; backend allows receiving, read access to those modules, but denies catalog/supplier writes. Some visible staff pages therefore have read-only lists plus forms that fail 403.
- The UI hides Employees/Reports/Audit for Cashier/Staff and User Accounts for all but Owner, but `main.jsx` does not enforce role access at route level. `UserPage` has a UI role check; all other access relies on API authorization. Exact intended role policy was not defined beyond implementation, so the sidebar/backend gaps are recorded rather than changing permissions.
- Employee deactivation deactivates linked user; reactivating the employee does not reactivate the user account. An existing JWT is not invalidated at middleware; user status is not checked on normal API requests.

## U. Data Refresh Problems

- CRUD modules reload their local list after save/status update. Sale creation reloads sales/products; receiving creation reloads receiving/suppliers/products.
- Cancellation only reloads current sale detail; no shared cache/event refreshes dashboards, payments, sales lists, or report state. Navigating away and back fetches fresh data because each page mounts.
- Inventory adjustment currently has no UI; if called externally, open inventory/dashboard pages do not refresh.
- Dashboard, reports, inventory, payments, and audit fetch once on mount; no polling or global invalidation. This is adequate after navigation but stale if left open in another tab/session while another user changes data.
- CRUD create success reloads without awaiting it, and list-load failures are caught locally; no optimistic update or shared refresh mechanism.

## V. Transaction/Consistency Problems

- Sale, cancellation, receiving, and adjustment use begin/commit/rollback with `finally` release and row locks. Employee status update also transacts its employee/user changes. No transaction boundaries are needed for single-table master CRUD.
- Sale enforces stock, creates header/items/payment/logs atomically. Cancel is locked/idempotent by sale status and updates sale/payment plus stock/logs atomically. Receiving and adjustment are also atomic and enforce nonnegative final stock.
- Potential remaining policy/data issues: cancellation marks payment Cancelled but no refund/Refunded event or money movement exists; receiving does not update product.cost_price while inventory valuation uses it; generic sale status endpoint can change Pending/Cancelled independently of payment/logs; no idempotency key is used for duplicate POST retry, though generated unique transaction numbers limit collisions.
- There is no delete API for historical transaction records; FK restrictions preserve references.

## W. Master Integration Matrix

Legend: ✓ verified; Partial means some API/UI actions or refresh/authorization behavior is missing; N/A means no multi-table transaction requirement.

| Module     | Frontend                         | API | DB  | Auth/roles                                             | Transaction                  | Refresh                                     | Overall                          |
| ---------- | -------------------------------- | --- | --- | ------------------------------------------------------ | ---------------------------- | ------------------------------------------- | -------------------------------- |
| Auth       | ✓                                | ✓   | ✓   | Partial (bypass + stale JWT)                           | N/A                          | ✓ initial `/me`                             | Partial                          |
| Dashboard  | ✓                                | ✓   | ✓   | ✓ authenticated                                        | N/A                          | Partial, mount only                         | Partial                          |
| Employees  | ✓                                | ✓   | ✓   | Partial (GET broad; route hidden only)                 | ✓ status update              | ✓ local CRUD                                | Partial                          |
| Users      | Partial (no edit/reset UI)       | ✓   | ✓   | ✓ Owner API                                            | N/A/single row               | ✓ create/status                             | Partial                          |
| Categories | ✓                                | ✓   | ✓   | Partial (write roles enforced)                         | N/A                          | ✓                                           | Partial (status filter mismatch) |
| Products   | ✓                                | ✓   | ✓   | Partial (write roles enforced)                         | N/A                          | ✓                                           | ✓                                |
| Suppliers  | ✓                                | ✓   | ✓   | Partial (write roles enforced)                         | N/A                          | ✓                                           | ✓                                |
| Receiving  | Partial (no detail/history view) | ✓   | ✓   | ✓ route roles                                          | ✓ atomic                     | Partial (local only)                        | Partial                          |
| Inventory  | Partial (no adjustment UI)       | ✓   | ✓   | Partial (all authenticated read; adjust Owner/Manager) | ✓ adjustment service         | Partial                                     | Partial                          |
| Sales      | ✓                                | ✓   | ✓   | ✓ Owner/Manager/Cashier; cancel restricted             | ✓ atomic                     | Partial cross-page                          | Partial                          |
| Payments   | Partial (read-only)              | ✓   | ✓   | ✓ Owner/Manager/Cashier                                | Included in sale transaction | Partial mount only                          | Partial                          |
| Reports    | ✓                                | ✓   | ✓   | ✓ Owner/Manager                                        | N/A                          | Partial (date filters ignored in 2 reports) | Partial                          |
| Audit      | Partial (no filters)             | ✓   | ✓   | ✓ Owner/Manager                                        | N/A                          | Partial mount only                          | Partial                          |

## X. Recommended Integration Order

1. Disable and guard both auth bypasses outside explicitly isolated local development; add active-user/role revalidation for existing JWTs.
2. Confirm the canonical DB name/default and environment setup; correct stale database documentation. Do not run init/seed on an existing business database without an explicit backup/review.
3. Resolve role policy as a matrix, enforce sensitive page access at route level, and align read API permissions/navigation with that policy.
4. Complete missing UI flows (adjustment, receiving detail, user edit/reset, audit filters) only after confirming intended workflows and role policy.
5. Fix category status and report filter contract mismatches; correct payment status styling and report summary formatting.
6. Agree how receiving cost affects product valuation, and whether canceled sales require refunds; model those decisions without editing historical transaction rows.
7. Add transaction/API tests for rollback, stock locking, duplicate cancellation, role restrictions, response mapping, and cross-module refresh; add shared invalidation or refetch on navigation/focus if concurrent use requires it.

## READY FOR PART 2

Prioritized findings. These are recommendations only; no fixes were implemented.

### 1. Critical integration problems

- **Authentication bypass active.** Files: `client/.env.local`, `client/src/context/AuthContext.jsx`, `server/.env`, `server/src/middleware/auth.js`, `client/vite.config.js`. Current behavior: local client supplies Owner without login and API accepts every request as Owner/user 1; Vite binds LAN interfaces. Expected: bypass disabled except isolated development and never enabled in deployed build/server. Root cause: independent flags explicitly enabled and server does not prohibit bypass in production. Affected: every module/API. Database impact: unauthenticated LAN callers can read/change any data allowed to Owner. Recommended: disable current flags before normal operation, fail startup/build on production bypass, bind dev services to loopback when bypassing, and verify deployment artifacts.
- **Stale JWT after account deactivation/role change.** Files: `server/src/middleware/auth.js`, `server/src/controllers/auth.controller.js`, `server/src/controllers/employee.controller.js`, `server/src/controllers/user.controller.js`. Current behavior: JWT claims remain trusted up to eight hours; normal request middleware does not verify current user status/role. Expected: inactive/downgraded account loses access immediately or within an explicitly accepted short window. Root cause: authorization trusts only signed claims; `/me` rechecks only during initial hydration. Affected: all authenticated APIs. Database impact: an inactive user's existing token can continue changing/querying business data. Recommended: revalidate active status/role in auth middleware or implement revocation/versioning and test deactivation in a live session.

### 2. High-priority integration problems

- **Role visibility is not route protection and read permissions exceed sidebar policy.** Files: `client/src/main.jsx`, `client/src/components/AppLayout.jsx`, `server/src/routes/employee.routes.js`, plus category/product/supplier/inventory routes. Current behavior: every module route requires only any user; sidebar is cosmetic, and employee GET is open to every authenticated role although page link is hidden for Cashier/Staff. Staff sees some catalog CRUD forms that backend rejects with 403. Expected: route/navigation and API permissions agree with an approved matrix. Root cause: role filtering exists only in sidebar while selected backend GET routes intentionally/implicitly allow all authenticated users. Affected: employee privacy and all role-specific pages. Database impact: authenticated read exposure; no bypass of protected writes where server authorizeRoles exists. Recommended: approve the intended matrix, add frontend role guards for UX, and enforce matching read/write roles in backend.
- **Inventory adjustment has no UI and therefore no normal operator connection.** Files: `server/src/routes/adjustment.routes.js`, `server/src/services/inventory.service.js`, `client/src/pages/OperationsPage.jsx`. Current behavior: Owner/Manager API can adjust stock and write logs, but no page action invokes it. Expected: authorized adjustment workflow with product/reason/quantity and fresh stock/history. Root cause: backend module is implemented without a frontend connection. Affected: inventory/audit/dashboard/reports. Database impact: no UI-driven adjustment rows; external API use remains atomic. Recommended: add a controlled UI and refresh inventory/dashboard after success.
- **Report date filters are silently ignored by two report types.** Files: `client/src/pages/AdminPages.jsx`, `server/src/controllers/report.controller.js`. Current behavior: the page sends date_from/date_to for all report selections; inventory and supplier handlers ignore them. Expected: filter changes either affect query or controls are disabled/removed for unsupported reports. Root cause: shared controls broader than handler query implementation. Affected: reports. Database impact: none; users can misinterpret unfiltered current/all-time data. Recommended: implement supplier receiving date constraints; explicitly make inventory report as-of-now and indicate date filters do not apply.
- **Category Active filter is ignored.** Files: `client/src/pages/OperationsPage.jsx`, `server/src/controllers/category.controller.js`. Current behavior: product form requests active categories but receives active and inactive; server then rejects inactive category on save. Expected: dropdown shows valid active categories only. Root cause: listCategories supports search only, not status. Affected: product create/edit. Database impact: no invalid write; avoidable 400 errors. Recommended: implement status query support or use a dedicated filtered lookup.
- **Database default contradicts schema/docs.** Files: `server/src/config/env.js`, `server/database/schema.sql`, `.env.example`, `README.md`. Current behavior: no-env default points to `mutya_licios_lechon_manok`, while schema/docs name `regineLechon`; current local env override works. Expected: one documented canonical name. Root cause: stale config default. Affected: startup/init/seed/deployment. Database impact: wrong DB connection or apparent empty/wrong database if override omitted. Recommended: align default and keep an explicit migration/setup review before initialization.

### 3. Medium-priority integration problems

- **Cross-page data is not proactively refreshed.** Files: `client/src/pages/OperationsPage.jsx`, `client/src/pages/DashboardPage.jsx`, `client/src/pages/AdminPages.jsx`. Current behavior: local lists reload after some actions; cancellation refreshes detail only; other mounted pages/tabs remain stale. Expected: affected dashboard, inventory, sales, payment, audit, and reports reflect completed/canceled transactions. Root cause: independent mount-time fetches and no shared invalidation/polling. Affected: receiving/sales/cancel/adjustment and consumers. Database impact: DB is correct; UI may display old values until remount/reload. Recommended: targeted shared invalidation or refetch-on-focus/navigation, with tests for each transaction.
- **Receiving cost and inventory valuation disagree.** Files: `server/src/services/stock-receiving.service.js`, `server/src/controllers/report.controller.js`, `server/database/schema.sql`. Current behavior: receipt cost is stored in item rows but product.cost_price is unchanged; inventory report values quantity × product master cost. Expected: explicitly chosen valuation (latest, weighted average, or master maintained separately). Root cause: receiving and valuation use distinct fields without a documented policy. Affected: receiving/inventory report. Database impact: displayed inventory value may not represent recorded purchase costs. Recommended: agree on valuation semantics and report based on the chosen source; preserve receipt history.
- **Summary/status display inaccuracies.** Files: `client/src/pages/AdminPages.jsx`, `client/src/pages/OperationsPage.jsx`. Current behavior: report totalTransactions gets currency formatting; Payments always styles every status as paid. Expected: counts display as counts and payment styling follows actual status. Root cause: generic formatter/static CSS class. Affected: reports/payments presentation. Database impact: none, but interpretation can be wrong. Recommended: format by known field/type and derive status class.
- **History/report transactions lack filters or detail affordances.** Files: `client/src/pages/OperationsPage.jsx`, `client/src/pages/AdminPages.jsx`. Current behavior: receiving detail, audit filters, employee search, and sales list filters available server-side (some) but not in UI. Expected: expose useful supported filters/details where required. Root cause: backend endpoints/options exceed UI coverage. Affected: operations and audit usability. Database impact: none. Recommended: scope controls against actual business workflow.

### 4. Low-priority cleanup

- **Database README describes an obsolete four-table schema.** File: `server/database/README.md`. Current behavior: says only employees/users/categories/products are created while current schema defines eleven. Expected: setup docs enumerate current schema and no customer module. Root cause: stale Part 1 documentation. Affected: setup/audit. Database impact: operators may wrongly assume schema is incomplete. Recommended: update docs alongside the next integration change.
- **No automated tests exist.** Files: root/client/server package manifests; no test/spec files found. Current behavior: build, syntax parse, health are the available checks. Expected: repeatable API/service tests for transaction and permission invariants. Root cause: test suite not established. Affected: all future integration work. Database impact: regressions could alter stock/payments/history. Recommended: add isolated test database/service tests before broad changes; never point tests at the operational DB.
- **Logout is local-only and open sessions do not centrally handle 401.** Files: `client/src/context/AuthContext.jsx`, `client/src/api.js`, `server/src/controllers/auth.controller.js`. Current behavior: logout does not revoke JWT; an expired request can fail while UI still shows user until a full refresh. Expected: defined token revocation/session-expiry UX. Root cause: stateless JWT with client-only logout and no global 401 handler. Affected: session UX/security if token is stolen. Database impact: no direct mutation. Recommended: decide whether eight-hour bearer validity is acceptable; add revocation/central 401 handling if required.

Verification: frontend production build passed (Vite 6.4.3); 42 backend JS files passed `node --check`; `/api/health` returned database `connected`; dashboard loaded real zero-sales/one-active-employee metrics. No tests exist. Both dev servers were stopped after verification because auth bypass was enabled and Vite exposed LAN addresses. No DB init, seed, or write endpoint was run.

READY FOR PART 2
