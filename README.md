# Allo Health — Inventory & Reservation System

Built by **Prasanna Gayathri T S** as part of Allo Health's engineering take-home exercise.

A full-stack inventory and order-fulfillment platform. The core challenge is solving the race condition that occurs when multiple customers attempt to purchase the same item simultaneously during checkout.

## Live Demo
🔗 **Live URL:** https://allo-health-gray.vercel.app

**GitHub:** https://github.com/Prasanna-Gayathri/allo-health

---

## The Problem

When a customer proceeds to checkout, payment can take several minutes (3DS flows, UPI confirmations). During this window, thousands of other shoppers may be viewing the same product. Two naive approaches both fail:

- **Decrement at payment time** → Two customers can pay for the same physical unit
- **Decrement at add-to-cart** → 80% of carts are abandoned, so inventory looks depleted and conversion tanks

The solution is a **reservation system**: temporarily hold units for 10 minutes while payment processes. If payment succeeds → confirm and permanently decrement stock. If payment fails or timer expires → release the hold.

---

## How to Run Locally

### Prerequisites
- Node.js 18+
- A Supabase account (free tier works)

### 1. Clone the repository
```bash
git clone https://github.com/Prasanna-Gayathri/allo-health.git
cd allo-health
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

> Use the **Transaction Pooler** connection string from Supabase → Settings → Database → Connection Pooling. This is required for Prisma v7 with the pg adapter.

### 4. Run database migrations
```bash
npx prisma db push
```

### 5. Seed the database
```bash
npm run seed
```

This creates:
- 2 warehouses (Mumbai Central, Delhi North)
- 3 products (Wireless Headphones, Mechanical Keyboard, USB-C Hub)
- Stock levels per product per warehouse

### 6. Start the development server
```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Architecture & Data Model
Product
└── Stock (per warehouse) ← total units, reserved units
└── Warehouse
Reservation
├── productId
├── warehouseId
├── quantity
├── status: pending | confirmed | released
└── expiresAt (10 minutes from creation)
The key insight is separating **total** stock from **reserved** stock:
- `available = total - reserved`
- On reservation → increment `reserved`
- On confirm → decrement both `total` and `reserved`
- On release → decrement only `reserved`

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List all warehouses |
| POST | `/api/reservations` | Reserve units — returns 409 if insufficient stock |
| GET | `/api/reservations/:id` | Get reservation details |
| POST | `/api/reservations/:id/confirm` | Confirm reservation — returns 410 if expired |
| POST | `/api/reservations/:id/release` | Release reservation early |

---

## How the Race Condition is Solved

This is the core of the exercise. The naive approach of checking stock availability in application code fails under concurrency:
Request A: SELECT stock → 1 unit available ✓
Request B: SELECT stock → 1 unit available ✓  ← both see 1 unit!
Request A: UPDATE reserved = reserved + 1
Request B: UPDATE reserved = reserved + 1  ← oversold!
The fix is **PostgreSQL row-level locking** using `SELECT FOR UPDATE` inside a transaction:

```sql
BEGIN;
SELECT id, total, reserved 
FROM "Stock" 
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;  -- locks this row
-- check availability, update reserved, create reservation
COMMIT;
```

`FOR UPDATE` means:
- Request A acquires the lock → checks stock → 1 unit available → increments reserved → commits
- Request B waits at the lock → acquires it after A commits → checks stock → 0 units available → throws `INSUFFICIENT_STOCK` → returns **409**

This guarantees exactly one winner with no application-level race conditions possible. The database itself enforces the constraint.

---

## How Expiry Works in Production

Reservations expire after **10 minutes** (`expiresAt = now + 10 minutes`).

I implemented **lazy cleanup on read**:
- When a reservation is fetched or confirmed, we check `if (now > expiresAt)`
- If expired → release reserved stock back + mark status as `released`
- Returns **410 Gone** to the client

**Why lazy cleanup:**
- Simple to implement and reason about
- No background infrastructure needed
- Correct — stock is always released before it's re-shown as available
- Works well for moderate traffic

**What I'd use in production with high volume:**
A **Vercel Cron Job** running every minute:
SELECT * FROM Reservation WHERE status = 'pending' AND expiresAt < now()
→ batch release all expired reservations
This prevents stock from appearing reserved in the product listing even after expiry.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js 16 (App Router) | Frontend + API routes |
| TypeScript | End-to-end type safety |
| Prisma 7 | ORM with PostgreSQL driver adapter |
| Supabase | Hosted PostgreSQL database |
| @prisma/adapter-pg | Prisma v7 PostgreSQL adapter |
| Zod | API request validation |
| Tailwind CSS + shadcn/ui | UI components |
| Vercel | Deployment |

---

## Trade-offs & What I'd Do Differently

### What I focused on
- **Correctness under concurrency** — the `SELECT FOR UPDATE` locking is the most important part and is implemented correctly
- **Clean API design** — proper HTTP status codes (409 for conflict, 410 for expired)
- **Working end-to-end** — the full flow works on the live URL

### Trade-offs made

**Expiry mechanism:** Used lazy cleanup instead of a cron job. Simple and correct but means expired reservations still show as reserved in the product listing until someone tries to confirm them. A cron job would fix this.

**No Redis distributed locking:** Used database-level locking instead of Redis. This is correct and sufficient for a single Postgres instance. Redis would be needed if we had multiple database replicas.

**No idempotency keys:** The bonus feature (Idempotency-Key header) is not implemented. Would use Redis to cache request/response pairs keyed by the idempotency key with a TTL.

**No authentication:** Reservations are not tied to user accounts. In production, we'd require auth so users can only confirm/release their own reservations.

**No automated tests:** Would add integration tests for the concurrent reservation scenario — spinning up two simultaneous requests for the last unit and asserting exactly one 409.

### What I'd do differently with more time
1. Add a Vercel Cron Job for bulk expiry cleanup
2. Implement idempotency keys with Redis (Upstash)
3. Add authentication with NextAuth
4. Write integration tests for the concurrency logic
5. Add a warehouse selector UI so users can pick which warehouse to reserve from
6. Show real-time stock updates using Server-Sent Events or polling
7. **Better frontend UX** — The current UI is functional but minimal. With more time I'd improve the product listing with proper filtering, sorting, and search. The reservation page would show full product details, warehouse information, and a more polished checkout experience. I'd also add loading skeletons instead of plain text loaders, and proper error pages instead of inline error messages.
  <img width="1889" height="882" alt="product" src="https://github.com/user-attachments/assets/35855813-0773-4242-8f06-cc5b40b754d2" />
   <img width="1895" height="271" alt="reservation_countdown" src="https://github.com/user-attachments/assets/a42f8146-1954-4e95-b488-aa8608c6dd4b" />
   <img width="1900" height="178" alt="purchase_confirmed" src="https://github.com/user-attachments/assets/e96877d5-06fe-46d2-85c8-037b1738ecb7" />


