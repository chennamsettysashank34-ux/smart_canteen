"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  getMenu,
  getLiveQueue,
  createOrder,
  cancelOrder,
  MenuItem,
  LiveQueueState,
  Order,
} from "../../../lib/api";

interface GuestCanteenClientProps {
  canteenSlug: string;
}

export default function GuestCanteenClient({ canteenSlug }: GuestCanteenClientProps) {
  const canteenName =
    canteenSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Campus Central Canteen";

  const [guestName, setGuestName] = useState("Guest Visitor");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [liveQueue, setLiveQueue] = useState<LiveQueueState | null>(null);
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // 1-second interval to drive real-time preparation timers
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Restore guest user & active order from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedGuest = localStorage.getItem("canteen_guest_user");
      if (storedGuest) {
        try {
          const parsed = JSON.parse(storedGuest);
          if (parsed?.name) {
            setGuestName(parsed.name);
          }
        } catch {}
      }

      const storedOrder = localStorage.getItem("canteen_guest_active_order");
      if (storedOrder) {
        try {
          const parsedOrder = JSON.parse(storedOrder);
          if (parsedOrder && parsedOrder.orderId) {
            setActiveOrder(parsedOrder);
          }
        } catch {}
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [menuRes, queueRes] = await Promise.all([getMenu(), getLiveQueue()]);
        if (!isMounted) return;
        setMenu(menuRes.menu);
        setLiveQueue(queueRes);
        setApiOffline(false);

        // If an active order is present, refresh its state
        if (activeOrder) {
          const matched =
            queueRes.waitingOrders.find((o) => o.orderId === activeOrder.orderId) ||
            queueRes.activePreparingOrders.find((o) => o.orderId === activeOrder.orderId) ||
            queueRes.readyOrders.find((o) => o.orderId === activeOrder.orderId) ||
            queueRes.completedOrders.find((o) => o.orderId === activeOrder.orderId);
          if (matched) {
            setActiveOrder(matched);
          }
        }
      } catch (err) {
        if (isMounted) setApiOffline(true);
      }
    }

    loadData();
    const interval = setInterval(loadData, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeOrder?.orderId]);

  const addToCart = (itemId: string) => {
    const item = menu.find((m) => m.itemId === itemId);
    if (!item || !item.isAvailable || item.stockQty <= 0) return;
    const currentQty = cart[itemId] || 0;
    if (currentQty >= item.stockQty) {
      showNotification(`Only ${item.stockQty} left in stock`, "error");
      return;
    }
    setCart((prev) => ({ ...prev, [itemId]: currentQty + 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (!next[itemId]) return next;
      if (next[itemId] <= 1) delete next[itemId];
      else next[itemId] -= 1;
      return next;
    });
  };

  const totalCartCount = useMemo(() => {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }, [cart]);

  const totalCartAmount = useMemo(() => {
    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = menu.find((m) => m.itemId === itemId);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [cart, menu]);

  const estimatedWaitMinutes = useMemo(() => {
    if (totalCartCount === 0) return 0;
    let prep = 0;
    for (const [itemId, qty] of Object.entries(cart)) {
      const item = menu.find((m) => m.itemId === itemId);
      if (!item) continue;
      const batches = Math.ceil(qty / (item.batchSize || 1));
      prep += batches * (item.prepMinutesPerBatch || 2);
    }
    const lag = liveQueue?.metrics.currentQueueLength ? liveQueue.metrics.currentQueueLength * 2 : 0;
    return prep + lag;
  }, [cart, menu, liveQueue]);

  const dailySpecials = useMemo(() => {
    return menu.filter((item) => item.isDailySpecial);
  }, [menu]);

  const handlePlaceGuestOrder = async () => {
    if (totalCartCount === 0) return;
    setSubmitting(true);
    try {
      const items = Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity }));
      const res = await createOrder({
        guestName: guestName.trim() || "Campus Guest",
        items,
      });

      setCart({});
      setActiveOrder(res.order);
      if (typeof window !== "undefined") {
        localStorage.setItem("canteen_guest_active_order", JSON.stringify(res.order));
      }
      showNotification(`Order Confirmed! Your token is #${res.order.tokenNo}`);

      // Instantly refresh menu stock and queue
      try {
        const [menuRes, queueRes] = await Promise.all([getMenu(), getLiveQueue()]);
        setMenu(menuRes.menu);
        setLiveQueue(queueRes);
      } catch {}
    } catch (err: any) {
      showNotification(err.message || "Failed to place order", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelGuestOrder = async () => {
    if (!activeOrder) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      const res = await cancelOrder(activeOrder.orderId, "Guest cancelled from QR screen");
      setActiveOrder(res.order);
      if (typeof window !== "undefined") {
        localStorage.removeItem("canteen_guest_active_order");
      }
      showNotification("Order cancelled. Stock returned to inventory.", "success");

      // Instantly refresh menu stock and queue
      try {
        const [menuRes, queueRes] = await Promise.all([getMenu(), getLiveQueue()]);
        setMenu(menuRes.menu);
        setLiveQueue(queueRes);
      } catch {}
    } catch (err: any) {
      showNotification(err.message || "Failed to cancel order", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] pb-24 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition-all ${
            notification.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Top Banner */}
      <header className="bg-white border-b border-stone-200 px-4 py-4 shadow-sm sticky top-0 z-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Guest Express QR
                </span>
                <Link href="/guest/login" className="text-[11px] text-amber-700 hover:text-amber-800 font-bold underline">
                  Guest Login
                </Link>
                <Link href="/" className="text-[11px] text-slate-400 hover:text-slate-700 underline">
                  Back to Hub
                </Link>
              </div>
              <h1 className="text-xl font-black text-stone-900 mt-1">{canteenName}</h1>
            </div>
            <span className="text-2xl">⚡</span>
          </div>

          <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Zero account required · Instant digital token will be assigned
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Offline / Connecting Warning */}
        {apiOffline && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Connecting to API backend (<code>http://localhost:4000</code>)...</span>
            </div>
            <span className="text-[10px] font-bold text-amber-700">Retrying</span>
          </div>
        )}

        {/* Canteen Schedule Alert (Requirements 6, 7, 8) */}
        {liveQueue?.schedule && (
          <div className="space-y-2">
            {liveQueue.schedule.isClosingSoon && (
              <div className="bg-amber-500 text-stone-950 p-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm animate-pulse">
                <span className="text-lg">⏳</span>
                <div>
                  <span className="font-black block uppercase text-[10px]">Canteen Closing Soon (5:30 PM)</span>
                  <span className="text-[11px] font-semibold">
                    Orders cutoff is 20 minutes before closure (at 5:10 PM). Please finalize your order now!
                  </span>
                </div>
              </div>
            )}
            {!liveQueue.schedule.isAcceptingOrders && (
              <div className="bg-rose-600 text-white p-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm">
                <span className="text-lg">🛑</span>
                <div>
                  <span className="font-black block uppercase text-[10px]">Orders Closed at 5:10 PM</span>
                  <span className="text-[11px] font-normal">
                    Kitchen is no longer accepting new orders. Canteen reopens tomorrow at 8:30 AM.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Guest Order Tracker Banner */}
        {activeOrder && (
          <div className="bg-gradient-to-br from-amber-600 to-orange-600 text-white rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  Your Digital Token
                </span>
                <h2 className="text-3xl font-black tracking-tight mt-0.5">#{activeOrder.tokenNo}</h2>
                <p className="text-xs text-amber-100 mt-0.5">For {activeOrder.guestName}</p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  activeOrder.status === "QUEUED"
                    ? "bg-white/20 text-white"
                    : activeOrder.status === "PREPARING"
                    ? "bg-blue-900/40 text-blue-100"
                    : activeOrder.status === "READY"
                    ? "bg-emerald-900/40 text-emerald-100 animate-pulse"
                    : "bg-stone-800 text-stone-200"
                }`}
              >
                {activeOrder.status}
              </span>
            </div>

            {/* Tracking details */}
            <div className="grid grid-cols-2 gap-2 bg-black/15 rounded-2xl p-3 text-xs">
              <div>
                <p className="text-amber-200 text-[11px]">Assigned Counter</p>
                <p className="font-extrabold text-white text-sm">
                  {activeOrder.assignedCounterId === "C01"
                    ? "Hot Food (C01)"
                    : activeOrder.assignedCounterId === "C02"
                    ? "Snacks & Drinks (C02)"
                    : activeOrder.assignedCounterId || "Auto-assigning..."}
                </p>
              </div>

              <div className="text-right">
                <p className="text-amber-200 text-[11px]">
                  {activeOrder.status === "PREPARING" ? "Prep Countdown" : "Pickup Status"}
                </p>
                <p className="font-extrabold text-white text-sm font-mono">
                  {activeOrder.status === "READY"
                    ? "Ready at counter!"
                    : activeOrder.status === "COMPLETED"
                    ? "Collected"
                    : activeOrder.status === "PREPARING"
                    ? (function () {
                        if (!activeOrder.serviceStartedAt) return `~${activeOrder.estimatedPrepMinutes || 2}m`;
                        const startMs = new Date(activeOrder.serviceStartedAt).getTime();
                        const targetMs = startMs + (activeOrder.estimatedPrepMinutes || 2) * 60000;
                        const diffSecs = Math.round((targetMs - currentTime) / 1000);
                        if (diffSecs > 0) {
                          const m = Math.floor(diffSecs / 60);
                          const s = diffSecs % 60;
                          return `⏱️ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                        } else {
                          return "✨ Finishing touches...";
                        }
                      })()
                    : `Est. ~${activeOrder.estimatedWaitMinutes ?? 4}m`}
                </p>
              </div>
            </div>

            {/* Delay Notice */}
            {activeOrder.isDelayed && (
              <div className="bg-black/25 text-amber-100 rounded-xl p-2.5 text-xs flex items-center gap-2">
                <span className="text-sm">⏳</span>
                <div>
                  <p className="font-bold text-amber-200">Kitchen Notice:</p>
                  <p className="text-[11px]">{activeOrder.delayReason || "Preparation extended by kitchen."}</p>
                </div>
              </div>
            )}

            {/* Cashier Desk Status (Requirement 2) */}
            <div
              className={`p-2.5 rounded-2xl text-xs flex items-center gap-2 ${
                activeOrder.cashierStatus === "PENDING"
                  ? "bg-black/30 border border-amber-300/40 text-amber-200"
                  : "bg-emerald-950/40 border border-emerald-400/40 text-emerald-200"
              }`}
            >
              <span className="text-base">{activeOrder.cashierStatus === "PENDING" ? "💳" : "👨‍🍳"}</span>
              <div>
                <span className="font-extrabold text-[11px] block">
                  {activeOrder.cashierStatus === "PENDING"
                    ? "Stage 1: Awaiting Cashier Payment & Acceptance"
                    : "Stage 2: Cashier Accepted & Forwarded to Kitchen"}
                </span>
                <span className="text-[10px] opacity-90 block">
                  {activeOrder.cashierStatus === "PENDING"
                    ? "Order diverted to Cashier Interface. Once verified, it routes directly to kitchen cooking."
                    : `Verified with ${activeOrder.paymentMethod || "CASH"}. In kitchen queue.`}
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="text-xs text-amber-100 pt-1">
              <span className="font-bold text-amber-200 text-[11px]">Items: </span>
              {activeOrder.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
            </div>

            {/* Cancel if still QUEUED */}
            {activeOrder.status === "QUEUED" && (
              <button
                onClick={handleCancelGuestOrder}
                className="w-full py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all"
              >
                Cancel Order
              </button>
            )}
          </div>
        )}

        {/* Live Crowd & Kitchen Latency */}
        {liveQueue && (
          <div className="bg-white border border-stone-200 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  liveQueue.crowd.level === "LOW"
                    ? "bg-emerald-500"
                    : liveQueue.crowd.level === "MODERATE"
                    ? "bg-amber-500"
                    : "bg-rose-500 animate-ping"
                }`}
              />
              <span className="font-bold text-stone-700">
                Queue Status: <span className="uppercase font-black">{liveQueue.crowd.level}</span>
              </span>
            </div>
            <span className="text-stone-500 font-semibold">{liveQueue.waitingOrders.length} orders waiting</span>
          </div>
        )}

        {/* Guest Name Input */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-2">
          <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
            Guest Name / Callout Tag
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => {
              setGuestName(e.target.value);
              if (typeof window !== "undefined") {
                localStorage.setItem(
                  "canteen_guest_user",
                  JSON.stringify({ name: e.target.value, role: "GUEST" })
                );
              }
            }}
            placeholder="e.g. Guest Visitor / John D."
            className="w-full text-xs font-semibold px-3 py-2 border border-stone-200 rounded-xl outline-none focus:border-amber-500"
          />
        </div>

        {/* Daily Specials Spotlight (Requirement 9) */}
        {dailySpecials.length > 0 && (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-4 text-white shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Today&apos;s Daily Specials</h3>
                  <p className="text-[11px] text-amber-100 font-medium">Fresh chef recommendations for today</p>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-black uppercase">
                Featured
              </span>
            </div>

            <div className="space-y-2">
              {dailySpecials.map((item) => {
                const inCart = cart[item.itemId] || 0;
                const isSoldOut = !item.isAvailable || item.stockQty <= 0;
                return (
                  <div
                    key={item.itemId}
                    className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-white">{item.name}</span>
                        <span className="text-[9px] font-black bg-amber-300 text-amber-950 px-1.5 py-0.2 rounded uppercase">
                          {item.dailySpecialTag || "Daily Special"}
                        </span>
                      </div>
                      <p className="text-amber-100 text-[11px] mt-0.5">
                        ₹{item.price} · ⏱ {item.prepMinutesPerBatch}m · {item.stockQty} left
                      </p>
                    </div>

                    {isSoldOut ? (
                      <span className="text-[10px] bg-rose-500/80 px-2 py-1 rounded-lg font-bold">Sold Out</span>
                    ) : inCart === 0 ? (
                      <button
                        onClick={() => addToCart(item.itemId)}
                        disabled={liveQueue?.schedule ? !liveQueue.schedule.isAcceptingOrders : false}
                        className="px-3 py-1 bg-white text-stone-900 font-black rounded-xl shadow-xs hover:bg-amber-50 disabled:opacity-50"
                      >
                        + Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-white/20 rounded-xl px-2 py-0.5">
                        <button
                          onClick={() => removeFromCart(item.itemId)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-white"
                        >
                          -
                        </button>
                        <span className="text-xs font-black text-white px-1">{inCart}</span>
                        <button
                          onClick={() => addToCart(item.itemId)}
                          className="w-5 h-5 flex items-center justify-center font-bold text-white"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Menu List */}
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 pt-1">
          Instant Counter Menu
        </h2>

        <div className="space-y-3">
          {menu.map((item) => {
            const inCart = cart[item.itemId] || 0;
            const isSoldOut = !item.isAvailable || item.stockQty <= 0;
            const isLowStock = item.stockQty > 0 && item.stockQty <= 5;

            return (
              <div
                key={item.itemId}
                className={`bg-white border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 ${
                  isSoldOut ? "opacity-60 border-stone-200" : "border-stone-200/90"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-stone-900">{item.name}</h3>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs pt-0.5">
                    <span className="font-extrabold text-stone-900 text-sm">₹{item.price}</span>
                    <span className="text-stone-400">⏱ {item.prepMinutesPerBatch}m</span>
                    {isLowStock && (
                      <span className="text-[10px] text-amber-700 font-bold">Only {item.stockQty} left</span>
                    )}
                    {isSoldOut && (
                      <span className="text-[10px] text-rose-700 font-black">Sold Out</span>
                    )}
                  </div>
                </div>

                {/* Add / Qty */}
                {isSoldOut ? (
                  <button
                    disabled
                    className="px-3 py-1.5 bg-stone-100 text-stone-400 text-xs font-bold rounded-lg cursor-not-allowed"
                  >
                    Sold Out
                  </button>
                ) : inCart === 0 ? (
                  <button
                    onClick={() => addToCart(item.itemId)}
                    className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow active:scale-95 transition-all"
                  >
                    Add
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-2 py-1">
                    <button
                      onClick={() => removeFromCart(item.itemId)}
                      className="w-5 h-5 flex items-center justify-center font-bold text-amber-900"
                    >
                      -
                    </button>
                    <span className="text-xs font-black text-amber-950 px-1">{inCart}</span>
                    <button
                      onClick={() => addToCart(item.itemId)}
                      className="w-5 h-5 flex items-center justify-center font-bold text-amber-900"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Express Cart Sticky Bottom */}
        {totalCartCount > 0 && (
          <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-30">
            <div className="bg-stone-900 text-white rounded-2xl p-4 shadow-2xl space-y-3 border border-stone-700">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-stone-300">{totalCartCount} items selected</span>
                  <p className="text-[11px] text-amber-400">
                    Est. Wait: ~{estimatedWaitMinutes} mins
                  </p>
                </div>
                <span className="text-lg font-black text-white">₹{totalCartAmount}</span>
              </div>

              {liveQueue?.schedule && !liveQueue.schedule.isAcceptingOrders ? (
                <button
                  disabled
                  className="w-full py-3 bg-stone-700 text-stone-400 font-black text-sm rounded-xl cursor-not-allowed"
                >
                  🛑 Ordering Closed (5:10 PM Cutoff)
                </button>
              ) : (
                <button
                  onClick={handlePlaceGuestOrder}
                  disabled={submitting}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-stone-950 font-black text-sm rounded-xl transition-all active:scale-98"
                >
                  {submitting ? "Placing Order..." : "Express Order & Get Token"}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

