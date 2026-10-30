"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "../../../lib/api";

const CANTEENS = [
  { slug: "main-canteen", name: "Campus Central Canteen", badge: "Primary Hub" },
  { slug: "north-canteen", name: "North Campus Food Court", badge: "Express" },
  { slug: "south-canteen", name: "South Campus Kiosk", badge: "Snacks" },
];

export default function GuestLoginPage() {
  const router = useRouter();
  const [guestName, setGuestName] = useState("Guest Visitor");
  const [selectedCanteen, setSelectedCanteen] = useState("main-canteen");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCustomGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim() || "Guest Visitor";
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser({ name, role: "GUEST" });
      if (res.ok && res.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_guest_user", JSON.stringify(res.user));
        }
        router.push(`/guest/${selectedCanteen}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to start guest session");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser({ userId: "U104", name: "Guest Demo", role: "GUEST" });
      if (res.ok && res.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_guest_user", JSON.stringify(res.user));
        }
        router.push(`/guest/${selectedCanteen}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to login as Demo Guest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <span className="font-extrabold text-sm text-stone-900">Smart Canteen</span>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/" className="text-stone-500 hover:text-stone-900 font-bold">
              Hub
            </Link>
            <span className="text-stone-300">·</span>
            <Link href="/student/login" className="text-orange-600 hover:text-orange-700 font-bold">
              Student Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-6 py-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
            ⚡
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Guest Express Access</h1>
          <p className="text-xs text-stone-500">
            Zero mandatory student registration. Order food, receive digital tokens, and track pickup in real-time.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* 1-Click Demo Guest Quick Access */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 space-y-3 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
            Demo Guest Profile (1-Click Login)
          </span>
          <button
            type="button"
            onClick={handleDemoGuestLogin}
            disabled={loading}
            className="w-full p-3.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-2xl text-left transition-all flex items-center justify-between group"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-amber-950">Demo Guest (U104)</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-black">
                  Pre-configured
                </span>
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Immediate access to order and track queue without form entry
              </p>
            </div>
            <span className="text-amber-800 font-black group-hover:translate-x-1 transition-transform">
              ➔
            </span>
          </button>
        </div>

        {/* Custom Guest Name / Tag Form */}
        <form
          onSubmit={handleCustomGuestLogin}
          className="bg-white border border-stone-200 rounded-3xl p-6 space-y-4 shadow-sm"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
            Or Set Your Visitor Name & Canteen
          </span>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-stone-700 uppercase tracking-wider block">
              Guest Name / Order Callout Tag
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold outline-none focus:border-amber-500 focus:bg-white transition-all"
              placeholder="e.g. Dr. Ramesh / Parent / Visitor #3"
            />
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-stone-700 uppercase tracking-wider block">
              Choose Campus Canteen
            </label>
            <select
              value={selectedCanteen}
              onChange={(e) => setSelectedCanteen(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold outline-none focus:border-amber-500 focus:bg-white transition-all"
            >
              {CANTEENS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.badge})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-stone-950 font-black text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? "Starting Session..." : "Enter Guest Canteen QR Screen ➔"}
          </button>
        </form>

        {/* Alternative direct links */}
        <div className="text-center space-y-2 pt-1">
          <p className="text-xs text-stone-500">
            Are you a registered college student?{" "}
            <Link href="/student/login" className="text-orange-600 font-bold hover:underline">
              Go to Student Login
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-4 px-6 text-center text-xs text-stone-400">
        Smart Canteen · Frictionless Guest Access
      </footer>
    </div>
  );
}

