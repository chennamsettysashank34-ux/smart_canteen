/**
 * Smart Canteen queue + ETA engine (prototype-ready, backend-agnostic).
 *
 * Model assumptions:
 * - Each order is handled by ONE eligible counter. A counter must support every
 *   category in the order. Configure a general-purpose counter with ["*"] if needed.
 * - Each counter prepares one order at a time.
 * - menuItem.prepMinutesPerBatch is the estimated time for one batch of that item;
 *   batchSize is how many units fit in one batch. This batches quantities inside
 *   an order, not identical items across different customers' orders.
 * - Estimates are predictions. Recompute whenever orders/counters change.
 * - Persist/transition orders on the SERVER; a database transaction is required
 *   for token generation, stock reservation, and preventing double-starts.
 */

export const ORDER_STATUS = Object.freeze({
  QUEUED: "QUEUED",
  ASSIGNED: "ASSIGNED",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

const MINUTE_MS = 60_000;
const ACTIVE_QUEUE_STATUSES = new Set([ORDER_STATUS.QUEUED, ORDER_STATUS.ASSIGNED]);
const FINAL_STATUSES = new Set([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED]);

function asMs(value, fallback = NaN) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asIso(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function requiredId(object, field, label) {
  const value = object?.[field];
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`${label} requires ${field}.`);
  }
  return String(value);
}

function makeMenuMap(menuItems) {
  return new Map((menuItems ?? []).map((item) => [String(item.itemId ?? item.id), item]));
}

function orderItems(order) {
  return (order?.items ?? order?.orderItems ?? []).map((line) => ({
    itemId: String(line.itemId ?? line.item_id ?? line.id),
    quantity: Number(line.quantity),
  }));
}

function categoriesForOrder(order, menuMap) {
  return [...new Set(orderItems(order).map((line) => {
    const item = menuMap.get(line.itemId);
    return String(item?.category ?? "GENERAL").trim().toLowerCase();
  }))];
}

export function counterCanHandleOrder(counter, order, menuItems) {
  if (!counter || counter.isActive === false) return false;
  const supported = (counter.supportedCategories ?? ["*"]).map((v) => String(v).trim().toLowerCase());
  if (supported.length === 0 || supported.includes("*")) return true;
  const menuMap = menuItems instanceof Map ? menuItems : makeMenuMap(menuItems);
  return categoriesForOrder(order, menuMap).every((category) => supported.includes(category));
}

/**
 * Conservative duration estimate for ONE order at ONE counter.
 * prepMinutesPerBatch (or prepMinutes) is time per batch, not per unit.
 */
export function estimateOrderPrepMinutes(order, menuItems, counter = {}) {
  const menuMap = menuItems instanceof Map ? menuItems : makeMenuMap(menuItems);
  const lines = orderItems(order);
  if (lines.length === 0) throw new Error("An order must contain at least one item.");

  let minutes = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Invalid quantity for item ${line.itemId}; quantity must be a positive integer.`);
    }
    const item = menuMap.get(line.itemId);
    if (!item) throw new Error(`Menu item ${line.itemId} was not found.`);
    const batchSize = Number(item.batchSize ?? 1);
    const perBatch = Number(item.prepMinutesPerBatch ?? item.prepMinutes);
    if (!Number.isFinite(batchSize) || batchSize < 1 || !Number.isFinite(perBatch) || perBatch < 0) {
      throw new Error(`Menu item ${line.itemId} has invalid batchSize/preparation time.`);
    }
    minutes += Math.ceil(line.quantity / batchSize) * perBatch;
  }

  const setupMinutes = Number(counter.setupMinutes ?? 0);
  const assemblyMinutes = Number(counter.assemblyMinutes ?? 0);
  const speedFactor = Number(counter.speedFactor ?? 1); // 1 = normal; 0.9 = estimated 10% faster
  if (setupMinutes < 0 || assemblyMinutes < 0 || !Number.isFinite(speedFactor) || speedFactor <= 0) {
    throw new Error("Counter setupMinutes/assemblyMinutes must be non-negative and speedFactor must be positive.");
  }
  return round2((minutes + setupMinutes + assemblyMinutes) * speedFactor);
}

/** Validate an incoming order before creating it. This does NOT reserve stock. */
export function validateOrderItems(items, menuItems) {
  const menuMap = menuItems instanceof Map ? menuItems : makeMenuMap(menuItems);
  const errors = [];
  const merged = new Map();

  for (const raw of items ?? []) {
    const itemId = String(raw.itemId ?? raw.item_id ?? raw.id ?? "");
    const quantity = Number(raw.quantity);
    if (!itemId) {
      errors.push("Every order line must include itemId.");
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      errors.push(`Quantity for ${itemId} must be a whole number from 1 to 50.`);
      continue;
    }
    merged.set(itemId, (merged.get(itemId) ?? 0) + quantity);
  }

  if (merged.size === 0) errors.push("Choose at least one menu item.");
  const normalizedItems = [];
  let totalAmount = 0;

  for (const [itemId, quantity] of merged) {
    if (quantity > 50) {
      errors.push(`Total quantity for ${itemId} cannot exceed 50 units per order.`);
      continue;
    }
    const item = menuMap.get(itemId);
    if (!item) {
      errors.push(`Menu item ${itemId} is not available in the menu.`);
      continue;
    }
    if (item.isAvailable === false || (item.stockQty !== undefined && Number(item.stockQty) <= 0)) {
      errors.push(`${item.name ?? itemId} is sold out.`);
      continue;
    }
    if (item.stockQty !== undefined && quantity > Number(item.stockQty)) {
      errors.push(`Only ${Number(item.stockQty)} unit(s) of ${item.name ?? itemId} remain.`);
      continue;
    }
    const unitPrice = Number(item.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`Menu item ${itemId} has an invalid price.`);
      continue;
    }
    normalizedItems.push({ itemId, quantity, unitPriceAtOrder: unitPrice });
    totalAmount += unitPrice * quantity;
  }

  return {
    valid: errors.length === 0,
    errors,
    items: normalizedItems,
    totalAmount: round2(totalAmount),
  };
}

/** Create a draft record after validation. Persist it atomically in your backend. */
export function createOrderDraft({
  orderId,
  tokenNo,
  userId = null,
  guestName = null,
  items,
  menuItems,
  now = new Date(),
}) {
  const id = requiredId({ orderId }, "orderId", "Order");
  const token = requiredId({ tokenNo }, "tokenNo", "Order");
  const checked = validateOrderItems(items, menuItems);
  if (!checked.valid) return { ok: false, errors: checked.errors };

  const timestamp = asIso(asMs(now));
  return {
    ok: true,
    order: {
      orderId: id,
      tokenNo: token,
      userId,
      guestName,
      items: checked.items,
      totalAmount: checked.totalAmount,
      status: ORDER_STATUS.QUEUED,
      queueEnteredAt: timestamp,
      assignedCounterId: null,
      serviceStartedAt: null,
      estimatedPrepMinutes: null,
      estimatedReadyAt: null,
      readyAt: null,
      completedAt: null,
      cancelledAt: null,
    },
  };
}

function stableOrderSort(a, b) {
  const aTime = asMs(a.queueEnteredAt, 0);
  const bTime = asMs(b.queueEnteredAt, 0);
  if (aTime !== bTime) return aTime - bTime;
  return String(a.orderId ?? a.id).localeCompare(String(b.orderId ?? b.id));
}

function estimateActiveRemainingMs(order, nowMs, config) {
  const startedMs = asMs(order.serviceStartedAt ?? order.preparationStartedAt, NaN);
  const duration = Number(order.estimatedPrepMinutes);
  if (Number.isFinite(startedMs) && Number.isFinite(duration) && duration >= 0) {
    const expectedFinish = startedMs + duration * MINUTE_MS;
    if (expectedFinish > nowMs) return expectedFinish;
    // An overdue order is not assumed to finish instantly. This fallback is configurable;
    // replace it with a learned overrun estimate when enough completed-order data exists.
    return nowMs + Number(config.overdueRemainingMinutes ?? 2) * MINUTE_MS;
  }
  const busyUntil = asMs(order.estimatedReadyAt, NaN);
  if (Number.isFinite(busyUntil) && busyUntil > nowMs) return busyUntil;
  return nowMs + Number(config.unknownBusyMinutes ?? 3) * MINUTE_MS;
}

function canUseCounter(counter, order, menuMap) {
  return counterCanHandleOrder(counter, order, menuMap);
}

/**
 * Forecast the queue without changing stored orders/counters.
 * Returns ETA per order, predicted counter workload, and orders with no eligible counter.
 */
export function buildQueuePlan({ orders = [], counters = [], menuItems = [], now = new Date(), config = {} }) {
  const nowMs = asMs(now);
  if (!Number.isFinite(nowMs)) throw new Error("now must be a valid Date, timestamp, or ISO date string.");
  const menuMap = makeMenuMap(menuItems);
  const activeCounters = counters.filter((counter) => counter.isActive !== false);
  const availableAt = new Map();
  const counterWarnings = [];
  const schedule = {};
  const busyOrderByCounter = new Map();

  for (const order of orders) {
    if (order.status !== ORDER_STATUS.PREPARING) continue;
    const counterId = order.assignedCounterId == null ? null : String(order.assignedCounterId);
    if (!counterId) continue;
    if (busyOrderByCounter.has(counterId)) {
      counterWarnings.push(`Counter ${counterId} has multiple PREPARING orders. Enforce one active order per counter in the database.`);
      continue;
    }
    busyOrderByCounter.set(counterId, order);
  }

  for (const counter of activeCounters) {
    const counterId = String(counter.counterId ?? counter.id);
    const activeOrder = busyOrderByCounter.get(counterId);
    if (activeOrder) {
      const endAt = estimateActiveRemainingMs(activeOrder, nowMs, config);
      availableAt.set(counterId, endAt);
      const startMs = asMs(activeOrder.serviceStartedAt ?? activeOrder.preparationStartedAt, nowMs);
      const remaining = Math.max(0, (endAt - nowMs) / MINUTE_MS);
      schedule[String(activeOrder.orderId ?? activeOrder.id)] = {
        orderId: String(activeOrder.orderId ?? activeOrder.id),
        counterId,
        status: activeOrder.status,
        estimatedStartAt: asIso(startMs),
        estimatedReadyAt: asIso(endAt),
        estimatedWaitMinutesFromNow: 0,
        estimatedTotalWaitMinutes: Number.isFinite(asMs(activeOrder.queueEnteredAt))
          ? round2(Math.max(0, (startMs - asMs(activeOrder.queueEnteredAt)) / MINUTE_MS)) : null,
        estimatedReadyInMinutes: round2(remaining),
        prepMinutes: Number(activeOrder.estimatedPrepMinutes ?? 0),
      };
    } else {
      const busyUntil = asMs(counter.busyUntil ?? counter.estimatedAvailableAt, NaN);
      if (String(counter.status ?? "AVAILABLE").toUpperCase() === "BUSY") {
        availableAt.set(counterId, Number.isFinite(busyUntil) && busyUntil > nowMs
          ? busyUntil
          : nowMs + Number(config.unknownBusyMinutes ?? 3) * MINUTE_MS);
      } else {
        availableAt.set(counterId, nowMs);
      }
    }
  }

  // If an order says PREPARING on a missing/inactive counter, surface a warning rather than silently dropping it.
  for (const order of orders) {
    if (order.status === ORDER_STATUS.PREPARING) {
      const id = order.assignedCounterId == null ? null : String(order.assignedCounterId);
      if (!id || !activeCounters.some((counter) => String(counter.counterId ?? counter.id) === id)) {
        counterWarnings.push(`Preparing order ${order.orderId ?? order.id} has no active matching counter.`);
      }
    }
  }

  const waitingOrders = orders
    .filter((order) => ACTIVE_QUEUE_STATUSES.has(order.status))
    .slice()
    .sort(stableOrderSort);
  const blockedOrders = [];

  for (const order of waitingOrders) {
    const orderId = String(order.orderId ?? order.id);
    let prepByCounter = new Map();
    try {
      for (const counter of activeCounters) {
        if (order.status === ORDER_STATUS.ASSIGNED && order.assignedCounterId != null &&
            String(counter.counterId ?? counter.id) !== String(order.assignedCounterId)) continue;
        if (!canUseCounter(counter, order, menuMap)) continue;
        prepByCounter.set(String(counter.counterId ?? counter.id), estimateOrderPrepMinutes(order, menuMap, counter));
      }
    } catch (error) {
      blockedOrders.push({ orderId, reason: error.message });
      schedule[orderId] = { orderId, blockedReason: error.message, estimatedWaitMinutesFromNow: null };
      continue;
    }

    if (prepByCounter.size === 0) {
      const reason = order.status === ORDER_STATUS.ASSIGNED
        ? "Assigned counter is inactive, missing, or cannot prepare every item in this order."
        : "No active counter can prepare every category in this order.";
      blockedOrders.push({ orderId, reason });
      schedule[orderId] = { orderId, blockedReason: reason, estimatedWaitMinutesFromNow: null };
      continue;
    }

    let best = null;
    for (const [counterId, prepMinutes] of prepByCounter) {
      const startAt = Math.max(nowMs, asMs(order.queueEnteredAt, nowMs), availableAt.get(counterId) ?? nowMs);
      const finishAt = startAt + prepMinutes * MINUTE_MS;
      const candidate = { counterId, prepMinutes, startAt, finishAt };
      if (!best || candidate.finishAt < best.finishAt ||
          (candidate.finishAt === best.finishAt && candidate.startAt < best.startAt) ||
          (candidate.finishAt === best.finishAt && candidate.startAt === best.startAt && candidate.counterId.localeCompare(best.counterId) < 0)) {
        best = candidate;
      }
    }

    availableAt.set(best.counterId, best.finishAt);
    const queueEnteredMs = asMs(order.queueEnteredAt, nowMs);
    schedule[orderId] = {
      orderId,
      counterId: best.counterId,
      status: order.status,
      estimatedStartAt: asIso(best.startAt),
      estimatedReadyAt: asIso(best.finishAt),
      estimatedWaitMinutesFromNow: round2(Math.max(0, (best.startAt - nowMs) / MINUTE_MS)),
      estimatedTotalWaitMinutes: round2(Math.max(0, (best.startAt - queueEnteredMs) / MINUTE_MS)),
      estimatedReadyInMinutes: round2(Math.max(0, (best.finishAt - nowMs) / MINUTE_MS)),
      prepMinutes: best.prepMinutes,
    };
  }

  const counterPlan = (Array.isArray(counters) ? counters : []).map((counter) => {
    const counterId = String(counter.counterId ?? counter.id);
    const isActive = counter.isActive !== false && String(counter.status ?? "").toUpperCase() !== "CLOSED";
    const availableMs = availableAt.get(counterId) ?? nowMs;
    const assignedForecasts = Object.values(schedule).filter((item) => item.counterId === counterId && ACTIVE_QUEUE_STATUSES.has(item.status));
    const activeOrder = busyOrderByCounter.get(counterId);
    return {
      counterId,
      name: counter.name ?? counter.counterName ?? counterId,
      isActive,
      currentOrderId: activeOrder ? String(activeOrder.orderId ?? activeOrder.id) : null,
      predictedAvailableAt: isActive ? asIso(availableMs) : null,
      workloadMinutesFromNow: isActive ? round2(Math.max(0, (availableMs - nowMs) / MINUTE_MS)) : 0,
      forecastQueueCount: isActive ? assignedForecasts.length : 0,
      nextOrderId: isActive ? (assignedForecasts.sort((a, b) => asMs(a.estimatedStartAt) - asMs(b.estimatedStartAt))[0]?.orderId ?? null) : null,
    };
  });

  return {
    generatedAt: asIso(nowMs),
    schedule,
    counterPlan,
    blockedOrders,
    warnings: counterWarnings,
    summary: {
      waitingCount: waitingOrders.length,
      preparingCount: orders.filter((order) => order.status === ORDER_STATUS.PREPARING).length,
      blockedCount: blockedOrders.length,
    },
  };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function intersectMinutes(startMs, endMs, windowStartMs, windowEndMs) {
  if (![startMs, endMs].every(Number.isFinite)) return 0;
  return Math.max(0, Math.min(endMs, windowEndMs) - Math.max(startMs, windowStartMs)) / MINUTE_MS;
}

/** Actual measured metrics; keep these separate from predicted values in the UI. */
export function calculateMetrics({ orders = [], counters = [], now = new Date(), windowMinutes = 60 }) {
  const nowMs = asMs(now);
  const windowStart = nowMs - Math.max(1, Number(windowMinutes) || 60) * MINUTE_MS;
  const completed = orders.filter((order) => {
    return order.status === ORDER_STATUS.COMPLETED &&
      Number.isFinite(asMs(order.queueEnteredAt)) && Number.isFinite(asMs(order.serviceStartedAt));
  });
  const waitingValues = completed.map((order) => Math.max(0,
    (asMs(order.serviceStartedAt) - asMs(order.queueEnteredAt)) / MINUTE_MS));
  const turnaroundValues = completed
    .filter((order) => Number.isFinite(asMs(order.readyAt ?? order.completedAt)))
    .map((order) => Math.max(0, (asMs(order.readyAt ?? order.completedAt) - asMs(order.queueEnteredAt)) / MINUTE_MS));
  const completedInWindow = orders.filter((order) => order.status === ORDER_STATUS.COMPLETED && asMs(order.completedAt, -Infinity) >= windowStart && asMs(order.completedAt, -Infinity) <= nowMs).length;
  const currentQueueLength = orders.filter((order) => ACTIVE_QUEUE_STATUSES.has(order.status)).length;
  const preparingCount = orders.filter((order) => order.status === ORDER_STATUS.PREPARING).length;

  const counterUtilisation = counters.map((counter) => {
    const counterId = String(counter.counterId ?? counter.id);
    let busyMinutes = 0;
    for (const order of orders) {
      if (String(order.assignedCounterId ?? "") !== counterId) continue;
      if (![ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.COMPLETED].includes(order.status)) continue;
      const start = asMs(order.serviceStartedAt ?? order.preparationStartedAt, NaN);
      const end = asMs(order.readyAt ?? order.completedAt, order.status === ORDER_STATUS.PREPARING ? nowMs : NaN);
      busyMinutes += intersectMinutes(start, end, windowStart, nowMs);
    }
    return {
      counterId,
      name: counter.name ?? counter.counterName ?? counterId,
      busyMinutes: round2(busyMinutes),
      utilisationPercent: round2(Math.min(100, (busyMinutes / Math.max(1, (nowMs - windowStart) / MINUTE_MS)) * 100)),
    };
  });

  return {
    windowMinutes: Math.max(1, Number(windowMinutes) || 60),
    sampleCompletedOrders: completed.length,
    averageWaitMinutes: waitingValues.length ? round2(waitingValues.reduce((a, b) => a + b, 0) / waitingValues.length) : null,
    maximumWaitMinutes: waitingValues.length ? round2(Math.max(...waitingValues)) : null,
    p90WaitMinutes: percentile(waitingValues, 0.90) === null ? null : round2(percentile(waitingValues, 0.90)),
    averageQueueToReadyMinutes: turnaroundValues.length ? round2(turnaroundValues.reduce((a, b) => a + b, 0) / turnaroundValues.length) : null,
    completedInWindow,
    currentQueueLength,
    preparingCount,
    counterUtilisation,
  };
}

/** Crowd level is calculated from live queue data, not chosen manually by a user. */
export function calculateCrowdLevel({ queuePlan, config = {} }) {
  const waitingCount = Number(queuePlan?.summary?.waitingCount ?? 0);
  const etaValues = Object.values(queuePlan?.schedule ?? {})
    .filter((row) => ACTIVE_QUEUE_STATUSES.has(row.status) && Number.isFinite(row.estimatedWaitMinutesFromNow))
    .map((row) => row.estimatedWaitMinutesFromNow);
  const p90Eta = percentile(etaValues, 0.90) ?? 0;
  const highQueue = Number(config.highQueueThreshold ?? 9);
  const mediumQueue = Number(config.mediumQueueThreshold ?? 4);
  const highEta = Number(config.highWaitThresholdMinutes ?? 15);
  const mediumEta = Number(config.mediumWaitThresholdMinutes ?? 5);

  let level = "LOW";
  if (waitingCount >= highQueue || p90Eta >= highEta) level = "HIGH";
  else if (waitingCount >= mediumQueue || p90Eta >= mediumEta) level = "MEDIUM";
  return { level, waitingCount, p90EstimatedWaitMinutes: round2(p90Eta) };
}

/** Start an order. Call on the backend inside a transaction that also locks the counter. */
export function startOrder({ order, counter, menuItems, activeOrders = [], now = new Date() }) {
  if (!order || ![ORDER_STATUS.QUEUED, ORDER_STATUS.ASSIGNED].includes(order.status)) {
    return { ok: false, error: "Only queued or assigned orders can be started." };
  }
  if (!counter || counter.isActive === false) return { ok: false, error: "Counter is not active." };
  if (!counterCanHandleOrder(counter, order, menuItems)) return { ok: false, error: "This counter cannot prepare every item in the order." };
  const counterId = String(counter.counterId ?? counter.id);
  const alreadyBusy = activeOrders.some((o) => o.status === ORDER_STATUS.PREPARING && String(o.assignedCounterId ?? "") === counterId && String(o.orderId ?? o.id) !== String(order.orderId ?? order.id));
  if (alreadyBusy || String(counter.status ?? "AVAILABLE").toUpperCase() === "BUSY") {
    return { ok: false, error: "Counter is already busy. Refresh the queue and try again." };
  }
  let prepMinutes;
  try {
    prepMinutes = estimateOrderPrepMinutes(order, menuItems, counter);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const startedAt = asMs(now);
  const readyAt = startedAt + prepMinutes * MINUTE_MS;
  return {
    ok: true,
    order: {
      ...order,
      status: ORDER_STATUS.PREPARING,
      assignedCounterId: counterId,
      serviceStartedAt: asIso(startedAt),
      estimatedPrepMinutes: prepMinutes,
      estimatedReadyAt: asIso(readyAt),
    },
  };
}

export function transitionOrder({ order, nextStatus, now = new Date(), note = null }) {
  if (!order) return { ok: false, error: "Order not found." };
  const allowed = {
    [ORDER_STATUS.QUEUED]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.QUEUED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY],
    [ORDER_STATUS.READY]: [ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.COMPLETED]: [],
    [ORDER_STATUS.CANCELLED]: [],
  };
  if (!(allowed[order.status] ?? []).includes(nextStatus)) {
    return { ok: false, error: `Invalid order transition: ${order.status} → ${nextStatus}.` };
  }
  const timestamp = asIso(asMs(now));
  const updated = { ...order, status: nextStatus };
  if (nextStatus === ORDER_STATUS.READY) updated.readyAt = timestamp;
  if (nextStatus === ORDER_STATUS.COMPLETED) updated.completedAt = timestamp;
  if (nextStatus === ORDER_STATUS.CANCELLED) {
    updated.cancelledAt = timestamp;
    updated.cancellationNote = note;
  }
  if (nextStatus === ORDER_STATUS.QUEUED) updated.assignedCounterId = null;
  return { ok: true, order: updated };
}

/**
 * Small deterministic baseline for a fair comparison against an improved strategy.
 * Reuse the same arrival times, items, counters and service estimates for both runs.
 */
export function simulateQueue({ arrivals = [], counters = [], menuItems = [], strategy = "EARLIEST_FINISH", startAt = new Date() }) {
  const startMs = asMs(startAt);
  const menuMap = makeMenuMap(menuItems);
  const readyAtByCounter = new Map(counters.filter((c) => c.isActive !== false).map((c) => [String(c.counterId ?? c.id), startMs]));
  const sorted = arrivals.slice().sort((a, b) => asMs(a.queueEnteredAt, startMs) - asMs(b.queueEnteredAt, startMs) || String(a.orderId ?? a.id).localeCompare(String(b.orderId ?? b.id)));
  const rows = [];

  for (const order of sorted) {
    const arrivedAt = asMs(order.queueEnteredAt, startMs);
    const candidates = [];
    for (const counter of counters.filter((c) => c.isActive !== false)) {
      if (!counterCanHandleOrder(counter, order, menuMap)) continue;
      let prepMinutes;
      try { prepMinutes = estimateOrderPrepMinutes(order, menuMap, counter); }
      catch { continue; }
      const counterId = String(counter.counterId ?? counter.id);
      const starts = Math.max(arrivedAt, readyAtByCounter.get(counterId) ?? startMs);
      const finishes = starts + prepMinutes * MINUTE_MS;
      candidates.push({ counter, counterId, prepMinutes, starts, finishes });
    }
    if (!candidates.length) {
      rows.push({ orderId: String(order.orderId ?? order.id), blocked: true, reason: "No eligible counter." });
      continue;
    }
    candidates.sort((a, b) => {
      if (strategy === "EARLIEST_AVAILABLE") {
        // Baseline: choose the eligible counter that can start this order first.
        return a.starts - b.starts ||
          counters.findIndex((c) => String(c.counterId ?? c.id) === a.counterId) - counters.findIndex((c) => String(c.counterId ?? c.id) === b.counterId);
      }
      if (strategy !== "EARLIEST_FINISH") throw new Error(`Unknown simulation strategy: ${strategy}`);
      return a.finishes - b.finishes || a.starts - b.starts || a.counterId.localeCompare(b.counterId);
    });
    const chosen = candidates[0];
    readyAtByCounter.set(chosen.counterId, chosen.finishes);
    rows.push({
      orderId: String(order.orderId ?? order.id),
      counterId: chosen.counterId,
      arrivalAt: asIso(arrivedAt),
      serviceStartAt: asIso(chosen.starts),
      readyAt: asIso(chosen.finishes),
      waitMinutes: round2(Math.max(0, (chosen.starts - arrivedAt) / MINUTE_MS)),
      turnaroundMinutes: round2(Math.max(0, (chosen.finishes - arrivedAt) / MINUTE_MS)),
      prepMinutes: chosen.prepMinutes,
      blocked: false,
    });
  }

  const completed = rows.filter((r) => !r.blocked);
  const activeCounterList = counters.filter((c) => c.isActive !== false);

  let orderThroughputPerHour = 0;
  let spanMinutes = 1;
  if (completed.length > 0) {
    const startTimes = completed.map((r) => asMs(r.serviceStartAt));
    const finishTimes = completed.map((r) => asMs(r.readyAt));
    const earliestStart = Math.min(...startTimes);
    const latestFinish = Math.max(...finishTimes);
    spanMinutes = Math.max(1, (latestFinish - earliestStart) / MINUTE_MS);
    orderThroughputPerHour = round2((completed.length / spanMinutes) * 60);
  }

  const counterUtilisation = activeCounterList.map((counter) => {
    const counterId = String(counter.counterId ?? counter.id);
    const counterRows = completed.filter((r) => r.counterId === counterId);
    const busyMinutes = counterRows.reduce((sum, r) => sum + (r.prepMinutes || 0), 0);
    const utilisationPercent = round2(Math.min(100, (busyMinutes / spanMinutes) * 100));
    return {
      counterId,
      utilisationPercent,
    };
  });

  return {
    strategy,
    results: rows,
    averageWaitMinutes: completed.length ? round2(completed.reduce((sum, r) => sum + r.waitMinutes, 0) / completed.length) : null,
    maximumWaitMinutes: completed.length ? round2(Math.max(...completed.map((r) => r.waitMinutes))) : null,
    averageTurnaroundMinutes: completed.length ? round2(completed.reduce((sum, r) => sum + r.turnaroundMinutes, 0) / completed.length) : null,
    completedCount: completed.length,
    blockedCount: rows.length - completed.length,
    orderThroughputPerHour,
    counterUtilisation,
  };
}
