# Database Setup

Create `server/.env` from the root `.env.example`, set `DB_PASSWORD`, `JWT_SECRET`, and `SEED_ADMIN_PASSWORD`, then run:

```powershell
npm run db:init   # create the schema, or upgrade an existing one in place
npm run db:seed   # Owner login: admin / SEED_ADMIN_PASSWORD
npm run db:demo   # optional: one month of sample data (empty databases only)
```

`schema.sql` creates eleven InnoDB tables in `regineLechon`:

- People: `employees`, `users` (one optional login per employee; roles Owner, Manager, Cashier, Staff)
- Catalog: `categories`, `products`, `suppliers`
- Sales: `sales`, `sale_items`, `payments` (`amount` is applied to the sale; `amount_tendered` and `change_amount` record the cash handed over and the change returned)
- Stock: `stock_receiving`, `stock_receiving_items`, `inventory_logs` (one row per stock movement: sale, cancellation, receiving, or adjustment)

Stock only changes through sales, cancellations, receiving, and adjustments, each in a single transaction with its inventory log. There is no customer table.
