# Database Setup

Create a local `server/.env` from the root `.env.example`, set `DB_PASSWORD`, `JWT_SECRET`, and `SEED_ADMIN_PASSWORD`, then run:

```powershell
npm run db:init
npm run db:seed
```

The schema creates only `employees`, `users`, `categories`, and `products` for Part 1. No customer table is created.
