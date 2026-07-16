# Pulse POS Starter

- Node.js and Express.js REST API
- React.js frontend with reusable UI building blocks
- JWT authentication and role-based access control
- Product, category, inventory, procurement, customer, and sales modules
- Discounts, tax calculation, refunds, loyalty points, reporting, and audit logging
- Barcode-driven checkout flow and stock deduction after each successful sale
- Sequelize models for PostgreSQL or MySQL deployment

## Project structure

```text
POS/
  client/   React + Vite dashboard
   server/   Express REST API with Sequelize-backed relational persistence
```

## Demo accounts

- Admin: `admin@pos.local` / `Admin@123`
- Manager: `manager@pos.local` / `Manager@123`
- Cashier: `cashier@pos.local` / `Cashier@123`

## Database setup

1. Copy [.env.example](.env.example) to `.env` and point it to your PostgreSQL or MySQL instance.
2. Create the schema and tables:

   ```powershell
   "C:\Program Files\nodejs\npm.cmd" run db:sync --workspace server
   ```

3. Seed demo records into the database:

   ```powershell
   "C:\Program Files\nodejs\npm.cmd" run seed --workspace server
   ```

## Run locally

1. Install dependencies:

   ```powershell
   "C:\Program Files\nodejs\npm.cmd" install
   ```

2. Start the API:

   ```powershell
   "C:\Program Files\nodejs\npm.cmd" run dev --workspace server
   ```

3. In another terminal, start the client:

   ```powershell
   "C:\Program Files\nodejs\npm.cmd" run dev --workspace client
   ```

4. Open `http://localhost:5173`

## Notes

- The backend now uses Sequelize models in [server/src/db.js](server/src/db.js) with tables for users, categories, products, customers, purchase orders, purchase order items, sales, sale items, refunds, and audit logs.
- Seed data is defined in [server/src/seedData.js](server/src/seedData.js).
- Run the seed script to reset the sample relational dataset:

  ```powershell
  "C:\Program Files\nodejs\npm.cmd" run seed --workspace server
  ```

- The current implementation is a clean starter baseline. For production, add migrations, schema validation, connection pooling policies, and move secrets to your deployment environment.
