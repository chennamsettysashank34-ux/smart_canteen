import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUS,
  estimateOrderPrepMinutes,
  validateOrderItems,
  createOrderDraft,
  buildQueuePlan,
  calculateMetrics,
  calculateCrowdLevel,
  startOrder,
  transitionOrder,
  simulateQueue,
} from '../src/engine/smartCanteenEngine.mjs';

const now = new Date('2026-10-28T12:00:00.000Z');
const menu = [
  { itemId: 'DOSA', name: 'Dosa', category: 'HOT', price: 40, prepMinutesPerBatch: 4, batchSize: 4, stockQty: 30, isAvailable: true },
  { itemId: 'TEA', name: 'Tea', category: 'DRINK', price: 15, prepMinutesPerBatch: 2, batchSize: 5, stockQty: 50, isAvailable: true },
  { itemId: 'SAND', name: 'Sandwich', category: 'SNACK', price: 50, prepMinutesPerBatch: 6, batchSize: 1, stockQty: 12, isAvailable: true },
  { itemId: 'PUFF', name: 'Veg Puff', category: 'SNACK', price: 20, prepMinutesPerBatch: 2, batchSize: 1, stockQty: 0, isAvailable: false },
];
const counters = [
  { counterId: 'C1', name: 'Hot Food', isActive: true, supportedCategories: ['HOT'], status: 'AVAILABLE' },
  { counterId: 'C2', name: 'Drinks and Snacks', isActive: true, supportedCategories: ['DRINK', 'SNACK'], status: 'AVAILABLE' },
];
const iso = (m) => new Date(now.getTime() + m * 60_000).toISOString();
const order = (id, mins, itemId='DOSA', quantity=1, status=ORDER_STATUS.QUEUED) => ({
  orderId: id, status, queueEnteredAt: iso(mins), items: [{ itemId, quantity }],
});

test('batch calculation uses batch size rather than multiplying every unit', () => {
  assert.equal(estimateOrderPrepMinutes({ items: [{ itemId: 'DOSA', quantity: 4 }] }, menu), 4);
  assert.equal(estimateOrderPrepMinutes({ items: [{ itemId: 'DOSA', quantity: 5 }] }, menu), 8);
});

test('validation rejects sold-out item and accepts available item', () => {
  assert.equal(validateOrderItems([{ itemId: 'PUFF', quantity: 1 }], menu).valid, false);
  assert.equal(validateOrderItems([{ itemId: 'TEA', quantity: 2 }], menu).valid, true);
});

test('draft order records total and queue timestamp', () => {
  const result = createOrderDraft({ orderId: 'O1', tokenNo: 'T1', items: [{ itemId: 'TEA', quantity: 2 }], menuItems: menu, now });
  assert.equal(result.ok, true);
  assert.equal(result.order.totalAmount, 30);
  assert.equal(result.order.status, ORDER_STATUS.QUEUED);
});

test('queue plan routes orders to capable counters and estimates wait', () => {
  const orders = [order('O1', 0, 'DOSA'), order('O2', 1, 'DOSA'), order('O3', 2, 'TEA')];
  const plan = buildQueuePlan({ orders, counters, menuItems: menu, now });
  assert.equal(plan.schedule.O1.counterId, 'C1');
  assert.equal(plan.schedule.O2.counterId, 'C1');
  assert.equal(plan.schedule.O2.estimatedWaitMinutesFromNow, 4);
  assert.equal(plan.schedule.O3.counterId, 'C2');
  assert.equal(plan.blockedOrders.length, 0);
});

test('queue plan clearly blocks order with no capable active counter', () => {
  const plan = buildQueuePlan({ orders: [order('O1', 0, 'DOSA')], counters: [], menuItems: menu, now });
  assert.equal(plan.blockedOrders.length, 1);
  assert.ok(plan.schedule.O1.blockedReason);
});

test('startOrder checks counter compatibility and records preparation time', () => {
  const queued = order('O1', 0, 'DOSA');
  const started = startOrder({ order: queued, counter: counters[0], menuItems: menu, now });
  assert.equal(started.ok, true);
  assert.equal(started.order.status, ORDER_STATUS.PREPARING);
  assert.equal(started.order.estimatedPrepMinutes, 4);
  assert.equal(startOrder({ order: queued, counter: counters[1], menuItems: menu, now }).ok, false);
});

test('valid state transitions and reject invalid transition', () => {
  const preparing = { ...order('O1', 0), status: ORDER_STATUS.PREPARING };
  const ready = transitionOrder({ order: preparing, nextStatus: ORDER_STATUS.READY, now });
  assert.equal(ready.ok, true);
  assert.equal(transitionOrder({ order: preparing, nextStatus: ORDER_STATUS.COMPLETED, now }).ok, false);
});

test('metrics calculate actual waiting time and counter utilisation', () => {
  const completedOrder = {
    orderId: 'O1', status: ORDER_STATUS.COMPLETED, assignedCounterId: 'C1',
    queueEnteredAt: iso(0), serviceStartedAt: iso(3), readyAt: iso(7), completedAt: iso(8),
  };
  const metrics = calculateMetrics({ orders: [completedOrder], counters, now: new Date(now.getTime() + 10 * 60_000), windowMinutes: 60 });
  assert.equal(metrics.averageWaitMinutes, 3);
  assert.equal(metrics.maximumWaitMinutes, 3);
  assert.equal(metrics.completedInWindow, 1);
});

test('crowd level derives from queue and ETA', () => {
  const plan = { summary: { waitingCount: 10 }, schedule: {} };
  assert.equal(calculateCrowdLevel({ queuePlan: plan }).level, 'HIGH');
});

test('simulation returns comparable wait metrics', () => {
  const arrivals = [order('O1', 0, 'DOSA'), order('O2', 0, 'DOSA'), order('O3', 0, 'TEA')];
  const result = simulateQueue({ arrivals, counters, menuItems: menu, startAt: now });
  assert.equal(result.completedCount, 3);
  assert.ok(result.averageWaitMinutes >= 0);
  assert.ok(result.orderThroughputPerHour > 0);
  assert.ok(Array.isArray(result.counterUtilisation));
  assert.equal(result.counterUtilisation.length, counters.length);
});
