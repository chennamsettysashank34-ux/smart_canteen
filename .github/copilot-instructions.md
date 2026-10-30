# Smart Canteen — Project Instructions

## Goal
Build a Smart Canteen application that reduces waiting times using queue management, multiple counters, preparation-time estimates, order tracking and analytics.

## Technology
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Testing: Vitest and API integration tests

## Applications
- Student: menu, cart, token, order tracking and order history.
- Guest: QR-based menu, ordering and tracking.
- Staff: queue, counter status, order preparation and inventory.
- Admin: restricted configuration where required.
All applications use the same backend and database.

## Engineering Rules
1. Implement one feature at a time.
2. Read existing files before editing them.
3. Do not replace working code without explaining why.
4. Keep frontend components separate from business logic.
5. Queue scheduling must run on the backend.
6. The database is the source of truth for orders.
7. Validate all order inputs on the server.
8. Protect inventory and counter assignments against concurrent requests.
9. Enforce roles and permissions on every protected API endpoint.
10. Write tests for important business rules and edge cases.
11. Never place secrets in source code or browser-exposed variables.
12. Avoid adding dependencies unless they are justified.
13. Do not build payment integration, leaderboards, badges or other optional features before the core order workflow works.
14. Run relevant tests and report failures honestly.

## Queue Requirements
- Support multiple counters.
- Respect counter capabilities.
- Estimate service start and completion times.
- Record actual queue-entry and service-start timestamps.
- Calculate average and maximum waiting times.
- Handle simultaneous arrivals and available counters deterministically.
- Support zero waiting customers and temporarily unavailable counters.
- Compare queue strategies using the same simulation inputs.

## Development Workflow
For each task:
1. Explain the proposed implementation briefly.
2. Identify the files that will change.
3. Implement only the requested scope.
4. Run relevant checks and tests.
5. Summarise changed files, results and remaining limitations.
