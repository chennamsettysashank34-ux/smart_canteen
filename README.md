# Smart Canteen System — Hackathon Feature Implementation

A unified, real-time Smart Canteen management platform designed to eliminate long physical waiting queues, provide predictive real-time ETAs, balance order flow across multiple service counters, and report actual waiting-time improvements.

---

## 🚀 Key Applications & Screens

| Application | URL | Description |
| :--- | :--- | :--- |
| **Portal Hub** | `http://localhost:3000/` | Single entry launcher with live system health and feature compliance checklist. |
| **Student Mobile PWA** | `http://localhost:3000/student` | Mobile-first portal: browse menu by category, check real-time stock & prep estimates, cart with **estimated wait preview before confirmation**, instant token generation (`T021`), live countdown tracker (`QUEUED` ➔ `PREPARING` ➔ `READY` ➔ `COMPLETED`), cancellation with stock release, and order history. |
| **Guest QR Portal** | `http://localhost:3000/guest/main-canteen` | Frictionless scan-and-order without mandatory login: guest name input, stock availability checks, express checkout, digital token generation, and live pickup tracking. |
| **Staff Kitchen KDS** | `http://localhost:3000/staff/dashboard` | Desktop/tablet kitchen display: live queue board, multi-counter cards (C01 Hot Food, C02 Snacks & Drinks), counter pause/resume, order actions (`Start Preparing`, `Mark Ready`, `Complete`, `+3m Delay`, `Reject`), inventory & stock management modal, and demo scenario loaders. |
| **Queue Analytics & Benchmarking** | `http://localhost:3000/analytics` | Side-by-side comparison of **Baseline FCFS** vs **Proposed Allocation Strategy** on identical test arrivals, reporting actual average wait, maximum wait, counter utilisation, and throughput. |
| **Backend REST API** | `http://localhost:4000/health` | Node.js + Express API with in-memory stateful store, role authorization, atomic stock reservations, queue planning, and simulation engine. |

---

## 🏆 Hackathon Feature Plan Matrix Winner

### P0 — MUST HAVE (Completed)
- [x] **Menu with real-time availability**: Dosa, Sandwich, Tea, Veg Puff with real-time stock and prices.
- [x] **Place order**: Server rechecks stock before accepting order; atomic inventory deduction.
- [x] **Unique token number generation**: Auto-incrementing tokens (`T021`, `T022`...).
- [x] **Live queue status**: Displays queue position, assigned counter, and ETA.
- [x] **Order status transitions**: Complete lifecycle (`QUEUED` ➔ `PREPARING` ➔ `READY` ➔ `COMPLETED` / `CANCELLED`).
- [x] **Staff dashboard**: Incoming orders sorted by queue-entry time, order age, and prep estimates.
- [x] **Multiple service counters**: Counter C01 (Hot Food) and Counter C02 (Snacks & Drinks).
- [x] **Deterministic counter assignment**: Ties broken by lowest counter ID; simultaneous arrivals broken by timestamp & order ID.
- [x] **Preparation-time estimates**: Calculated from item batch configuration.
- [x] **Items-left / stock status**: Visual indicator of remaining units and sold-out states.
- [x] **Actual waiting-time metrics**: Computed as `service_started_at − queue_entered_at`.
- [x] **Simulation & comparison benchmark**: Runs identical arrival workloads through both strategies.

### P1 — SHOULD HAVE (Completed)
- [x] **Batch preparation capacity**: Uses `Math.ceil(quantity / batchSize) * prepMinutesPerBatch`.
- [x] **Counter capabilities**: Counter compatibility enforcement (e.g., C01 only accepts HOT food; incompatible starts are blocked).
- [x] **Dynamic crowd level**: Computed as `LOW`, `MODERATE`, `HIGH`, or `PEAK` based on pending queue workload.
- [x] **Congestion alert**: Automatic banner triggered when crowd level is HIGH or PEAK.
- [x] **Estimated wait before confirmation**: Displayed in the customer cart prior to submitting an order.
- [x] **Order history**: Student past orders with status and timestamps.
- [x] **Guest QR entry**: Frictionless visitor access with temporary caller name.
- [x] **Low-stock warning**: Visual badge when an item has 5 or fewer units remaining.

### Required Test Scenarios (Section 8)
- [x] **Scenario 1 — Low Traffic**: Light arrival flow with low waiting times and zero false congestion.
- [x] **Scenario 2 — Peak Lunch Rush**: Burst of 10 incoming orders across categories, triggering crowd congestion alert and testing multi-counter load balancing.
- [x] **Scenario 3 — Counter Offline / Breakdown**: Hot Food counter paused; engine flags hot items as blocked with clear reason while drinks and snacks proceed.

---

## 🔑 Demo Credentials

- **Student A**: Roll No `1602-25-001` (Demo Student A)
- **Student B**: Roll No `1602-25-002` (Demo Student B)
- **Staff / Kitchen Lead**: `staff@canteen.edu` (Demo Staff)
- **Guest**: No login required — instant express QR entry.

---

## ⚡ Quick Start & Development

### 1. Prerequisites
- Node.js v20+ / v24 LTS
- Git

### 2. Available Commands

```bash
# Run all backend unit & store tests (18/18 passing)
npm run test:api

# Compile the TypeScript API
npm run build:api

# Compile the Next.js frontend
npm run build:web

# Run development servers
npm run dev:api   # API at http://localhost:4000
npm run dev:web   # Web at http://localhost:3000
```
