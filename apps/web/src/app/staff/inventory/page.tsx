"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMenu,
  updateMenuItem,
  fetchApi,
  MenuItem,
} from "../../../lib/api";

interface AuditEventsResponse {
  queueEvents: Array<{
    eventId: string;
    orderId: string;
    eventType: string;
    eventTime: string;
    counterId?: string | null;
    note?: string;
  }>;
  inventoryEvents: Array<{
    inventoryEventId: string;
    itemId: string;
    changeQty: number;
    reason: string;
    eventTime: string;
  }>;
}

export default function StaffInventoryPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    try {
      const [menuRes, auditRes] = await Promise.all([
        getMenu(),
        fetchApi<AuditEventsResponse>("api/queue/audit-events"),
      ]);
      setMenu(menuRes.menu);
      setAuditEvents(auditRes);
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAdjustStock = async (itemId: string, delta: number) => {
    const item = menu.find((m) => m.itemId === itemId);
    if (!item) return;
    const newStock = Math.max(0, item.stockQty + delta);
    try {
      await updateMenuItem(itemId, { stockQty: newStock });
      showNotification(`Updated ${item.name} stock to ${newStock} units.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update stock");
    }
  };

  const handleToggleAvailability = async (itemId: string, current: boolean) => {
    try {
      await updateMenuItem(itemId, { isAvailable: !current });
      showNotification(`Item availability updated.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to toggle availability");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-bold animate-bounce">
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h1 className="font-black text-base text-white tracking-tight">Stock & Inventory Management</h1>
              <p className="text-xs text-slate-400">Section 5: Menu Availability, Stock Controls & Batch Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/staff/dashboard"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all"
            >
              ← Back to KDS Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Inventory Control Table */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-white">Live Menu & Stock Master</h2>
              <p className="text-xs text-slate-400">Real-time inventory levels, preparation batch sizing, and availability</p>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{menu.length} registered items</span>
          </div>

          <div className="space-y-3">
            {menu.map((item) => (
              <div
                key={item.itemId}
                className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-slate-700"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {item.itemId}
                    </span>
                    <h3 className="font-extrabold text-sm text-white">{item.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.category === "HOT"
                          ? "bg-orange-950/60 text-orange-400 border border-orange-800/60"
                          : item.category === "DRINK"
                          ? "bg-blue-950/60 text-blue-400 border border-blue-800/60"
                          : "bg-amber-950/60 text-amber-400 border border-amber-800/60"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Price: <strong className="text-white">₹{item.price}</strong> · Prep Time:{" "}
                    <strong className="text-slate-200">{item.prepMinutesPerBatch}m</strong> per batch · Batch
                    Capacity: <strong className="text-slate-200">{item.batchSize} units</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Stock level pill */}
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-slate-400">Stock:</span>
                    <span
                      className={`text-sm font-black ${
                        item.stockQty === 0
                          ? "text-rose-400"
                          : item.stockQty <= 5
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {item.stockQty} left
                    </span>

                    <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                      <button
                        onClick={() => handleAdjustStock(item.itemId, -1)}
                        className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded"
                        title="Deduct 1"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleAdjustStock(item.itemId, 5)}
                        className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded"
                        title="Add 5"
                      >
                        +5
                      </button>
                      <button
                        onClick={() => handleAdjustStock(item.itemId, 20)}
                        className="w-8 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded"
                        title="Restock 20"
                      >
                        +20
                      </button>
                    </div>
                  </div>

                  {/* Availability Toggle */}
                  <button
                    onClick={() => handleToggleAvailability(item.itemId, item.isAvailable)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                      item.isAvailable
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                    }`}
                  >
                    {item.isAvailable ? "Available" : "Sold Out"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Audit Trail: Inventory & Stock Events (Section 7.1) */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-white">Inventory Audit Trail (`inventory_events`)</h2>
              <p className="text-xs text-slate-400">Real-time log of stock reservations, restocks, and cancellation refunds</p>
            </div>
            <span className="text-xs text-slate-500">Auto-refreshing</span>
          </div>

          {!auditEvents || auditEvents.inventoryEvents.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No inventory events recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {auditEvents.inventoryEvents.slice(0, 15).map((evt) => (
                <div
                  key={evt.inventoryEventId}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-400 text-[10px] bg-slate-800 px-2 py-0.5 rounded">
                      {evt.inventoryEventId}
                    </span>
                    <span className="text-slate-200 font-bold">{evt.itemId}</span>
                    <span className="text-slate-400">· {evt.reason}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-black text-xs ${
                        evt.changeQty > 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {evt.changeQty > 0 ? `+${evt.changeQty}` : evt.changeQty} units
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(evt.eventTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

