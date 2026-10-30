# Smart Canteen — Project Guide

## 1. Product goal

Smart Canteen is a queue-management and ordering system for a college canteen. It should help students and guests place orders, show a useful estimated wait, help staff manage service counters, and demonstrate measurable queue performance under normal and peak demand.

The key outcome is not just digital ordering. The backend must coordinate eligible service counters, estimate service-start/readiness times, record actual timestamps, and report whether the chosen scheduling strategy improves waiting time.

## 2. User experiences

The system has three experiences backed by one shared API and database:

- **Student app (installable PWA):** sign in, browse the menu, see availability, build a cart, place an order, receive a token, track status and estimated wait, and view own order history.
- **Guest QR webpage:** open a canteen-specific QR URL, browse available items, place an order without a permanent account, and track only that guest's order using an unguessable access token or equivalent authorization.
- **Canteen management app:** staff login, incoming queue, counter status, start/ready/complete actions, item availability and stock management, order issue handling, and operational analytics.

A restricted admin role may manage staff, counter configuration and canteen settings. Do not build a native Android app for the initial prototype; a responsive PWA covers phone and desktop browsers.

## 3. Recommended technology

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, reusable accessible components.
- Backend: Node.js + Express. TypeScript is the intended convention for new application modules; the provided queue engine stays JavaScript ES modules for easy reuse.
- Validation: Zod on incoming API requests.
- Database: PostgreSQL, preferably managed through Supabase for a hackathon.
- ORM/migrations: Prisma.
- Realtime updates: choose **one** initially—Socket.IO or Supabase Realtime. Database state remains authoritative.
- Testing: Node's built-in test runner for the pure engine; Vitest and API integration tests for frontend/backend code as it grows.
- Version control: Git + GitHub.
- Candidate hosting: Vercel for Next.js, Render or another Node host for the Express API, Supabase for PostgreSQL. Confirm the chosen providers' current limits and pricing before deployment.

## 4. Architecture

```text
Student PWA ─┐
Guest QR web ├── HTTPS / JSON API ── Express backend ── PostgreSQL
Staff web ───┘                           │
                                        ├── Queue + ETA engine
                                        ├── Auth / role checks
                                        ├── Order + stock service
                                        ├── Counter scheduling
                                        └── Realtime event publisher
```

Use a **modular monolith**: one backend deployment with separate modules, not a collection of microservices. Keep the scheduling engine independent from UI components and HTTP routes so it can be tested with fixed inputs.

## 5. Repository layout

```text
smart-canteen/
├── apps/
│   ├── web/                     # Student, guest and staff routes
│   │   └── src/app/             # Route pages and layouts
│   └── api/                     # Express backend
│       ├── src/modules/         # auth, menu, orders, queue, counters, inventory, analytics
│       ├── src/engine/          # Engine integration boundary
│       └── tests/
├── packages/shared/             # Shared schemas/types when useful
├── engine/
│   ├── smartCanteenEngine.mjs
│   └── smartCanteenEngine.test.mjs
├── agents/                      # Role prompts and handoff guidance
├── .github/agents/              # Copilot-compatible custom agents
├── .github/skills/              # Reusable task instructions
├── .cursor/rules/               # Cursor project rules
├── docs/
├── AGENTS.md
└── SMART_CANTEEN_PROJECT.md
```

Keep the engine in `engine/` as the canonical source. The API should import it instead of maintaining a second copy.

## 6. Feature priority

### Must-have

- Student and guest entry paths.
- Menu and item availability.
- Cart, order validation, order creation and unique token.
- Staff queue dashboard.
- Multiple counters, counter capabilities and one active order per counter.
- Order state transitions and live tracking.
- Preparation-time and service-start estimates.
- Actual average and maximum wait metrics.
- Low/medium/high congestion derived from live queue estimates.
- Simulation to compare a baseline strategy with another strategy using identical arrivals.
- Tests for simultaneous requests, stock exhaustion, no compatible counter, no waiting customers, cancellation and counter downtime.

### Useful additions

- Batch capacity, setup/assembly time and counter-specific speed factors.
- Low-stock warnings and stock movement history.
- Guest QR menu pages and guest order tracking.
- Historical analytics, counter utilization and delay flags.
- Order-history screen and accessible status notifications.

### Extra / low priority

- Badges, leaderboards, loyalty points and reward discounts.
- Bill splitting and payment requests to other students.
- Elaborate profile customisation.
- Payment-gateway integration, SMS/push services and college single sign-on unless the demo specifically needs them.

