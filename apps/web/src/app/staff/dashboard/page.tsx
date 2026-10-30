"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  getLiveQueue,
  getMenu,
  getCounters,
  transitionOrder,
  cancelOrder,
  updateMenuItem,
  updateCounter,
  resetDemoState,
  loadDemoScenario,
  getCashierOrders,
  actionCashierOrder,
  getGroceries,
  restockGrocery,
  consumeGrocery,
  renewGrocery,
  createMenuItem,
  setDailySpecial,
  getCanteenSchedule,
  simulateCanteenSchedule,
  LiveQueueState,
  MenuItem,
  Counter,
  Order,
  GroceryItem,
  CanteenScheduleStatus,
} from "../../../lib/api";

export default function StaffDashboardPage() {
  const [liveQueue, setLiveQueue] = useState<LiveQueueState | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeModal, setActiveModal] = useState<"inventory" | "scenarios" | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [apiOffline, setApiOffline] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Active Main View: Kitchen Display (KDS), Cashier Desk, or Grocery Logistics
  const [activeView, setActiveView] = useState<"kitchen" | "cashier" | "groceries">("kitchen");

  // Cashier State
  const [cashierOrders, setCashierOrders] = useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ [orderId: string]: "CASH" | "UPI" | "COLLEGE_CARD" }>({});
  const [cashierNotes, setCashierNotes] = useState<{ [orderId: string]: string }>({});

  // Grocery Logistics State
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [renewalAlerts, setRenewalAlerts] = useState<GroceryItem[]>([]);

  // Canteen Operating Hours & Schedule State
  const [schedule, setSchedule] = useState<CanteenScheduleStatus | null>(null);

  // Add New Menu Item Form State
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<"HOT" | "SNACK" | "DRINK">("HOT");
  const [newItemPrice, setNewItemPrice] = useState(40);
  const [newItemPrepTime, setNewItemPrepTime] = useState(4);
  const [newItemBatchSize, setNewItemBatchSize] = useState(4);
  const [newItemInitialStock, setNewItemInitialStock] = useState(25);
  const [newItemIsDailySpecial, setNewItemIsDailySpecial] = useState(false);
  const [newItemDailySpecialTag, setNewItemDailySpecialTag] = useState("Chef's Special");
  const [creatingItem, setCreatingItem] = useState(false);

  // Live real-time ticker and alarm states
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(true);

  // 1-second interval to drive real-time preparation timers & alarm checks
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const playAlarmSound = () => {
    if (!alarmSoundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;
      // Synthesize repeating attention-grabbing kitchen alert chime (two high pulses)
      [0, 0.22].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now + offset); // A5 note
        gain.gain.setValueAtTime(0.2, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    } catch (e) {
      console.warn("Audio alarm playback error:", e);
    }
  };

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    try {
      const [queueRes, menuRes, countersRes, cashierRes, groceriesRes, scheduleRes] = await Promise.all([
        getLiveQueue(),
        getMenu(),
        getCounters(),
        getCashierOrders(),
        getGroceries(),
        getCanteenSchedule(),
      ]);
      setLiveQueue(queueRes);
      setMenu(menuRes.menu);
      setCounters(countersRes.counters);
      setCashierOrders(cashierRes.pendingOrders || []);
      setGroceries(groceriesRes.groceries || []);
      setRenewalAlerts(groceriesRes.renewalAlerts || []);
      setSchedule(scheduleRes);
      setApiOffline(false);
    } catch (err: any) {
      setApiOffline(true);
    }
  };

  // Cashier Action Handler (Accept and redirect to kitchen, or reject)
  const handleCashierAction = async (orderId: string, action: "ACCEPT" | "REJECT") => {
    setActionLoading(orderId);
    try {
      const paymentMethod = paymentMethods[orderId] || "CASH";
      const notes = cashierNotes[orderId];
      const res = await actionCashierOrder(orderId, action, { paymentMethod, notes });
      if (action === "ACCEPT") {
        showNotification(`Order ${orderId} accepted! Redirected to Kitchen Preparation line.`);
      } else {
        showNotification(`Order ${orderId} rejected and cancelled.`, "error");
      }
      await loadData();
    } catch (err: any) {
      showNotification(err.message || `Failed to ${action} order`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Grocery Logistics Handlers
  const handleRestockGrocery = async (groceryId: string, addQty: number) => {
    try {
      const res = await restockGrocery(groceryId, addQty);
      showNotification(`Restocked ${res.grocery.name} (+${addQty} ${res.grocery.unit})`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to restock grocery item", "error");
    }
  };

  const handleConsumeGrocery = async (groceryId: string, consumeQty: number) => {
    try {
      const res = await consumeGrocery(groceryId, consumeQty);
      showNotification(`Recorded consumption for ${res.grocery.name} (-${consumeQty} ${res.grocery.unit})`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to record grocery usage", "error");
    }
  };

  const handleRenewGrocery = async (groceryId: string) => {
    try {
      const res = await renewGrocery(groceryId);
      showNotification(`Renewed ${res.grocery.name}! Stock restored to ${res.grocery.currentQty} ${res.grocery.unit}.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to renew grocery item", "error");
    }
  };

  // Daily Special Toggle Handler
  const handleToggleDailySpecial = async (itemId: string, currentStatus: boolean, tag?: string) => {
    try {
      const nextStatus = !currentStatus;
      await setDailySpecial(itemId, nextStatus, tag || "Chef's Special");
      showNotification(`Daily special updated for item.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update daily special", "error");
    }
  };

  // Add New Menu Item Handler
  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      showNotification("Please enter item name", "error");
      return;
    }
    setCreatingItem(true);
    try {
      await createMenuItem({
        name: newItemName.trim(),
        category: newItemCategory,
        price: Number(newItemPrice),
        prepMinutesPerBatch: Number(newItemPrepTime),
        batchSize: Number(newItemBatchSize),
        stockQty: Number(newItemInitialStock),
        isDailySpecial: newItemIsDailySpecial,
        dailySpecialTag: newItemIsDailySpecial ? newItemDailySpecialTag : undefined,
      });
      showNotification(`Added new item "${newItemName}" to canteen menu!`);
      setShowAddItemForm(false);
      setNewItemName("");
      setNewItemPrice(40);
      setNewItemInitialStock(25);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to create menu item", "error");
    } finally {
      setCreatingItem(false);
    }
  };

  // Schedule Simulation Handler
  const handleSimulateSchedule = async (preset: "live" | "closing_soon" | "closed") => {
    try {
      if (preset === "live") {
        await simulateCanteenSchedule({ reset: true });
        showNotification("Reset to live system clock.");
      } else if (preset === "closing_soon") {
        // 5:12 PM (17:12) -> within 20 mins of 5:30 PM, order cutoff active
        await simulateCanteenSchedule({ hour: 17, minute: 12, enforceSchedule: true });
        showNotification("Simulating 5:12 PM (20-min closing notice & order cutoff active).");
      } else if (preset === "closed") {
        // 5:45 PM (17:45) -> closed
        await simulateCanteenSchedule({ hour: 17, minute: 45, enforceSchedule: true });
        showNotification("Simulating 5:45 PM (Canteen Closed).");
      }
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update schedule simulation", "error");
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Compute overdue preparing orders
  const overduePreparingOrders = useMemo(() => {
    if (!liveQueue || currentTime === 0) return [];
    return liveQueue.activePreparingOrders.filter((ord) => {
      if (!ord.serviceStartedAt) return false;
      const startMs = new Date(ord.serviceStartedAt).getTime();
      const targetMs = startMs + (ord.estimatedPrepMinutes || 2) * 60000;
      return currentTime >= targetMs;
    });
  }, [liveQueue?.activePreparingOrders, currentTime]);

  // Periodic alarm sound when one or more preparing orders are overdue
  useEffect(() => {
    if (overduePreparingOrders.length === 0 || !alarmSoundEnabled) return;
    playAlarmSound();
    const alarmInterval = setInterval(() => {
      playAlarmSound();
    }, 4500);
    return () => clearInterval(alarmInterval);
  }, [overduePreparingOrders.length, alarmSoundEnabled]);

  // Real-time preparation countdown helper
  const getPrepCountdown = (serviceStartedAt?: string | null, estimatedPrepMinutes?: number | null) => {
    const prepMins = estimatedPrepMinutes || 2;
    if (!serviceStartedAt || currentTime === 0) {
      return { remainingSeconds: 0, isOverdue: false, formatted: "00:00", progressPct: 0 };
    }
    const startMs = new Date(serviceStartedAt).getTime();
    const totalMs = prepMins * 60000;
    const targetMs = startMs + totalMs;
    const diffMs = targetMs - currentTime;
    const diffSeconds = Math.round(diffMs / 1000);
    const elapsedMs = currentTime - startMs;
    const progressPct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

    if (diffSeconds > 0) {
      const mins = Math.floor(diffSeconds / 60);
      const secs = diffSeconds % 60;
      const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      return { remainingSeconds: diffSeconds, isOverdue: false, formatted, progressPct };
    } else {
      const overdueSecs = Math.abs(diffSeconds);
      const mins = Math.floor(overdueSecs / 60);
      const secs = overdueSecs % 60;
      const formatted = `+${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      return { remainingSeconds: diffSeconds, isOverdue: true, formatted, progressPct: 100 };
    }
  };

  // Staff Transitions
  const handleStartOrder = async (orderId: string, preferredCounterId?: string) => {
    setActionLoading(orderId);
    try {
      await transitionOrder(orderId, "start", { counterId: preferredCounterId });
      showNotification(`Order ${orderId} started successfully.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to start order", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await transitionOrder(orderId, "ready");
      showNotification(`Order ${orderId} marked READY for collection!`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to mark ready", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await transitionOrder(orderId, "complete");
      showNotification(`Order ${orderId} COMPLETED. Actual wait time recorded!`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to complete order", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelayOrder = async (orderId: string, minutes: number = 3) => {
    setActionLoading(orderId);
    try {
      await transitionOrder(orderId, "delay", {
        delayMinutes: minutes,
        delayReason: `Kitchen prep extended (+${minutes}m)`,
      });
      showNotification(`Extended delay (+${minutes}m) for order ${orderId}`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to flag delay", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Cashier Cancellation Authority (Requirement 4)
  const handleCashierCancelActiveOrder = async (orderId: string, defaultReason?: string) => {
    const reason = window.prompt(
      `Confirm Cashier Cancellation for Order ${orderId}.\nStock will be returned to inventory.\nEnter cancellation reason:`,
      defaultReason || "Customer requested cancellation & refund at Cashier desk"
    );
    if (!reason) return;
    setActionLoading(orderId);
    try {
      await cancelOrder(orderId, reason);
      showNotification(`Order ${orderId} cancelled & stock refunded at Cashier Desk.`, "success");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to cancel order", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Counter management
  const handleToggleCounterStatus = async (counter: Counter) => {
    try {
      const nextActive = !counter.isActive;
      const nextStatus = nextActive ? "AVAILABLE" : "PAUSED";
      await updateCounter(counter.counterId, {
        isActive: nextActive,
        status: nextStatus,
      });
      showNotification(`Counter ${counter.name} ${nextActive ? "resumed" : "paused"}.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update counter", "error");
    }
  };

  // Stock management
  const handleAdjustStock = async (itemId: string, delta: number) => {
    const item = menu.find((m) => m.itemId === itemId);
    if (!item) return;
    const newStock = Math.max(0, item.stockQty + delta);
    try {
      await updateMenuItem(itemId, { stockQty: newStock });
      showNotification(`Updated ${item.name} stock to ${newStock}`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update stock", "error");
    }
  };

  const handleToggleItemAvailability = async (itemId: string, current: boolean) => {
    try {
      await updateMenuItem(itemId, { isAvailable: !current });
      showNotification(`Item availability updated.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to toggle availability", "error");
    }
  };

  // Scenario Loader
  const handleLoadScenario = async (scenarioId: "low" | "peak" | "counter_breakdown") => {
    try {
      await loadDemoScenario(scenarioId);
      showNotification(`Scenario "${scenarioId.toUpperCase()}" loaded successfully!`);
      setActiveModal(null);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to load scenario", "error");
    }
  };

  const handleResetDemo = async () => {
    if (!confirm("Reset entire system to initial demo state?")) return;
    try {
      await resetDemoState();
      showNotification("System state reset to Hackathon fixtures!");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to reset demo", "error");
    }
  };

  // Aggregate all orders for the queue board — deduplicate by orderId to prevent React key warnings
  const allOrdersList = useMemo(() => {
    if (!liveQueue) return [];
    const seen = new Set<string>();
    const list: Array<Order & { queuePosition?: number; blockedReason?: string; elapsedMinutes: number }> = [];

    const withElapsed = (ord: Order) => {
      if (seen.has(ord.orderId)) return null;
      // Requirement 2: Divert to Cashier Desk first; redirected to kitchen only after cashier accepts
      if (ord.cashierStatus === "PENDING") return null;
      seen.add(ord.orderId);
      const entered = ord.queueEnteredAt ? new Date(ord.queueEnteredAt).getTime() : currentTime;
      const elapsedMinutes = currentTime > 0 ? Math.max(0, Math.round((currentTime - entered) / 60000)) : 0;
      return { ...ord, elapsedMinutes };
    };

    liveQueue.waitingOrders.forEach((o) => { const r = withElapsed(o); if (r) list.push(r); });
    liveQueue.activePreparingOrders.forEach((o) => { const r = withElapsed(o); if (r) list.push(r); });
    liveQueue.readyOrders.forEach((o) => { const r = withElapsed(o); if (r) list.push(r); });
    liveQueue.completedOrders.forEach((o) => { const r = withElapsed(o); if (r) list.push(r); });

    if (statusFilter === "ALL") return list;
    return list.filter((o) => o.status === statusFilter);
  }, [liveQueue, statusFilter, currentTime]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#0F172A] flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold transition-all ${
            notification.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Top Header & Navigation */}
      <header className="border-b border-orange-100 bg-white/95 backdrop-blur px-6 py-3.5 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <h1 className="font-black text-base text-[#0F172A] tracking-tight">Kitchen Display System (KDS)</h1>
              </div>
              <p className="text-xs text-stone-500">Staff Console · Dynamic Queue & Multi-Counter Balancer</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Canteen Schedule Pill & Simulator (Requirements 6, 7, 8) */}
            {schedule && (
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-xl text-xs">
                <span className="text-xs">🕒</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-stone-700 hidden lg:inline">Canteen: 8:30 AM – 5:30 PM</span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                      !schedule.isOpen
                        ? "bg-rose-600 text-white"
                        : schedule.isClosingSoon
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {!schedule.isOpen ? "Closed" : schedule.isClosingSoon ? "Closing Soon (Cutoff Active)" : "Open"}
                  </span>
                </div>

                {/* Simulation Dropdown */}
                <select
                  aria-label="Simulate Canteen Clock Time"
                  value={schedule.simulatedTimeStr ? schedule.simulatedTimeStr : "live"}
                  onChange={(e) => {
                    if (e.target.value === "live") handleSimulateSchedule("live");
                    else if (e.target.value === "17:12") handleSimulateSchedule("closing_soon");
                    else if (e.target.value === "17:45") handleSimulateSchedule("closed");
                  }}
                  className="text-[11px] font-bold bg-white border border-orange-200 text-orange-950 rounded-lg px-2 py-0.5 outline-none cursor-pointer"
                >
                  <option value="live">Live Time</option>
                  <option value="17:12">5:12 PM (Cutoff / 20m Notice)</option>
                  <option value="17:45">5:45 PM (Closed)</option>
                </select>
              </div>
            )}

            <button
              onClick={() => setActiveModal("inventory")}
              className="px-3 py-1.5 bg-white hover:bg-orange-50 border border-orange-200 text-stone-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📦</span>
              <span>Stock & Menu</span>
            </button>
            <button
              onClick={() => setActiveModal("scenarios")}
              className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>Demo Scenarios</span>
            </button>
            <Link
              href="/analytics"
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📊</span>
              <span>Simulator</span>
            </Link>
            {/* Audio Alarm Controller */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl text-xs">
              <button
                onClick={() => setAlarmSoundEnabled(!alarmSoundEnabled)}
                className={`flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-lg transition-all ${
                  alarmSoundEnabled
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-stone-200 text-stone-600"
                }`}
                title={alarmSoundEnabled ? "Alarm audio chime is active" : "Alarm audio chime is muted"}
              >
                <span>{alarmSoundEnabled ? "🔔 Alarm: ON" : "🔕 MUTED"}</span>
              </button>
            </div>

            <button
              onClick={handleResetDemo}
              className="px-2.5 py-1.5 bg-stone-100 hover:bg-rose-50 hover:border-rose-300 text-stone-600 hover:text-rose-700 border border-stone-200 text-xs font-semibold rounded-xl transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-6 w-full space-y-6">
        {/* Navigation Mode Switcher: Kitchen Display (KDS), Cashier Desk, Grocery Logistics */}
        <div className="flex bg-stone-200/80 p-1.5 rounded-2xl text-xs font-bold gap-1.5 shadow-xs">
          <button
            onClick={() => setActiveView("kitchen")}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeView === "kitchen"
                ? "bg-white text-[#0F172A] shadow-sm font-black"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <span>🍳 Kitchen Display (KDS)</span>
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px]">
              {allOrdersList.length} active
            </span>
          </button>

          <button
            onClick={() => setActiveView("cashier")}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              activeView === "cashier"
                ? "bg-white text-[#0F172A] shadow-sm font-black"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <span>💵 Cashier Desk & Forwarding</span>
            {cashierOrders.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] animate-pulse">
                {cashierOrders.length} pending
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 text-[10px]">
                0 pending
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView("groceries")}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              activeView === "groceries"
                ? "bg-white text-[#0F172A] shadow-sm font-black"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <span>📦 Grocery Logistics & Renewal</span>
            {renewalAlerts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] animate-pulse">
                {renewalAlerts.length} renewal alert{renewalAlerts.length > 1 ? "s" : ""}
              </span>
            )}
          </button>
        </div>

        {/* API Offline Banner */}
        {apiOffline && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-2xl p-4 flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <span>Connecting to Backend API on <code>http://localhost:4000</code>... (Please ensure <code>npm run dev:api</code> is running)</span>
            </div>
            <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">Retrying</span>
          </div>
        )}

        {/* Kitchen Preparation Overdue Alarm Banner */}
        {overduePreparingOrders.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-500 text-rose-900 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse ring-2 ring-rose-400/50">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-3xl animate-bounce">🚨</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-rose-800">
                    KITCHEN ALARM: {overduePreparingOrders.length} Order(s) Overdue!
                  </h3>
                  <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full uppercase">
                    Preparation Time Up
                  </span>
                </div>
                <p className="text-xs text-rose-700 mt-0.5">
                  Target preparation time has expired for:{" "}
                  <strong className="text-rose-900 font-black">
                    {overduePreparingOrders.map((o) => `Token #${o.tokenNo}`).join(", ")}
                  </strong>
                  . Please extend delay or mark ready for collection immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {overduePreparingOrders.length === 1 && (
                <>
                  <button
                    onClick={() => handleDelayOrder(overduePreparingOrders[0].orderId, 2)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow transition-all"
                  >
                    +2m Delay
                  </button>
                  <button
                    onClick={() => handleDelayOrder(overduePreparingOrders[0].orderId, 5)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow transition-all"
                  >
                    +5m Delay
                  </button>
                  <button
                    onClick={() => handleMarkReady(overduePreparingOrders[0].orderId)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow transition-all"
                  >
                    Mark Ready
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active View: Kitchen Display (KDS) */}
        {activeView === "kitchen" && (
          <>
            {/* Congestion Alert Banner */}
            {liveQueue?.crowd.isCongested && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <strong className="font-bold">Congestion Warning: </strong>
                    <span>{liveQueue.crowd.congestionMessage || "Peak kitchen queue reached."}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-black uppercase text-[10px]">
                  {liveQueue.crowd.level} Crowd
                </span>
              </div>
            )}

        {/* Real-time KPI Bar (P0 Hackathon Acceptance Conditions) */}
        {liveQueue && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-stone-500">Customers Waiting</span>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {liveQueue.waitingOrders.length}
              </p>
              <span className="text-[10px] text-stone-400">In active queue</span>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-stone-500">Preparing Orders</span>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {liveQueue.activePreparingOrders.length}
              </p>
              <span className="text-[10px] text-stone-400">Across counters</span>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-stone-500">Measured Avg Wait</span>
              <p className="text-2xl font-black text-[#0F172A] mt-1">
                {liveQueue.metrics.averageWaitMinutes !== null
                  ? `${liveQueue.metrics.averageWaitMinutes}m`
                  : "—"}
              </p>
              <span className="text-[10px] text-stone-400">Service start − queue entry</span>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-stone-500">Maximum Wait</span>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {liveQueue.metrics.maximumWaitMinutes !== null
                  ? `${liveQueue.metrics.maximumWaitMinutes}m`
                  : "—"}
              </p>
              <span className="text-[10px] text-stone-400">Largest individual wait</span>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-stone-500">Completed Orders</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {liveQueue.metrics.completedInWindow}
              </p>
              <span className="text-[10px] text-stone-400">In 60-min window</span>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-2xl p-3.5 shadow-sm">
              <span className="text-[11px] uppercase font-bold text-stone-500">Crowd Level</span>
              <p
                className={`text-xl font-black uppercase mt-1 ${
                  liveQueue.crowd.level === "LOW"
                    ? "text-emerald-600"
                    : liveQueue.crowd.level === "MODERATE"
                    ? "text-amber-600"
                    : "text-rose-600"
                }`}
              >
                {liveQueue.crowd.level}
              </p>
              <span className="text-[10px] text-stone-400">Score: {liveQueue.crowd.score}</span>
            </div>
          </section>
        )}

        {/* Counter Cards Grid (Requirements 1 & 2: 4 TAKE AWAY Counters & Live Dynamic Parameters) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-2">
              <span>🥡 4 TAKE AWAY Service Counters &amp; Workload Balancer</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                Live Dynamic Sync
              </span>
            </h2>
            <span className="text-xs text-stone-500">Autonomous category routing &amp; workload distribution</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {counters.map((counter) => {
              const forecast = liveQueue?.counterPlan.find((cp) => cp.counterId === counter.counterId);
              const activePreparingOrder = (liveQueue?.activePreparingOrders || []).find(
                (o) => o.assignedCounterId === counter.counterId
              );
              const queuedOrdersForCounter = (liveQueue?.waitingOrders || []).filter(
                (o) => o.assignedCounterId === counter.counterId
              );
              const utilisation = liveQueue?.metrics.counterUtilisation.find(
                (u) => u.counterId === counter.counterId
              );

              const isPaused = !counter.isActive || counter.status === "PAUSED" || counter.status === "CLOSED";
              const isBusy = Boolean(activePreparingOrder);
              const displayStatus = isPaused ? "PAUSED" : isBusy ? "BUSY" : "AVAILABLE";

              const prepCountdown = activePreparingOrder
                ? getPrepCountdown(activePreparingOrder.serviceStartedAt, activePreparingOrder.estimatedPrepMinutes)
                : null;

              return (
                <div
                  key={counter.counterId}
                  className={`border rounded-2xl p-4 shadow-sm transition-all space-y-3 bg-white flex flex-col justify-between ${
                    isPaused
                      ? "bg-stone-50 border-stone-200 opacity-60"
                      : isBusy
                      ? "border-amber-300 ring-2 ring-amber-200 bg-amber-50/15"
                      : "border-stone-200/90"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-mono">
                            {counter.counterId}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                            Take Away
                          </span>
                        </div>
                        <h3 className="font-extrabold text-sm text-[#0F172A] mt-1.5 leading-tight">{counter.name}</h3>
                        <p className="text-[11px] text-stone-500 mt-1">
                          Handles:{" "}
                          <span className="text-stone-800 font-semibold">
                            {counter.supportedCategories.join(", ")}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isPaused
                              ? "bg-stone-200 text-stone-600"
                              : isBusy
                              ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}
                        >
                          {displayStatus}
                        </span>
                        <button
                          onClick={() => handleToggleCounterStatus(counter)}
                          className="text-[11px] px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-semibold border border-stone-200 transition-all"
                        >
                          {counter.isActive ? "Pause" : "Resume"}
                        </button>
                      </div>
                    </div>

                    {/* Live Parameters (Requirement 2) */}
                    <div className="space-y-2 bg-[#FAF8F5] rounded-xl p-2.5 text-xs border border-orange-100/70">
                      <div>
                        <span className="text-stone-500 text-[10px] uppercase font-bold block">
                          Current Preparing Order
                        </span>
                        {activePreparingOrder ? (
                          <div className="mt-1">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-[#0F172A] text-sm">
                                Token #{activePreparingOrder.tokenNo}
                              </span>
                              {prepCountdown && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                    prepCountdown.isOverdue
                                      ? "bg-rose-100 text-rose-700 animate-pulse"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {prepCountdown.formatted}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-600 truncate mt-0.5" title={activePreparingOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}>
                              {activePreparingOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                            </p>
                          </div>
                        ) : (
                          <p className="font-semibold text-stone-400 text-[11px] mt-0.5">
                            None (Idle - Ready for next order)
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-orange-100">
                        <div>
                          <span className="text-stone-500 text-[10px] uppercase font-bold block">
                            Assigned Queue
                          </span>
                          <p className="font-black text-amber-700 text-sm mt-0.5">
                            {queuedOrdersForCounter.length} {queuedOrdersForCounter.length === 1 ? "order" : "orders"}
                          </p>
                          {queuedOrdersForCounter.length > 0 && (
                            <p className="text-[10px] text-amber-600 font-mono truncate" title={queuedOrdersForCounter.map((o) => `#${o.tokenNo}`).join(", ")}>
                              {queuedOrdersForCounter.map((o) => `#${o.tokenNo}`).join(", ")}
                            </p>
                          )}
                        </div>

                        <div>
                          <span className="text-stone-500 text-[10px] uppercase font-bold block">
                            Utilisation
                          </span>
                          <p className="font-black text-blue-700 text-sm mt-0.5">
                            {utilisation?.utilisationPercent !== undefined
                              ? `${utilisation.utilisationPercent.toFixed(1)}%`
                              : "0.0%"}
                          </p>
                          <p className="text-[10px] text-stone-500">
                            Workload: ~{forecast?.workloadMinutesFromNow || 0}m
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Orders Board */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Kitchen Orders Stream ({allOrdersList.length})
            </h2>

            {/* Filter Tabs */}
            <div className="flex bg-orange-50/70 border border-orange-200 p-1 rounded-xl text-xs font-bold">
              {["ALL", "QUEUED", "PREPARING", "READY", "COMPLETED"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    statusFilter === tab
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Cards Grid */}
          {allOrdersList.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
              <span className="text-4xl block">✨</span>
              <h3 className="font-extrabold text-base text-stone-800">
                {statusFilter === "ALL" ? "Kitchen Display is Clear" : `No ${statusFilter} orders in queue`}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {statusFilter === "ALL"
                  ? "Zero orders in queue. Live orders placed from the Student Portal or Guest QR screen will appear here in real-time."
                  : `There are currently no orders with status "${statusFilter}".`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allOrdersList.map((ord, orderIdx) => {
                const isBlocked = Boolean(ord.blockedReason);
                const isPreparing = ord.status === "PREPARING";
                const prepCountdown = isPreparing
                  ? getPrepCountdown(ord.serviceStartedAt, ord.estimatedPrepMinutes)
                  : null;
                const isOverdue = prepCountdown?.isOverdue ?? false;

                return (
                  <div
                    key={`${ord.orderId}-${orderIdx}`}
                    className={`bg-white border rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                      isBlocked
                        ? "border-rose-400 bg-rose-50/40"
                        : isOverdue
                        ? "border-2 border-rose-500 bg-rose-50/40 shadow-lg shadow-rose-100 ring-2 ring-rose-400/50 animate-pulse"
                        : isPreparing
                        ? "border-blue-300 bg-blue-50/15 shadow-sm"
                        : ord.status === "READY"
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-stone-200 hover:border-orange-200"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-[#0F172A]">Token #{ord.tokenNo}</span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                ord.status === "QUEUED"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : isOverdue
                                  ? "bg-rose-600 text-white font-black animate-pulse"
                                  : ord.status === "PREPARING"
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : ord.status === "READY"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse"
                                  : ord.status === "COMPLETED"
                                  ? "bg-stone-100 text-stone-500 border border-stone-200"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {isOverdue ? "TIME EXPIRED" : ord.status}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Customer:{" "}
                            <span className="text-stone-800 font-semibold">
                              {ord.guestName || ord.userId || "Student"}
                            </span>{" "}
                            · {ord.elapsedMinutes}m ago
                          </p>
                        </div>

                        <span className="font-extrabold text-sm text-stone-800">₹{ord.totalAmount}</span>
                      </div>

                      {/* Items */}
                      <div className="bg-[#FAF8F5] border border-stone-200/80 rounded-xl p-2.5 space-y-1 text-xs text-stone-800">
                        {ord.items.map((it, itemIdx) => (
                          <div key={`${ord.orderId}-${it.orderItemId || it.itemId}-${itemIdx}`} className="flex justify-between text-stone-700">
                            <span className="font-medium">
                              {it.quantity}x {it.name}
                            </span>
                            <span className="text-stone-400 text-[11px]">
                              ⏱ {it.itemPrepMinutes}m prep
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Real-time Preparation Countdown & Alarm Badge */}
                      {isPreparing && prepCountdown && (
                        <>
                          {isOverdue ? (
                            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs">
                                  <span className="text-base animate-bounce">🚨</span>
                                  <span>PREP TIME EXPIRED ({prepCountdown.formatted})</span>
                                </div>
                                <span className="text-[10px] uppercase font-black bg-rose-600 text-white px-2 py-0.5 rounded shadow">
                                  Alarm Active
                                </span>
                              </div>
                              <p className="text-[11px] text-rose-700">
                                Target prep time exceeded! Extend delay or mark ready:
                              </p>
                              <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[11px] font-bold text-stone-600">Extend:</span>
                                <button
                                  onClick={() => handleDelayOrder(ord.orderId, 2)}
                                  disabled={actionLoading === ord.orderId}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg shadow transition-all"
                                >
                                  +2m
                                </button>
                                <button
                                  onClick={() => handleDelayOrder(ord.orderId, 3)}
                                  disabled={actionLoading === ord.orderId}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg shadow transition-all"
                                >
                                  +3m
                                </button>
                                <button
                                  onClick={() => handleDelayOrder(ord.orderId, 5)}
                                  disabled={actionLoading === ord.orderId}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg shadow transition-all"
                                >
                                  +5m
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                                  <span className="text-sm">⏱️</span>
                                  <span>Prep Countdown:</span>
                                  <span className="font-black text-blue-950 font-mono text-sm tracking-wider">
                                    {prepCountdown.formatted}
                                  </span>
                                </div>
                                <span className="text-[11px] text-stone-500 font-semibold">
                                  Target: {ord.estimatedPrepMinutes || 2}m
                                </span>
                              </div>
                              <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full transition-all duration-1000 rounded-full"
                                  style={{ width: `${prepCountdown.progressPct}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] pt-0.5">
                                <span className="text-stone-500">Add kitchen time:</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleDelayOrder(ord.orderId, 2)}
                                    disabled={actionLoading === ord.orderId}
                                    className="px-2 py-0.5 bg-white hover:bg-amber-50 hover:text-amber-800 border border-stone-200 text-stone-700 text-[10px] font-bold rounded shadow-xs transition-all"
                                  >
                                    +2m
                                  </button>
                                  <button
                                    onClick={() => handleDelayOrder(ord.orderId, 3)}
                                    disabled={actionLoading === ord.orderId}
                                    className="px-2 py-0.5 bg-white hover:bg-amber-50 hover:text-amber-800 border border-stone-200 text-stone-700 text-[10px] font-bold rounded shadow-xs transition-all"
                                  >
                                    +3m
                                  </button>
                                  <button
                                    onClick={() => handleDelayOrder(ord.orderId, 5)}
                                    disabled={actionLoading === ord.orderId}
                                    className="px-2 py-0.5 bg-white hover:bg-amber-50 hover:text-amber-800 border border-stone-200 text-stone-700 text-[10px] font-bold rounded shadow-xs transition-all"
                                  >
                                    +5m
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Blocked or Delayed warning */}
                      {isBlocked && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg p-2 font-medium">
                          ⚠️ {ord.blockedReason}
                        </div>
                      )}

                      {ord.isDelayed && !isOverdue && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-lg p-2 font-medium">
                          ⏳ Delay Reported: {ord.delayReason}
                        </div>
                      )}

                      {/* Assigned counter & wait metadata */}
                      <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                        <span>
                          Target:{" "}
                          <strong className="text-stone-800">
                            {ord.assignedCounterId || "Auto-balancing"}
                          </strong>
                        </span>
                        {ord.queuePosition && (
                          <span className="text-amber-700 font-bold">Queue #{ord.queuePosition}</span>
                        )}
                      </div>
                    </div>

                    {/* Operational Action Buttons (Requirement 3: Kitchen has ONLY Done or Delay options; NO Cancellation) */}
                    <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                      {ord.status === "QUEUED" && (
                        <>
                          <button
                            onClick={() => handleStartOrder(ord.orderId, ord.assignedCounterId || undefined)}
                            disabled={actionLoading === ord.orderId || !!ord.blockedReason}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
                          >
                            {ord.blockedReason ? "⚠️ Blocked" : `Start Prep ${ord.assignedCounterId ? `(${ord.assignedCounterId})` : ""}`}
                          </button>
                          {counters.map((c) => (
                            <button
                              key={c.counterId}
                              onClick={() => handleStartOrder(ord.orderId, c.counterId)}
                              disabled={actionLoading === ord.orderId || !c.isActive}
                              className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:bg-stone-50 disabled:text-stone-300 text-stone-700 font-bold text-[11px] rounded-lg border border-stone-200 transition-all"
                              title={`Force start at ${c.name}`}
                            >
                              {c.counterId}
                            </button>
                          ))}
                        </>
                      )}

                      {ord.status === "PREPARING" && (
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={() => handleMarkReady(ord.orderId)}
                            disabled={actionLoading === ord.orderId}
                            className={`flex-1 py-2 font-black text-xs rounded-xl shadow transition-all ${
                              isOverdue
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            ✓ Done (Mark Ready)
                          </button>
                          <button
                            onClick={() => handleDelayOrder(ord.orderId, 2)}
                            disabled={actionLoading === ord.orderId}
                            className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl"
                            title="Extend delay by 2 minutes"
                          >
                            +2m Delay
                          </button>
                          <button
                            onClick={() => handleDelayOrder(ord.orderId, 3)}
                            disabled={actionLoading === ord.orderId}
                            className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl"
                            title="Extend delay by 3 minutes"
                          >
                            +3m Delay
                          </button>
                          <button
                            onClick={() => handleDelayOrder(ord.orderId, 5)}
                            disabled={actionLoading === ord.orderId}
                            className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl"
                            title="Extend delay by 5 minutes"
                          >
                            +5m Delay
                          </button>
                        </div>
                      )}

                      {ord.status === "READY" && (
                        <button
                          onClick={() => handleCompleteOrder(ord.orderId)}
                          disabled={actionLoading === ord.orderId}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg transition-all shadow-sm"
                        >
                          ✓ Customer Collected (Done)
                        </button>
                      )}

                      {ord.status === "COMPLETED" && (
                        <span className="text-[11px] text-stone-500 font-semibold w-full text-center">
                          Completed at {new Date(ord.completedAt || ord.queueEnteredAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </>
      )}

      {/* Active View: Cashier Desk Interface (Requirement 2) */}
      {activeView === "cashier" && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-lg text-[#0F172A] flex items-center gap-2">
                  <span>💵 Cashier Desk &amp; Payment Forwarding</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                    Stage 1 (Cashier First)
                  </span>
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Orders placed by Students and Guests divert here first. Verify billing payment mode, then click &quot;Accept &amp; Forward to Kitchen&quot; to redirect the order into the kitchen preparation line.
                </p>
              </div>
              <span className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl self-start sm:self-center">
                {cashierOrders.length} Pending Approval
              </span>
            </div>
          </div>

          {cashierOrders.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center space-y-3">
              <span className="text-4xl">💳</span>
              <h3 className="font-black text-base text-[#0F172A]">All Incoming Orders Verified!</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                No orders waiting at cashier desk. When a student or guest places a new order, it appears here first for payment verification before sending to the kitchen display.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cashierOrders.map((ord) => {
                const currentMethod = paymentMethods[ord.orderId] || "CASH";
                return (
                  <div
                    key={ord.orderId}
                    className="bg-white border-2 border-amber-300 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                            Incoming Order
                          </span>
                          <h3 className="text-2xl font-black text-[#0F172A]">
                            Token #{ord.tokenNo}
                          </h3>
                          <p className="text-xs text-stone-400 font-mono mt-0.5">Order ID: {ord.orderId}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-black text-xs rounded-full uppercase">
                          Awaiting Cashier
                        </span>
                      </div>

                      {/* Customer Details */}
                      <div className="bg-stone-50 rounded-2xl p-3 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-stone-800">
                          <span>Customer:</span>
                          <span>{ord.guestName || (ord.userId ? `Student (${ord.userId})` : "Guest Customer")}</span>
                        </div>
                        <div className="flex justify-between text-stone-500 text-[11px]">
                          <span>Channel:</span>
                          <span className="font-semibold">{ord.guestName ? "Guest QR Screen" : "Student Web App"}</span>
                        </div>
                        <div className="flex justify-between text-stone-500 text-[11px]">
                          <span>Placed at:</span>
                          <span>{new Date(ord.queueEnteredAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Item lines */}
                      <div className="space-y-1.5 text-xs">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-stone-400">
                          Ordered Items:
                        </span>
                        <div className="divide-y divide-stone-100">
                          {ord.items.map((item) => (
                            <div key={item.orderItemId} className="py-1 flex justify-between">
                              <span className="font-semibold text-stone-800">
                                {item.quantity}x {item.name}
                              </span>
                              <span className="font-bold text-stone-700">₹{item.quantity * item.unitPrice}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center text-sm font-black text-[#0F172A]">
                          <span>Total Payable:</span>
                          <span className="text-lg text-orange-600">₹{ord.totalAmount}</span>
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div className="space-y-1.5 text-xs">
                        <span className="font-bold text-stone-700 block">Payment Method Verified:</span>
                        <div className="grid grid-cols-3 gap-2">
                          {(["CASH", "UPI", "COLLEGE_CARD"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPaymentMethods((prev) => ({ ...prev, [ord.orderId]: m }))}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                                currentMethod === m
                                  ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                              }`}
                            >
                              {m === "CASH" ? "💵 Cash" : m === "UPI" ? "📱 UPI" : "💳 College Card"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Cashier Action Buttons (Requirement 4: Cancellation added to Cashier) */}
                    <div className="pt-3 border-t border-stone-100 flex gap-2">
                      <button
                        onClick={() => handleCashierAction(ord.orderId, "ACCEPT")}
                        disabled={actionLoading === ord.orderId}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5"
                      >
                        <span>✓ Accept &amp; Forward to Kitchen</span>
                      </button>
                      <button
                        onClick={() => handleCashierAction(ord.orderId, "REJECT")}
                        disabled={actionLoading === ord.orderId}
                        className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all"
                        title="Cancel incoming order and return stock to inventory"
                      >
                        ❌ Cancel Order (Refund)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Orders Oversight & Cancellation Authority (Requirement 4) */}
          <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-black text-base text-[#0F172A] flex items-center gap-2">
                  <span>🛡️ Active Orders &amp; Customer Cancellation Desk</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800 uppercase">
                    Cashier Exclusive Authority
                  </span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  The Cashier has the exclusive authority to cancel live orders and refund stock upon customer desk request. (Kitchen staff do not have cancellation permissions).
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-stone-100 text-stone-700 rounded-full">
                {[...(liveQueue?.waitingOrders || []), ...(liveQueue?.activePreparingOrders || [])].length} Active in Kitchen
              </span>
            </div>

            {[...(liveQueue?.waitingOrders || []), ...(liveQueue?.activePreparingOrders || [])].length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center italic">
                No active orders currently preparing or queued in the kitchen.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...(liveQueue?.waitingOrders || []), ...(liveQueue?.activePreparingOrders || [])].map((ord) => (
                  <div
                    key={ord.orderId}
                    className="border border-stone-200 bg-[#FAF8F5] rounded-2xl p-3.5 space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-sm font-black text-[#0F172A]">
                            Token #{ord.tokenNo}
                          </span>
                          <p className="text-[10px] text-stone-400 font-mono">ID: {ord.orderId}</p>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                            ord.status === "PREPARING"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {ord.status} {ord.assignedCounterId ? `(${ord.assignedCounterId})` : ""}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-stone-700">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                      </p>

                      <div className="flex justify-between text-[11px] text-stone-500 pt-1">
                        <span>Total: <strong className="text-stone-800">₹{ord.totalAmount}</strong></span>
                        <span>Placed: {new Date(ord.queueEnteredAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCashierCancelActiveOrder(ord.orderId)}
                      disabled={actionLoading === ord.orderId}
                      className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 active:scale-98"
                    >
                      <span>❌ Cancel &amp; Refund Stock</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active View: Grocery Logistics & Food Items (Requirements 3 & 4) */}
      {activeView === "groceries" && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-lg text-[#0F172A] flex items-center gap-2">
                  <span>📦 Kitchen Grocery Logistics &amp; Food Supplies</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                    Supply Inventory
                  </span>
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Logistics management for raw materials, batters (e.g. Dosa Batter), dairy, and staples. Automated renewal reminders trigger when stock drops below threshold or nears expiry.
                </p>
              </div>
            </div>
          </div>

          {/* Renewal Reminder Alerts Banner (Requirements 3 & 4) */}
          {renewalAlerts.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-3xl p-5 shadow-md space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl animate-bounce">⚠️</span>
                <div>
                  <h3 className="font-black text-sm text-amber-900">
                    GROCERY RENEWAL REMINDER: {renewalAlerts.length} Item(s) Require Replenishment!
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    The following groceries are below safe kitchen reorder threshold or nearing expiry:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {renewalAlerts.map((g) => (
                  <div
                    key={g.groceryId}
                    className="bg-white/90 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="font-black text-stone-900">{g.name}</strong>
                        <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[10px] font-bold">
                          {g.renewalUrgent ? "CRITICAL" : "REORDER"}
                        </span>
                      </div>
                      <p className="text-stone-600 text-[11px] mt-0.5">
                        Current: <strong className="text-rose-700">{g.currentQty} {g.unit}</strong> (Min: {g.minThreshold} {g.unit}) · {g.expiryDaysRemaining}d expiry
                      </p>
                    </div>

                    <button
                      onClick={() => handleRenewGrocery(g.groceryId)}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap"
                    >
                      🔄 1-Click Renew
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groceries Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groceries.map((item) => {
              const isUnderThreshold = item.currentQty <= item.minThreshold;
              const itemStatus = item.renewalUrgent
                ? "CRITICAL"
                : isUnderThreshold
                ? "LOW"
                : "OPTIMAL";

              return (
                <div
                  key={item.groceryId}
                  className={`bg-white border rounded-3xl p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all ${
                    isUnderThreshold
                      ? "border-amber-400 ring-1 ring-amber-300"
                      : "border-stone-200"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          {item.category}
                        </span>
                        <h3 className="font-extrabold text-base text-[#0F172A]">{item.name}</h3>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          itemStatus === "OPTIMAL"
                            ? "bg-emerald-100 text-emerald-800"
                            : itemStatus === "LOW"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {itemStatus}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-2xl font-black text-[#0F172A]">{item.currentQty}</span>
                        <span className="text-xs text-stone-500 font-bold ml-1">{item.unit}</span>
                      </div>
                      <span className="text-xs text-stone-400">
                        Reorder threshold: <strong className="text-stone-700">{item.minThreshold} {item.unit}</strong>
                      </span>
                    </div>

                    {/* Stock Gauge Bar */}
                    <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isUnderThreshold ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((item.currentQty / (item.minThreshold * 2.5)) * 100))}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-stone-500 pt-1">
                      <span>Shelf life / Expiry:</span>
                      <span className={`font-bold ${item.expiryDaysRemaining <= 2 ? "text-rose-600" : "text-stone-700"}`}>
                        ⏳ {item.expiryDaysRemaining} days remaining
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-semibold">Kitchen Usage:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleConsumeGrocery(item.groceryId, 1)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg"
                          title="Consume 1 unit"
                        >
                          -1 {item.unit}
                        </button>
                        <button
                          onClick={() => handleRestockGrocery(item.groceryId, 5)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg"
                          title="Restock 5 units"
                        >
                          +5 {item.unit}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRenewGrocery(item.groceryId)}
                      className={`w-full py-2 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 ${
                        isUnderThreshold
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                      }`}
                    >
                      <span>🔄</span>
                      <span>{isUnderThreshold ? "Renew & Replenish Stock" : "Reorder Batch"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </main>

      {/* Stock & Menu Management Modal (Requirements 5 & 9) */}
      {activeModal === "inventory" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#0F172A]">Menu &amp; Inventory Control</h3>
                <p className="text-xs text-stone-500">Live stock updates, daily specials, and new items creation</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemForm(!showAddItemForm)}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>{showAddItemForm ? "✕ Close Form" : "➕ Add New Item"}</span>
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-stone-400 hover:text-stone-700 text-lg font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Add New Menu Item Form (Requirement 5) */}
            {showAddItemForm && (
              <form
                onSubmit={handleCreateMenuItem}
                className="bg-orange-50/60 border border-orange-200 rounded-2xl p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between border-b border-orange-200/60 pb-2">
                  <span className="font-black text-orange-950 uppercase tracking-wider text-[11px]">
                    Create New Canteen Item
                  </span>
                  <span className="text-[10px] text-orange-800 font-semibold">Immediate Menu Sync</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Item Name *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g. Mysore Masala Dosa"
                      required
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Category *</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value as any)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                    >
                      <option value="HOT">🔥 Hot Food</option>
                      <option value="SNACK">🥪 Snack</option>
                      <option value="DRINK">☕ Drink</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Selling Price (₹) *</label>
                    <input
                      type="number"
                      min={1}
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(Number(e.target.value))}
                      required
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Initial Stock Qty *</label>
                    <input
                      type="number"
                      min={0}
                      value={newItemInitialStock}
                      onChange={(e) => setNewItemInitialStock(Number(e.target.value))}
                      required
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Prep Time per Batch (mins)</label>
                    <input
                      type="number"
                      min={1}
                      value={newItemPrepTime}
                      onChange={(e) => setNewItemPrepTime(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Batch Capacity (units)</label>
                    <input
                      type="number"
                      min={1}
                      value={newItemBatchSize}
                      onChange={(e) => setNewItemBatchSize(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Daily Special Options */}
                <div className="pt-2 border-t border-orange-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemIsDailySpecial}
                      onChange={(e) => setNewItemIsDailySpecial(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    <span className="font-bold text-orange-950">⭐ Promote as Today&apos;s Daily Special</span>
                  </label>

                  {newItemIsDailySpecial && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-stone-600 font-semibold">Special Tag:</span>
                      <input
                        type="text"
                        value={newItemDailySpecialTag}
                        onChange={(e) => setNewItemDailySpecialTag(e.target.value)}
                        placeholder="e.g. Chef's Special"
                        className="px-2.5 py-1 bg-white border border-orange-200 rounded-lg text-xs font-semibold outline-none focus:border-orange-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddItemForm(false)}
                    className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingItem}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs"
                  >
                    {creatingItem ? "Adding Item..." : "Publish to Menu"}
                  </button>
                </div>
              </form>
            )}

            {/* Menu Items List */}
            <div className="space-y-3">
              {menu.map((item) => (
                <div
                  key={item.itemId}
                  className="bg-[#FAF8F5] border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0F172A] text-sm">{item.name}</span>
                      <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-bold">
                        {item.category}
                      </span>
                      {item.isDailySpecial && (
                        <span className="text-[10px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          ⭐ {item.dailySpecialTag || "Daily Special"}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-500 text-[11px]">
                      Price: ₹{item.price} · Prep: {item.prepMinutesPerBatch}m/batch ({item.batchSize} units)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Daily Special Toggle (Requirement 9) */}
                    <button
                      type="button"
                      onClick={() => handleToggleDailySpecial(item.itemId, !!item.isDailySpecial, item.dailySpecialTag)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        item.isDailySpecial
                          ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs"
                          : "bg-white text-stone-600 border border-stone-200 hover:border-amber-300"
                      }`}
                      title="Toggle Daily Special banner in student portal"
                    >
                      {item.isDailySpecial ? "⭐ Daily Special" : "☆ Make Special"}
                    </button>

                    {/* Stock stepper */}
                    <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-2 py-1 shadow-xs">
                      <button
                        onClick={() => handleAdjustStock(item.itemId, -1)}
                        className="w-5 h-5 flex items-center justify-center font-bold text-stone-600 hover:text-stone-900"
                      >
                        -
                      </button>
                      <span className="font-black text-amber-700 px-2">{item.stockQty} left</span>
                      <button
                        onClick={() => handleAdjustStock(item.itemId, 5)}
                        className="w-5 h-5 flex items-center justify-center font-bold text-stone-600 hover:text-stone-900"
                      >
                        +5
                      </button>
                    </div>

                    {/* Available toggle */}
                    <button
                      onClick={() => handleToggleItemAvailability(item.itemId, item.isAvailable)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        item.isAvailable
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {item.isAvailable ? "Available" : "Sold Out"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Scenario Switcher Modal */}
      {activeModal === "scenarios" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#0F172A]">Preset Hackathon Scenarios</h3>
                <p className="text-xs text-stone-500">Section 8: Low traffic, peak traffic, and counter unavailable</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <button
                onClick={() => handleLoadScenario("low")}
                className="w-full text-left p-4 bg-[#FAF8F5] hover:bg-emerald-50/50 border border-stone-200 hover:border-emerald-300 rounded-2xl transition-all space-y-1 shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-emerald-700 text-sm">1. Low Traffic Scenario</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                    Smooth Flow
                  </span>
                </div>
                <p className="text-stone-500">
                  Light order volume with 2 orders; both counters active; waiting times ~1.5 mins; zero congestion.
                </p>
              </button>

              <button
                onClick={() => handleLoadScenario("peak")}
                className="w-full text-left p-4 bg-[#FAF8F5] hover:bg-amber-50/50 border border-stone-200 hover:border-amber-300 rounded-2xl transition-all space-y-1 shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-700 text-sm">2. Peak Lunch Rush Scenario</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    Congestion Triggered
                  </span>
                </div>
                <p className="text-stone-500">
                  Sudden burst of 10 incoming orders across all categories; demonstrates queue re-balancing and congestion alert.
                </p>
              </button>

              <button
                onClick={() => handleLoadScenario("counter_breakdown")}
                className="w-full text-left p-4 bg-[#FAF8F5] hover:bg-rose-50/50 border border-stone-200 hover:border-rose-300 rounded-2xl transition-all space-y-1 shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-rose-700 text-sm">3. Counter Offline / Breakdown</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                    Edge Case
                  </span>
                </div>
                <p className="text-stone-500">
                  Take Away Hot Counters (C01 &amp; C04) taken offline. Hot food orders are flagged as blocked with clear reasons while Snacks/Drinks orders proceed on C02 &amp; C03.
                </p>
              </button>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-xl text-xs font-bold border border-stone-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
