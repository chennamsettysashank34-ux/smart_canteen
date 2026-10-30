import test from "node:test";
import assert from "node:assert/strict";
import { store } from "../dist/store.js";

test("API Store: initial seed has users, menu items, counters, and initial orders", () => {
  store.reset();
  const menu = store.getMenu();
  const counters = store.getCounters();
  const orders = store.getOrders();
  const users = store.getUsers();

  assert.equal(menu.length, 4);
  assert.equal(counters.length, 4);
  assert.ok(counters.every((c) => c.name.toLowerCase().includes("take away")));
  assert.equal(orders.length, 0); // KDS queue starts clean with 0 random demo orders
  assert.equal(users.length, 4);

  // M01 Dosa, M02 Sandwich, M03 Tea, M04 Veg Puff (sold out)
  const puff = menu.find((m) => m.itemId === "M04");
  assert.equal(puff.isAvailable, false);
  assert.equal(puff.stockQty, 0);
});

test("API Store: order placement reserves stock and assigns token", () => {
  store.reset();
  const teaBefore = store.getMenuItem("M03").stockQty;

  const result = store.createOrder({
    userId: "U101",
    items: [{ itemId: "M03", quantity: 2 }],
  });

  assert.ok(result.order);
  assert.ok(result.order.tokenNo.startsWith("T"));
  assert.equal(result.order.status, "QUEUED");
  assert.equal(result.order.totalAmount, 30); // 2 * 15

  // Stock deducted
  const teaAfter = store.getMenuItem("M03").stockQty;
  assert.equal(teaAfter, teaBefore - 2);
});

test("API Store: rejects order when item is out of stock or unavailable", () => {
  store.reset();
  assert.throws(
    () => {
      store.createOrder({
        userId: "U101",
        items: [{ itemId: "M04", quantity: 1 }], // Veg puff has 0 stock
      });
    },
    { message: /sold out|is no longer available|Insufficient stock/ }
  );
});

test("API Store: cancellation returns reserved stock to inventory", () => {
  store.reset();
  const sandwichBefore = store.getMenuItem("M02").stockQty;

  const created = store.createOrder({
    userId: "U101",
    items: [{ itemId: "M02", quantity: 2 }],
  });

  assert.equal(store.getMenuItem("M02").stockQty, sandwichBefore - 2);

  const cancelled = store.cancelOrder(created.order.orderId, "Changed my mind");
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancelReason, "Changed my mind");

  // Stock released back
  assert.equal(store.getMenuItem("M02").stockQty, sandwichBefore);
});

test("API Store: staff order transitions update status and counter busy state", () => {
  store.reset();
  const created = store.createOrder({
    userId: "U101",
    items: [{ itemId: "M01", quantity: 1 }], // Dosa (HOT category)
  });

  // Start order at C01 (Hot food counter)
  const started = store.transitionOrderStatus(created.order.orderId, "start", {
    counterId: "C01",
  });
  assert.equal(started.status, "PREPARING");
  assert.ok(started.serviceStartedAt);
  assert.equal(store.getCounter("C01").status, "BUSY");

  // Incompatible counter test: trying to start Dosa at C02 (Snacks & Drinks only)
  assert.throws(
    () => {
      const hotOrder = store.createOrder({
        userId: "U101",
        items: [{ itemId: "M01", quantity: 1 }],
      });
      store.transitionOrderStatus(hotOrder.order.orderId, "start", {
        counterId: "C02",
      });
    },
    { message: /cannot handle the item categories/ }
  );

  // Mark Ready
  const ready = store.transitionOrderStatus(created.order.orderId, "ready");
  assert.equal(ready.status, "READY");
  assert.ok(ready.readyAt);

  // Complete
  const completed = store.transitionOrderStatus(created.order.orderId, "complete");
  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completedAt);
});

test("API Store: live queue calculates metrics, crowd level, and congestion alert", () => {
  store.reset();
  const live = store.getLiveQueueState();
  assert.ok(live.crowd);
  assert.ok(live.metrics);
  assert.ok(Array.isArray(live.waitingOrders));
  assert.ok(Array.isArray(live.counterPlan));
});

test("API Store: demo scenarios switch state cleanly", () => {
  store.reset();
  store.loadScenario("peak");
  const peakLive = store.getLiveQueueState();
  assert.ok(peakLive.waitingOrders.length >= 8);
  assert.equal(peakLive.crowd.isCongested, true);

  store.loadScenario("counter_breakdown");
  const breakdownLive = store.getLiveQueueState();
  const c1 = store.getCounter("C01");
  assert.equal(c1.isActive, false);
  assert.ok(breakdownLive.blockedOrders.length >= 1);
});

test("API Store: simulation benchmark compares baseline and improved strategy", () => {
  store.reset();
  const comparison = store.runComparisonSimulation();
  assert.ok(comparison.baseline);
  assert.ok(comparison.improved);
  assert.ok(Array.isArray(comparison.baseline.counterUtilisation));
  assert.ok(Array.isArray(comparison.improved.counterUtilisation));
  assert.ok(typeof comparison.baseline.orderThroughputPerHour === "number");
  assert.ok(typeof comparison.improved.orderThroughputPerHour === "number");
  assert.ok(typeof comparison.comparison.waitReductionMinutes === "number");
  assert.ok(typeof comparison.comparison.improvementPercent === "number");
});

