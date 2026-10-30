"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "../../../lib/api";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("staff@canteen.edu");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser({ email, role: "STAFF" });
      if (res.ok) {
        // Save demo staff session
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_staff_user", JSON.stringify(res.user));
        }
        router.push("/staff/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <span className="font-extrabold text-sm text-white">Smart Canteen</span>
          </Link>
          <Link href="/" className="text-xs text-slate-400 hover:text-white">
            ← Hub
          </Link>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-md mx-auto px-6 py-12 w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg">
            🔐
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Staff Kitchen Console</h1>
          <p className="text-xs text-slate-400">
            Authorised Kitchen Display System (KDS) & Multi-Counter Management Access
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs p-3 rounded-xl font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 uppercase tracking-wider block">
              Staff Email / ID
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold outline-none focus:border-blue-500"
              placeholder="staff@canteen.edu"
            />
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 uppercase tracking-wider block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 p-3 rounded-xl text-[11px] leading-relaxed">
            <strong>Demo Credentials:</strong> Canteen staff role is prefilled. Click below to enter the live kitchen display.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all active:scale-98"
          >
            {loading ? "Authenticating..." : "Sign In to Kitchen Display"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          Looking for student ordering?{" "}
          <Link href="/student" className="text-orange-400 font-bold hover:underline">
            Go to Student Portal
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        Smart Canteen System · Role Protected Staff Interface
      </footer>
    </div>
  );
}

