# Mutya Licios Lechon Manok Business Management System

Internal business management foundation for the owner, manager, cashier, and authorized staff.

## Structure

- `server`: Express REST API, MySQL pool, JWT authentication, schema and seed scripts
- `client`: Vite React application shell with protected routing

## Setup

1. Copy `.env.example` to `server/.env` and configure the local MySQL credentials and secrets.
2. Install dependencies with `npm run install:all`.
3. Create the schema with `npm run db:init`.
4. Seed the owner account with `npm run db:seed`.
5. Start both applications with `npm run dev`.

The API runs on port `5006` and the client on port `5180` by default. The database name is `regineLechon`.

## Part 2 Operations

Part 2 adds authenticated modules for categories, products, sales, payments, inventory, suppliers, and stock receiving. Sales and receiving use MySQL transactions and create inventory logs for every stock movement.

The operational endpoints are available under:

- `/api/categories`
- `/api/products`
- `/api/sales`
- `/api/payments`
- `/api/inventory`
- `/api/suppliers`
- `/api/stock-receiving`

After configuring MySQL, rerun `npm run db:init` to create the final tables, then use `npm run db:seed` for the local Owner account. The owner seed password is configured through `SEED_ADMIN_PASSWORD` in the local server environment.

## Final Modules

Dashboard analytics, sales, products, categories, inventory, suppliers, stock receiving, payments, employees, Owner-only user accounts, reports, audit history, controlled inventory adjustments, and transactional sale cancellation are available. There is no customer module.

## Development Commands

```powershell
npm install
npm run install:all
npm run db:init
npm run db:seed
npm run dev
npm run build --prefix client
```