test("API Store: student login verification via mobile number registered with college portal", () => {
  store.reset();
  // Find registered student by 10-digit phone number
  const studentA = store.findUserByPhone("9876543210");
  assert.ok(studentA);
  assert.equal(studentA.name, "Aarav Sharma");
  assert.equal(studentA.portalVerified, true);
  assert.equal(studentA.collegePortalName, "CBIT Official Portal");

  const studentB = store.findUserByPhone("+91 98765-43211");
  assert.ok(studentB);
  assert.equal(studentB.name, "Ananya Reddy");
});

test("API Store: Cashier Interface diverts orders first and routes to kitchen upon acceptance", () => {
  store.reset();
  const created = store.createOrder({
    userId: "U101",
    items: [{ itemId: "M01", quantity: 1 }],
  });

  // Diverted to Cashier first
  assert.equal(created.order.cashierStatus, "PENDING");
  assert.equal(created.order.isCashierAccepted, false);

  const pending = store.getCashierPendingOrders();
  assert.ok(pending.some((o) => o.orderId === created.order.orderId));

  // Cashier accepts payment (e.g. UPI)
  const accepted = store.actionCashierOrder(created.order.orderId, "ACCEPT", {
    paymentMethod: "UPI",
    notes: "Verified UPI reference TXN9872",
  });

  assert.equal(accepted.cashierStatus, "ACCEPTED");
  assert.equal(accepted.isCashierAccepted, true);
  assert.ok(accepted.cashierAcceptedAt);

  // No longer pending at cashier
  const pendingAfter = store.getCashierPendingOrders();
  assert.ok(!pendingAfter.some((o) => o.orderId === created.order.orderId));
});

test("API Store: Logistics of groceries and food items with renewal reminders", () => {
  store.reset();
  const groceries = store.getGroceries();
  assert.ok(groceries.length >= 6);

  // Check Dosa batter logistics
  const batter = groceries.find((g) => g.name.includes("Dosa Batter"));
  assert.ok(batter);
  assert.equal(batter.unit, "kg");
  assert.equal(batter.renewalUrgent, true); // 4kg is below 8kg threshold!

  // Kitchen staff restocks / renews Dosa batter
  const renewed = store.renewGrocery(batter.groceryId);
  assert.equal(renewed.currentQty, renewed.idealStock); // Restocked to 25kg
  assert.equal(renewed.currentQty > renewed.minThreshold, true);
});

test("API Store: Option to add new items in the canteen and toggle daily specials", () => {
  store.reset();
  const initialCount = store.getMenu().length;

  const newItem = store.addMenuItem({
    name: "Mysore Masala Dosa",
    category: "HOT",
    price: 65,
    prepMinutesPerBatch: 5,
    batchSize: 2,
    stockQty: 25,
    isDailySpecial: true,
    dailySpecialTag: "🌟 Daily Special: Crispy Mysore Podi Dosa",
  });

  assert.ok(newItem.itemId.startsWith("M"));
  assert.equal(newItem.name, "Mysore Masala Dosa");
  assert.equal(newItem.isDailySpecial, true);
  assert.equal(store.getMenu().length, initialCount + 1);

  // Toggle daily special off
  const updated = store.toggleDailySpecial(newItem.itemId, false);
  assert.equal(updated.isDailySpecial, false);
});

test("API Store: Canteen opening and closing schedule (8:30 AM - 5:30 PM with 5:10 PM cutoff)", () => {
  store.reset();

  // Test during normal opening hours (e.g. 11:30 AM)
  store.setSimulatedTime(11, 30);
  const openSchedule = store.getCanteenSchedule();
  assert.equal(openSchedule.isOpen, true);
  assert.equal(openSchedule.isAcceptingOrders, true);
  assert.equal(openSchedule.isClosingSoon, false);

  // Test 20 minutes before closure (e.g. 5:15 PM = 17:15)
  store.setSimulatedTime(17, 15);
  const closingSoonSchedule = store.getCanteenSchedule();
  assert.equal(closingSoonSchedule.isOpen, true);
  assert.equal(closingSoonSchedule.isAcceptingOrders, false); // Stopped accepting orders 20m before closing!
  assert.equal(closingSoonSchedule.isClosingSoon, true); // 15 mins left until 5:30 PM
  assert.equal(closingSoonSchedule.minutesUntilClosing, 15);

  // Test after closure (e.g. 6:00 PM = 18:00)
  store.setSimulatedTime(18, 0);
  const closedSchedule = store.getCanteenSchedule();
  assert.equal(closedSchedule.isOpen, false);
  assert.equal(closedSchedule.isAcceptingOrders, false);

  // Reset simulation
  store.setSimulatedTime(null);
});
