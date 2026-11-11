# Mutya Licios Lechon Manok: Business Management System

Point of sale, inventory, suppliers, staff, and reporting for a lechon manok shop. Works on phones, tablets, and desktops.

**Live demo:** https://opallakevin745-sys.github.io/Regine-System/

## Demo accounts

| Role    | Username  | Password     |
| ------- | --------- | ------------ |
| Owner   | `admin`   | `admin123`   |
| Cashier | `cashier` | `cashier123` |
| Manager | `manager` | `manager123` |
| Staff   | `staff`   | `staff123`   |

The live demo runs entirely in the browser. It comes loaded with a month of sample activity (about 570 sales, 40 deliveries, stock adjustments, cancellations, and low/out-of-stock items), and changes are saved in that browser only. Use **Reset demo data** in the sidebar to start over.

## What each role can do

| Area                                      | Owner | Manager | Cashier   | Staff     |
| ----------------------------------------- | :---: | :-----: | :-------: | :-------: |
| Dashboard                                 |   ✓   |    ✓    | ✓ (own sales today) | ✓ |
| Point of sale, sales history, payments    |   ✓   |    ✓    |     ✓     |           |
| Cancel a completed sale                   |   ✓   |    ✓    |           |           |
| Products, categories, suppliers           | edit  |  edit   | view      | view      |
| Inventory (view, movement history)        |   ✓   |    ✓    |     ✓     |     ✓     |
| Inventory adjustments                     |   ✓   |    ✓    |           |           |
| Stock receiving                           |   ✓   |    ✓    |           |     ✓     |
| Employees, reports, audit trail           |   ✓   |    ✓    |           |           |
| User accounts                             |   ✓   |         |           |           |

The API enforces these rules; the interface only shows actions the signed-in role is allowed to use.

## Project structure

- `client/`: React 19 + Vite + React Router
  - `src/pages/`: one file per screen group (POS, sales, catalog, inventory, receiving, people, reports/audit)
  - `src/components/`: layout, shared UI (responsive tables, drawers), sales chart, receipt
  - `src/demo/`: sample-data generator and the in-browser API used by the GitHub Pages demo
  - `src/styles/app.css`: the single stylesheet
- `server/`: Express 5 REST API with MySQL (mysql2), JWT authentication
  - `database/schema.sql`: tables; `scripts/init-db.js` creates and upgrades them
  - `scripts/seed-owner.js`: Owner login; `scripts/seed-demo.js`: one month of sample data

## Run it locally with MySQL

1. Copy `.env.example` to `server/.env` and set `DB_PASSWORD`, `JWT_SECRET`, and `SEED_ADMIN_PASSWORD`.
2. Install dependencies: `npm install` then `npm run install:all`
3. Create or upgrade the schema: `npm run db:init`
4. Create the Owner login (`admin` with your `SEED_ADMIN_PASSWORD`): `npm run db:seed`
5. Optional sample data: `npm run db:demo`. This only runs on a database with no business records. It creates the `manager`, `cashier`, `cashier2`, and `staff` logins with the demo passwords above (set `SEED_DEMO_PASSWORD` to use one password for all of them instead). Change these passwords before real use.
6. Start the API and the client together: `npm run dev`

The API runs on http://localhost:5006 and the app on http://localhost:5180. The database name is `regineLechon`.

To run the browser-only demo locally instead: `npm run dev:demo --prefix client`

## Production (full stack)

`npm run build` builds the client into `client/dist`. Started with `NODE_ENV=production` (`npm start`), the API also serves that build, so one Node process hosts the whole system. Required environment: the database settings, `JWT_SECRET`, and `CLIENT_URL` (allowed CORS origin). `AUTH_BYPASS` must stay off; the server refuses to start in production with it enabled.

## GitHub Pages deployment

`.github/workflows/deploy-pages.yml` builds the demo (`npm run build:demo` with `VITE_DEMO_MODE=true`) and publishes it on every push to `main`. GitHub Pages only hosts static files, so the hosted demo cannot connect to MySQL. It uses the in-browser API in `client/src/demo/`, which mirrors the Express endpoints, validation, and role rules.