Do not let optional engagement features delay the queue engine, reliable order workflow, or measurable evaluation.

## 7. Login and authorization

- **Student:** college account or verified identity; can create orders and access only their own order/history data.
- **Guest:** temporary identity; access is limited to their own orders through a random, unguessable tracking secret or a server-verified guest session. A visible token number is not an authorization secret.
- **Staff:** authenticated account with server-enforced permissions to manage queue/counters and relevant inventory.
- **Manager/admin:** additional permissions for menu, stock, staff and configuration changes.

Hash passwords with a suitable password-hashing algorithm or use a trusted identity provider. Never store plain-text passwords. Keep secrets on the server; do not expose database credentials or privileged service keys to the browser. Validate permissions on every protected API request.

## 8. Order workflow

1. User opens student app or scans the guest QR URL.
2. UI loads the current menu from the backend.
3. User selects items and quantities.
4. Server validates IDs, quantities, prices, availability and stock against trusted database values.
5. A database transaction reserves stock, creates the order, snapshots item prices, and generates a unique canteen/service-day token.
6. The queue engine forecasts compatible counter assignment, service start, readiness and waiting time.
7. Staff view the new order and accept/start it through an authorized endpoint.
8. Order state advances through `QUEUED → ASSIGNED → PREPARING → READY → COMPLETED`. Cancellation is only allowed in explicitly defined states.
9. The API publishes an update; student/guest and staff screens refresh their views.
10. Actual timestamps are stored and used for metrics; predictions remain labelled estimates.

## 9. Queue and ETA engine

The canonical engine is `engine/smartCanteenEngine.mjs`. It currently exports:

- `ORDER_STATUS`
- `counterCanHandleOrder`
- `estimateOrderPrepMinutes`
- `validateOrderItems`
- `createOrderDraft`
- `buildQueuePlan`
- `calculateMetrics`
- `calculateCrowdLevel`
- `startOrder`
- `transitionOrder`
- `simulateQueue`

Example item shape:

```js
{
  itemId: 'DOSA', name: 'Dosa', category: 'HOT', price: 40,
  prepMinutesPerBatch: 4, batchSize: 4, stockQty: 30, isAvailable: true
}
```

Example counter shape:

```js
{
  counterId: 'C1', name: 'Hot Food', isActive: true,
  supportedCategories: ['HOT'], status: 'AVAILABLE', speedFactor: 1
}
```

Current model assumptions and limitations:

- A complete order is handled by one eligible counter that supports all its item categories.
- Each counter prepares one order at a time.
- `prepMinutesPerBatch` means one batch's time; `batchSize` is the number of units in that batch. It batches quantities within one order, not across separate customers' orders.
- Counter setup and assembly minutes and `speedFactor` adjust the preparation estimate.
- An overrun is handled using a configurable fallback, not learned from historical data.
- Queue plans are forecasts, not reservations. A real backend must persist assignments and use database transactions/locks to avoid races.
- The simulation is deterministic and useful for comparison; it is not a guarantee of real-world throughput.
- One counter per order does not model separate kitchen stations working on items in parallel.

Run engine tests from the repository root:

```bash
node --test engine/smartCanteenEngine.test.mjs
```

## 10. ETA definitions

- **Remaining estimated wait:** predicted service start minus current time, clamped to zero.
- **Expected total wait:** predicted service start minus queue-entry time.
- **Actual waiting time:** recorded service-start timestamp minus queue-entry timestamp.
- **Queue-to-ready duration:** actual ready timestamp minus queue-entry timestamp.
- **Average wait:** mean actual waiting time for completed orders with valid queue-entry and service-start timestamps.
- **Maximum wait:** largest actual waiting time in the measured sample.
- **P90 wait:** 90th percentile of actual waiting times; useful because an average can hide very long waits.

Never show a prediction as an actual measured result. Recompute ETA when orders arrive/cancel, counter status changes, preparation starts/finishes, or relevant menu/counter configuration changes.

## 11. Database design

Recommended relational tables:

- `users`: identity, roll number/email when applicable, password hash or identity-provider subject, role and timestamps.
- `canteens`: supports multiple canteens if required; otherwise can be omitted initially.
- `menu_categories`, `menu_items`: name, category, price, prep estimate, batch size, stock, availability.
- `counters`, `counter_menu_categories`: active state, current status, supported categories and counter settings.
- `orders`: token, user/guest references, state, queue-entry and service/ready/completion/cancellation timestamps, assigned counter.
- `order_items`: order/menu references, quantity, unit-price snapshot and prep-time snapshot.
- `queue_events`: append-only history of order status changes, counter assignments and notes.
- `inventory_movements`: item, quantity delta, reason, timestamp and staff actor.
- `payments` (optional): external provider reference, amount and status; never store raw card details.
- `audit_logs` (recommended): staff/admin operations that require traceability.

