"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  getMenu,
  getLiveQueue,
  getOrders,
  createOrder,
  cancelOrder,
  loginWithPhone,
  MenuItem,
  LiveQueueState,
  Order,
  CanteenScheduleStatus,
} from "../../lib/api";

const DEMO_STUDENTS = [
  {
    userId: "U101",
    rollNo: "1602-25-001",
    name: "Aarav Sharma",
    phone: "9876543210",
    portalVerified: true,
  },
  {
    userId: "U102",
    rollNo: "1602-25-002",
    name: "Ananya Reddy",
    phone: "9876543211",
    portalVerified: true,
  },
];

export default function StudentPortalPage() {
  const [currentUser, setCurrentUser] = useState(DEMO_STUDENTS[0]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<"phone" | "roll">("phone");
  const [mobilePhone, setMobilePhone] = useState<string>("9876543210");
  const [phoneOtp, setPhoneOtp] = useState<string>("1234");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [customRollNo, setCustomRollNo] = useState("");
  const [customName, setCustomName] = useState("");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [liveQueue, setLiveQueue] = useState<LiveQueueState | null>(null);
  const [schedule, setSchedule] = useState<CanteenScheduleStatus | null>(null);
  const [cart, setCart] = useState<{ [itemId: string]: number }>({});
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [activeTrackingToken, setActiveTrackingToken] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"menu" | "cart" | "tracker" | "history">("menu");
  const [loading, setLoading] = useState<boolean>(true);
  const [apiOffline, setApiOffline] = useState<boolean>(false);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // 1-second interval to drive real-time preparation timers
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load persisted student or query tab parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("canteen_student_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.userId) {
            setCurrentUser(parsed);
          }
        } catch {}
      }

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "menu" || tabParam === "cart" || tabParam === "tracker" || tabParam === "history") {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const changeTab = (tab: "menu" | "cart" | "tracker" | "history") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Poll live data every 3 seconds
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [menuRes, queueRes, ordersRes] = await Promise.all([
          getMenu(),
          getLiveQueue(),
          getOrders(currentUser.userId),
        ]);
        if (!isMounted) return;
        setMenu(menuRes.menu);
        setLiveQueue(queueRes);
        if (queueRes?.schedule) {
          setSchedule(queueRes.schedule);
        }
        setUserOrders(ordersRes.orders);
        setApiOffline(false);

        // Auto-select latest active order if available
        const activeOrder = ordersRes.orders.find(
          (o) => o.status === "QUEUED" || o.status === "PREPARING" || o.status === "READY"
        );
        if (activeOrder) {
          setActiveTrackingToken((prev) => prev || activeOrder.tokenNo);
        } else if (ordersRes.orders.length > 0) {
          setActiveTrackingToken((prev) => prev || ordersRes.orders[0].tokenNo);
        }
      } catch (err: any) {
        if (isMounted) setApiOffline(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser.userId]);

  // Mobile number verification with official college portal
  const handlePhoneLogin = async () => {
    const clean = mobilePhone.trim().replace(/\D/g, "");
    if (clean.length < 10) {
      showNotification("Please enter a valid 10-digit registered mobile number", "error");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await loginWithPhone({ phone: clean, otp: phoneOtp });
      if (res.ok && res.user) {
        setCurrentUser(res.user as any);
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_student_user", JSON.stringify(res.user));
        }
        setShowLoginModal(false);
        showNotification(`Official Portal Verified! Welcome, ${res.user.name}`);
      }
    } catch (err: any) {
      showNotification(err.message || "Failed to verify mobile number", "error");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCustomLogin = () => {
    const roll = customRollNo.trim();
    if (!roll) return;
    const name = customName.trim() || `Student (${roll})`;
    const newUser = {
      userId: `U_${roll.replace(/[^a-zA-Z0-9]/g, "")}`,
      rollNo: roll,
      name,
      portalVerified: true,
    };
    setCurrentUser(newUser as any);
    if (typeof window !== "undefined") {
      localStorage.setItem("canteen_student_user", JSON.stringify(newUser));
    }
    setActiveTrackingToken(null);
    setShowLoginModal(false);
    showNotification(`Logged in as ${name}!`);
  };

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Cart operations
  const addToCart = (itemId: string) => {
    const item = menu.find((m) => m.itemId === itemId);
    if (!item || !item.isAvailable || item.stockQty <= 0) return;
    const currentQty = cart[itemId] || 0;
    if (currentQty >= item.stockQty) {
      showNotification(`Only ${item.stockQty} items left in stock`, "error");
      return;
    }
    setCart((prev) => ({ ...prev, [itemId]: currentQty + 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (!next[itemId]) return next;
      if (next[itemId] <= 1) {
        delete next[itemId];
      } else {
        next[itemId] -= 1;
      }
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

  // Pre-confirmation Estimated Wait Time (P1 Requirement)
  const cartEstimatedPrepMinutes = useMemo(() => {
    if (totalCartCount === 0) return 0;
    let prep = 0;
    for (const [itemId, qty] of Object.entries(cart)) {
      const item = menu.find((m) => m.itemId === itemId);
      if (!item) continue;
      const batches = Math.ceil(qty / (item.batchSize || 1));
      prep += batches * (item.prepMinutesPerBatch || 2);
    }
    const currentQueueLag = liveQueue?.metrics.currentQueueLength ? liveQueue.metrics.currentQueueLength * 2 : 0;
    return prep + currentQueueLag;
  }, [cart, menu, liveQueue]);

  // Handle Order Placement
  const handlePlaceOrder = async () => {
    if (totalCartCount === 0) return;
    setSubmittingOrder(true);
    try {
      const items = Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity }));
      const res = await createOrder({
        userId: currentUser.userId,
        items,
      });

      setCart({});
      setActiveTrackingToken(res.order.tokenNo);
      changeTab("tracker");
      showNotification(`Order placed! Token #${res.order.tokenNo}`);

      // Refresh data
      const [queueRes, ordersRes, menuRes] = await Promise.all([
        getLiveQueue(),
        getOrders(currentUser.userId),
        getMenu(),
      ]);
      setLiveQueue(queueRes);
      setUserOrders(ordersRes.orders);
      setMenu(menuRes.menu);
    } catch (err: any) {
      showNotification(err.message || "Failed to place order", "error");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Handle Cancellation
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order? Reserved stock will be refunded.")) return;
    try {
      await cancelOrder(orderId, "Customer cancelled before preparation started");
      showNotification("Order cancelled successfully. Stock refunded.", "success");
      const [queueRes, ordersRes, menuRes] = await Promise.all([
        getLiveQueue(),
        getOrders(currentUser.userId),
        getMenu(),
      ]);
      setLiveQueue(queueRes);
      setUserOrders(ordersRes.orders);
      setMenu(menuRes.menu);
    } catch (err: any) {
      showNotification(err.message || "Failed to cancel order", "error");
    }
  };

  // Find active tracked order details
  const activeOrder = useMemo(() => {
    if (!activeTrackingToken) return null;
    return userOrders.find((o) => o.tokenNo === activeTrackingToken) || null;
  }, [userOrders, activeTrackingToken]);

  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === "ALL") return menu;
    return menu.filter((item) => item.category === selectedCategory);
  }, [menu, selectedCategory]);

  const dailySpecials = useMemo(() => {
    return menu.filter((item) => item.isDailySpecial);
  }, [menu]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#0F172A] font-sans pb-24">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition-all transform animate-bounce ${
            notification.type === "error"
              ? "bg-rose-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Mobile-first Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-100 px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🍽️</span>
              <span className="text-xs font-black tracking-wider uppercase text-orange-600">
                Smart Canteen
              </span>
            </div>
            <h1 className="text-base font-extrabold text-[#0F172A] flex items-center gap-1.5">
              <span>Student Portal</span>
            </h1>
          </div>

          {/* User selector demo pill & custom login */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Switch Student User"
              value={currentUser.userId}
              onChange={(e) => {
                const u = DEMO_STUDENTS.find((s) => s.userId === e.target.value);
                if (u) {
                  setCurrentUser(u);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("canteen_student_user", JSON.stringify(u));
                  }
                  setActiveTrackingToken(null);
                }
              }}
              className="text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-orange-500"
            >
              {DEMO_STUDENTS.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name} ({s.rollNo})
                </option>
              ))}
              {!DEMO_STUDENTS.some((s) => s.userId === currentUser.userId) && (
                <option value={currentUser.userId}>
                  {currentUser.name} ({currentUser.rollNo})
                </option>
              )}
            </select>

            <button
              onClick={() => setShowLoginModal(true)}
              className="text-[11px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all"
              title="Sign in with your roll number"
            >
              🔑 Login
            </button>
          </div>
        </div>
      </header>

      {/* Student Authentication Modal (Mobile verification via college portal & Roll No) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#0F172A] flex items-center gap-1.5">
                  <span>Student Authentication</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Portal Verified
                  </span>
                </h3>
                <p className="text-xs text-slate-500">Official College Student Verification</p>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Mode Toggle Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setLoginMode("phone")}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  loginMode === "phone" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                📱 Registered Mobile
              </button>
              <button
                onClick={() => setLoginMode("roll")}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  loginMode === "roll" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🎓 Roll Number
              </button>
            </div>

            {loginMode === "phone" ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Registered Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={mobilePhone}
                    onChange={(e) => setMobilePhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-orange-500 font-mono text-sm"
                  />
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold self-center">Quick pick:</span>
                    <button
                      type="button"
                      onClick={() => setMobilePhone("9876543210")}
                      className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md border border-orange-200"
                    >
                      Aarav (9876543210)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobilePhone("9876543211")}
                      className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md border border-orange-200"
                    >
                      Priya (9876543211)
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 uppercase tracking-wider">
                      One-Time Password (OTP)
                    </label>
                    <span className="text-[10px] text-emerald-600 font-bold">Portal Verified Mock</span>
                  </div>
                  <input
                    type="text"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    placeholder="e.g. 1234"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-orange-500 font-mono text-sm"
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-[11px] flex items-center gap-2">
                  <span>🏛️</span>
                  <div>
                    <span className="font-bold">Official College Portal Verification</span>
                    <p className="text-[10px] text-emerald-700">
                      Mobile numbers are verified against student records in the college database.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePhoneLogin}
                    disabled={loginLoading}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow disabled:opacity-50"
                  >
                    {loginLoading ? "Verifying..." : "Verify & Sign In"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    College Roll Number
                  </label>
                  <input
                    type="text"
                    value={customRollNo}
                    onChange={(e) => setCustomRollNo(e.target.value)}
                    placeholder="e.g. 1602-25-003"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Student Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomLogin}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* Canteen Operating Schedule & Closing Alert (Requirements 6, 7, 8) */}
        {schedule && (
          <div className="space-y-2">
            {schedule.isClosingSoon && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3.5 rounded-2xl shadow-md flex items-center gap-3 animate-pulse">
                <span className="text-2xl">⏳</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                      Closing Notice
                    </span>
                    <span className="text-xs font-extrabold">Canteen Closes at 5:30 PM</span>
                  </div>
                  <p className="text-[11px] text-amber-100 mt-0.5 leading-tight">
                    Notice: Order acceptance closes 20 minutes prior to closing (at 5:10 PM). Please finalize orders now!
                  </p>
                </div>
              </div>
            )}

            {!schedule.isAcceptingOrders && (
              <div className="bg-rose-600 text-white p-3.5 rounded-2xl shadow-md flex items-center gap-3">
                <span className="text-2xl">🛑</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                      Orders Closed
                    </span>
                    <span className="text-xs font-extrabold">Orders Cutoff at 5:10 PM</span>
                  </div>
                  <p className="text-[11px] text-rose-100 mt-0.5 leading-tight">
                    The kitchen is no longer accepting new orders (Canteen hours: 8:30 AM – 5:30 PM). Kitchen reopens tomorrow at 8:30 AM.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
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

        {/* Crowd & Congestion Indicator */}
        {liveQueue && (
          <section className="bg-white border border-stone-200/80 rounded-2xl p-3.5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
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
                <span className="text-xs font-bold text-slate-700">
                  Kitchen Crowd:{" "}
                  <span
                    className={`uppercase font-black ${
                      liveQueue.crowd.level === "LOW"
                        ? "text-emerald-600"
                        : liveQueue.crowd.level === "MODERATE"
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {liveQueue.crowd.level}
                  </span>
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {liveQueue.waitingOrders.length} orders queued
              </span>
            </div>

            {liveQueue.crowd.isCongested && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-2.5 font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{liveQueue.crowd.congestionMessage || "Kitchen experiencing peak rush."}</span>
              </div>
            )}
          </section>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => changeTab("menu")}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === "menu" ? "bg-white text-[#0F172A] shadow-sm" : "hover:text-slate-900"
            }`}
          >
            📋 Menu
          </button>
          <button
            onClick={() => changeTab("cart")}
            className={`flex-1 py-1.5 rounded-lg transition-all relative ${
              activeTab === "cart" ? "bg-white text-[#0F172A] shadow-sm" : "hover:text-slate-900"
            }`}
          >
            🛒 Cart
            {totalCartCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-orange-600 text-white rounded-full text-[10px]">
                {totalCartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => changeTab("tracker")}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === "tracker" ? "bg-white text-[#0F172A] shadow-sm" : "hover:text-slate-900"
            }`}
          >
            ⚡ Live Tracker
          </button>
          <button
            onClick={() => changeTab("history")}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === "history" ? "bg-white text-[#0F172A] shadow-sm" : "hover:text-slate-900"
            }`}
          >
            📜 History
          </button>
        </div>

        {/* TAB 1: MENU */}
        {activeTab === "menu" && (
          <div className="space-y-4">
            {/* Daily Specials Spotlight (Requirement 9: Display Daily Special at the top in student interface) */}
            {dailySpecials.length > 0 && (
              <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-4 text-white shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <div>
                      <h2 className="font-black text-sm tracking-tight text-white uppercase">
                        Today&apos;s Daily Specials
                      </h2>
                      <p className="text-[11px] text-amber-100 font-medium">Chef&apos;s fresh daily recommendations</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur rounded-full text-[10px] font-black uppercase tracking-wider">
                    Featured
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {dailySpecials.map((spItem) => {
                    const inCart = cart[spItem.itemId] || 0;
                    const isSoldOut = !spItem.isAvailable || spItem.stockQty <= 0;
                    return (
                      <div
                        key={spItem.itemId}
                        className="bg-white/15 backdrop-blur border border-white/25 rounded-2xl p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-white truncate">{spItem.name}</span>
                            <span className="text-[9px] font-black bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded uppercase">
                              {spItem.dailySpecialTag || "Daily Special"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-amber-100 mt-0.5">
                            <span className="font-black text-white text-xs">₹{spItem.price}</span>
                            <span>·</span>
                            <span>⏱ {spItem.prepMinutesPerBatch}m</span>
                            <span>·</span>
                            <span>{spItem.stockQty} left</span>
                          </div>
                        </div>

                        {isSoldOut ? (
                          <span className="text-[10px] bg-rose-500/80 px-2 py-1 rounded-lg font-bold">Sold Out</span>
                        ) : inCart === 0 ? (
                          <button
                            onClick={() => addToCart(spItem.itemId)}
                            disabled={schedule ? !schedule.isAcceptingOrders : false}
                            className="px-3 py-1 bg-white text-orange-700 hover:bg-orange-50 font-black text-xs rounded-xl shadow transition-all disabled:opacity-50"
                          >
                            + Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-white/20 rounded-xl px-1.5 py-0.5">
                            <button
                              onClick={() => removeFromCart(spItem.itemId)}
                              className="w-5 h-5 flex items-center justify-center font-bold text-white hover:bg-white/20 rounded"
                            >
                              -
                            </button>
                            <span className="text-xs font-black text-white px-1">{inCart}</span>
                            <button
                              onClick={() => addToCart(spItem.itemId)}
                              className="w-5 h-5 flex items-center justify-center font-bold text-white hover:bg-white/20 rounded"
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

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                { label: "All Items", key: "ALL" },
                { label: "🔥 Hot Food", key: "HOT" },
                { label: "🥪 Snacks", key: "SNACK" },
                { label: "☕ Drinks", key: "DRINK" },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCategory(c.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === c.key
                      ? "bg-[#0F172A] text-white shadow"
                      : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Menu List */}
            <div className="space-y-3">
              {filteredMenuItems.map((item) => {
                const inCart = cart[item.itemId] || 0;
                const isLowStock = item.stockQty > 0 && item.stockQty <= 5;
                const isSoldOut = !item.isAvailable || item.stockQty <= 0;

                return (
                  <div
                    key={item.itemId}
                    className={`bg-white border rounded-2xl p-4 transition-all shadow-sm flex flex-col justify-between gap-3 ${
                      isSoldOut ? "opacity-60 border-slate-200" : "border-slate-200/90 hover:border-orange-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-[#0F172A]">{item.name}</h3>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              item.category === "HOT"
                                ? "bg-orange-100 text-orange-800"
                                : item.category === "DRINK"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="font-black text-sm text-[#0F172A]">₹{item.price}</span>
                          <span>⏱ {item.prepMinutesPerBatch}m/batch ({item.batchSize} units)</span>
                        </div>
                      </div>

                      {/* Stock Warning Badge */}
                      <div>
                        {isSoldOut ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">
                            Sold Out
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                            Only {item.stockQty} left!
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full">
                            {item.stockQty} in stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Selector / Add Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        {inCart > 0 ? `${inCart} in cart (₹${inCart * item.price})` : "Freshly prepared"}
                      </span>

                      {isSoldOut ? (
                        <button
                          disabled
                          className="px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed"
                        >
                          Unavailable
                        </button>
                      ) : inCart === 0 ? (
                        <button
                          onClick={() => addToCart(item.itemId)}
                          className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all"
                        >
                          + Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-2 py-1">
                          <button
                            onClick={() => removeFromCart(item.itemId)}
                            className="w-6 h-6 flex items-center justify-center font-bold text-orange-800 hover:bg-orange-200 rounded"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-orange-950 px-1">{inCart}</span>
                          <button
                            onClick={() => addToCart(item.itemId)}
                            className="w-6 h-6 flex items-center justify-center font-bold text-orange-800 hover:bg-orange-200 rounded"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Floating Cart Indicator if items in cart */}
            {totalCartCount > 0 && (
              <div className="sticky bottom-4 z-20">
                <button
                  onClick={() => changeTab("cart")}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm transition-all transform active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">
                      {totalCartCount}
                    </span>
                    <span>Review Order</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-orange-100">
                      Est. Wait ~{cartEstimatedPrepMinutes} mins
                    </span>
                    <span className="text-base font-black">₹{totalCartAmount}</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CART & ESTIMATED WAIT PREVIEW */}
        {activeTab === "cart" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-black text-base text-[#0F172A]">Order Confirmation</h2>
              <span className="text-xs text-slate-500 font-semibold">{totalCartCount} items selected</span>
            </div>

            {totalCartCount === 0 ? (
              <div className="py-12 text-center space-y-3">
                <span className="text-3xl">🛒</span>
                <p className="text-sm font-semibold text-slate-500">Your cart is empty.</p>
                <button
                  onClick={() => changeTab("menu")}
                  className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl shadow"
                >
                  Explore Menu
                </button>
              </div>
            ) : (
              <>
                {/* Cart Lines */}
                <div className="space-y-3 divide-y divide-slate-100">
                  {Object.entries(cart).map(([itemId, qty]) => {
                    const item = menu.find((m) => m.itemId === itemId);
                    if (!item) return null;
                    return (
                      <div key={itemId} className="pt-3 first:pt-0 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-[#0F172A]">{item.name}</p>
                          <p className="text-xs text-slate-400">
                            ₹{item.price} each · {item.prepMinutesPerBatch}m/batch
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-0.5">
                            <button
                              onClick={() => removeFromCart(itemId)}
                              className="font-bold text-slate-600 hover:text-black px-1"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold px-1">{qty}</span>
                            <button
                              onClick={() => addToCart(itemId)}
                              className="font-bold text-slate-600 hover:text-black px-1"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-extrabold text-sm text-slate-900 w-12 text-right">
                            ₹{qty * item.price}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Waiting Time Prediction Box (P1 Feature Requirement) */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-orange-900">Estimated Waiting Time</span>
                    <span className="font-black text-orange-700 text-sm">
                      ~{cartEstimatedPrepMinutes} minutes
                    </span>
                  </div>
                  <p className="text-[11px] text-orange-700/80 leading-relaxed">
                    Computed dynamically from kitchen preparation times, batch capacity, and current queue depth.
                  </p>
                </div>

                {/* Total and Place Order */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-sm font-extrabold">
                    <span>Total Payable</span>
                    <span className="text-lg text-orange-600 font-black">₹{totalCartAmount}</span>
                  </div>

                  {schedule && !schedule.isAcceptingOrders ? (
                    <button
                      disabled
                      className="w-full py-3.5 bg-slate-300 text-slate-500 font-extrabold text-sm rounded-xl cursor-not-allowed shadow flex items-center justify-center gap-2"
                    >
                      <span>🛑 Ordering Closed (5:10 PM Cutoff)</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePlaceOrder}
                      disabled={submittingOrder}
                      className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
                    >
                      {submittingOrder ? (
                        <span>Reserving Stock & Generating Token...</span>
                      ) : (
                        <span>Confirm & Place Order (Get Token)</span>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: LIVE TRACKER */}
        {activeTab === "tracker" && (
          <div className="space-y-4">
            {activeOrder ? (
              <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-orange-400">
                      Live Token Tracker
                    </span>
                    <h2 className="text-3xl font-black tracking-tight text-white mt-0.5">
                      Token #{activeOrder.tokenNo}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Order ID: {activeOrder.orderId}</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      activeOrder.status === "QUEUED"
                        ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                        : activeOrder.status === "PREPARING"
                        ? "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                        : activeOrder.status === "READY"
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 animate-pulse"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {activeOrder.status}
                  </span>
                </div>

                {/* Progress Step Bar */}
                <div className="pt-2">
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold tracking-wider uppercase mb-1.5">
                    <span className={activeOrder.status !== "CANCELLED" ? "text-orange-400" : "text-slate-600"}>
                      1. Queued
                    </span>
                    <span
                      className={
                        activeOrder.status === "PREPARING" ||
                        activeOrder.status === "READY" ||
                        activeOrder.status === "COMPLETED"
                          ? "text-orange-400"
                          : "text-slate-600"
                      }
                    >
                      2. Preparing
                    </span>
                    <span
                      className={
                        activeOrder.status === "READY" || activeOrder.status === "COMPLETED"
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }
                    >
                      3. Ready
                    </span>
                    <span
                      className={activeOrder.status === "COMPLETED" ? "text-emerald-400" : "text-slate-600"}
                    >
                      4. Completed
                    </span>
                  </div>

                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-500 ${
                        activeOrder.status === "QUEUED"
                          ? "w-1/4 bg-amber-500"
                          : activeOrder.status === "PREPARING"
                          ? "w-2/4 bg-blue-500"
                          : activeOrder.status === "READY"
                          ? "w-3/4 bg-emerald-500"
                          : activeOrder.status === "COMPLETED"
                          ? "w-full bg-emerald-600"
                          : "w-0"
                      }`}
                    />
                  </div>
                </div>

                {/* Cashier Desk Forwarding Status (Requirement 2) */}
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                    activeOrder.cashierStatus === "PENDING"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">
                      {activeOrder.cashierStatus === "PENDING" ? "💳" : "👨‍🍳"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-white/10">
                          {activeOrder.cashierStatus === "PENDING" ? "Stage 1: Cashier Desk" : "Stage 2: Kitchen Display"}
                        </span>
                        <span className="font-extrabold text-white text-xs">
                          {activeOrder.cashierStatus === "PENDING"
                            ? "Awaiting Cashier Acceptance"
                            : "Accepted & Forwarded to Kitchen"}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90 leading-tight">
                        {activeOrder.cashierStatus === "PENDING"
                          ? "Order routed to Cashier Interface. Once cashier verifies payment, it redirects directly into kitchen prep."
                          : `Verified by Cashier (${activeOrder.paymentMethod || "CASH"}). Active in kitchen queue.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Counter & ETA cards */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
                    <span className="text-slate-400 text-[11px]">Assigned Counter</span>
                    <p className="font-extrabold text-white text-sm mt-0.5">
                      {activeOrder.assignedCounterId === "C01"
                        ? "Take Away Counter 1 (C01)"
                        : activeOrder.assignedCounterId === "C02"
                        ? "Take Away Counter 2 (C02)"
                        : activeOrder.assignedCounterId === "C03"
                        ? "Take Away Counter 3 (C03)"
                        : activeOrder.assignedCounterId === "C04"
                        ? "Take Away Counter 4 (C04)"
                        : activeOrder.assignedCounterId || "Auto-Assigning..."}
                    </p>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-right">
                    <span className="text-slate-400 text-[11px]">
                      {activeOrder.status === "PREPARING" ? "Prep Countdown" : "Estimated Wait"}
                    </span>
                    <p className="font-extrabold text-orange-400 text-sm mt-0.5 font-mono">
                      {activeOrder.status === "READY"
                        ? "Ready for Pickup!"
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
                        : `~${activeOrder.estimatedWaitMinutes ?? 4} mins`}
                    </p>
                  </div>
                </div>

                {/* Delay Notice Banner */}
                {activeOrder.isDelayed && (
                  <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs rounded-xl p-3 flex items-center gap-2.5">
                    <span className="text-base">⏳</span>
                    <div>
                      <p className="font-bold">Preparation Update:</p>
                      <p className="text-[11px] text-amber-200">
                        {activeOrder.delayReason || "Kitchen extended preparation time."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Items in order */}
                <div className="border-t border-slate-700/80 pt-3 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Ordered Items
                  </span>
                  <div className="space-y-1 text-xs text-slate-200">
                    {activeOrder.items.map((it) => (
                      <div key={it.orderItemId} className="flex justify-between">
                        <span>
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-semibold text-slate-400">₹{it.quantity * it.unitPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cancel action if order is QUEUED */}
                {activeOrder.status === "QUEUED" && (
                  <div className="pt-2 border-t border-slate-700/80">
                    <button
                      onClick={() => handleCancelOrder(activeOrder.orderId)}
                      className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel Order (Release Stock)
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                <span className="text-3xl">🔍</span>
                <h3 className="font-bold text-slate-700">No Active Order Selected</h3>
                <p className="text-xs text-slate-400">
                  Select an order from history or place an order from the menu to watch it move through the queue.
                </p>
                <button
                  onClick={() => changeTab("menu")}
                  className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl"
                >
                  Go to Menu
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ORDER HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Your Past & Active Orders
            </h2>

            {userOrders.length === 0 ? (
              <div className="bg-white border rounded-2xl p-8 text-center text-xs text-slate-400">
                No orders placed yet.
              </div>
            ) : (
              userOrders.map((ord) => (
                <div
                  key={ord.orderId}
                  onClick={() => {
                    setActiveTrackingToken(ord.tokenNo);
                    changeTab("tracker");
                  }}
                  className="bg-white border border-slate-200 hover:border-orange-400 rounded-2xl p-4 shadow-sm cursor-pointer transition-all space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#0F172A]">Token #{ord.tokenNo}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ord.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : ord.status === "CANCELLED"
                              ? "bg-rose-100 text-rose-800"
                              : ord.status === "READY"
                              ? "bg-blue-100 text-blue-800 animate-pulse"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {new Date(ord.queueEnteredAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <span className="font-black text-sm text-[#0F172A]">₹{ord.totalAmount}</span>
                  </div>

                  <p className="text-xs text-slate-600 truncate">
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-orange-600 font-bold pt-1 border-t border-slate-100">
                    <span>View Tracking Status</span>
                    <span>➔</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2">
        <div className="max-w-md mx-auto px-6 flex justify-around text-center text-xs font-bold text-slate-500">
          <button
            onClick={() => changeTab("menu")}
            className={`flex flex-col items-center gap-0.5 ${
              activeTab === "menu" ? "text-orange-600 font-black" : "hover:text-slate-900"
            }`}
          >
            <span className="text-base">📋</span>
            <span>Menu</span>
          </button>
          <button
            onClick={() => changeTab("cart")}
            className={`flex flex-col items-center gap-0.5 relative ${
              activeTab === "cart" ? "text-orange-600 font-black" : "hover:text-slate-900"
            }`}
          >
            <span className="text-base">🛒</span>
            <span>Cart</span>
            {totalCartCount > 0 && (
              <span className="absolute -top-1 right-2 px-1 bg-orange-600 text-white rounded-full text-[9px]">
                {totalCartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => changeTab("tracker")}
            className={`flex flex-col items-center gap-0.5 ${
              activeTab === "tracker" ? "text-orange-600 font-black" : "hover:text-slate-900"
            }`}
          >
            <span className="text-base">⚡</span>
            <span>Tracker</span>
          </button>
          <button
            onClick={() => changeTab("history")}
            className={`flex flex-col items-center gap-0.5 ${
              activeTab === "history" ? "text-orange-600 font-black" : "hover:text-slate-900"
            }`}
          >
            <span className="text-base">📜</span>
            <span>History</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