Use foreign keys, indexes and database constraints. Store monetary values as integer paise or a database decimal—not binary floating-point for financial totals. Use UTC timestamps in storage and display local time in the UI.

### Concurrency correctness

Stock validation in application memory alone is insufficient. Reserve/decrement stock inside a database transaction using row locking or conditional atomic updates. Token generation must be protected by a unique constraint. Counter assignment and order start must be transactionally protected so simultaneous requests cannot double-start a counter. Use idempotency keys for retryable order-creation requests where practical.

## 12. API contract suggestion

- `GET /api/health`
- `GET /api/menu`
- `POST /api/orders`
- `GET /api/orders/:id`
- `GET /api/orders/:id/track`
- `GET /api/staff/queue`
- `POST /api/staff/orders/:id/assign`
- `POST /api/staff/orders/:id/start`
- `POST /api/staff/orders/:id/ready`
- `POST /api/staff/orders/:id/complete`
- `PATCH /api/staff/menu/:id`
- `GET /api/staff/analytics`
- `POST /api/queue/preview` (internal/demo use; do not accept untrusted client queue state as authoritative)
- `POST /api/queue/simulate` (demo/analytics)

Use consistent JSON error shapes, validate request bodies, authorize each route, and avoid returning private user data in tracking responses.

## 13. UX and visual design

Use one coherent brand: warm off-white surfaces, dark navy text, and orange as the main action colour. Use green for ready/completed, blue for preparation, amber for queued/delayed, and red for cancelled/error; never communicate status by colour alone.

- Student UI: mobile-first cards, visible price/availability, few steps to order, large token and ETA.
- Guest UI: direct menu access, minimal registration friction, isolated order tracking.
- Staff UI: desktop-friendly information density, queue sorted predictably, clear counter workload and large order-state actions.

Provide loading, empty, error, sold-out, delayed and offline/reconnect states. Keep text contrast and keyboard accessibility usable.

## 14. Deployment and configuration

A reasonable hackathon setup is Vercel for the Next.js app, Render (or another Node host) for the Express API, and Supabase PostgreSQL. These are options, not a guarantee of free production hosting; check current limits, sleeping behaviour, connection pooling and pricing before the event.

Example environment variables (fill real values in the hosting dashboard, not in Git):

```dotenv
PORT=4000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
DATABASE_URL=
SESSION_SECRET=
```

Additional values depend on the authentication, realtime and payment providers actually selected. `.env` files with secrets must be ignored by Git. Keep separate development and production credentials, enforce HTTPS, configure allowed CORS origins, run database migrations, and test the deployed environment.

## 15. Testing and judging demo

Required scenarios:

1. Low traffic and peak bursts.
2. Several customers arrive at the same timestamp.
3. Multiple counters become free at the same timestamp.
4. A counter goes offline while there are waiting orders.
5. No customers wait; counters become idle.
6. No active counter can handle a certain item category.
7. Stock runs out while multiple customers attempt to order.
8. Customer cancellation before and after preparation begins.
9. Preparation takes longer than predicted.
10. API retry or double-click tries to create the same order twice.

For queue-strategy comparisons, use exactly the same arrival times, items, counter capabilities and service estimates. Report average and maximum actual/simulated wait, P90 wait, completed orders and counter utilisation. Clearly label simulated results. Do not make a percentage-improvement claim without recorded comparable results.

## 16. Optional features

Keep badges, leaderboards, loyalty points, spending rankings, bill splitting, payment integrations and rich notifications optional. They should not make core ordering or staff operations less reliable.

## 17. Working rules for AI agents

- Read `AGENTS.md` before editing.
- Use the specialist agents in `.github/agents/` for focused tasks.
- Inspect the existing code before creating or replacing files.
- Keep changes small and explain affected files.
- Do not fabricate successful test/deployment results.
- Run tests after touching scheduling logic.
- Treat the database as authoritative; UI state is never authoritative for prices, stock, roles, or queue assignments.
- Do not add an AI/ML model unless there is real historical data and a measurable reason. The initial ETA logic is deterministic and explainable.
