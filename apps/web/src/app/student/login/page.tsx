"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser, loginWithPhone } from "../../../lib/api";

const DEMO_STUDENTS = [
  {
    userId: "U101",
    rollNo: "1602-25-001",
    name: "Aarav Sharma",
    phone: "9876543210",
    balance: "₹250",
  },
  {
    userId: "U102",
    rollNo: "1602-25-002",
    name: "Ananya Reddy",
    phone: "9876543211",
    balance: "₹180",
  },
];

export default function StudentLoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"phone" | "roll">("phone");
  const [phone, setPhone] = useState("9876543210");
  const [otp, setOtp] = useState("1234");
  const [rollNo, setRollNo] = useState("1602-25-001");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit registered mobile number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithPhone({ phone: cleanPhone, otp: otp.trim() });
      if (res.ok && res.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_student_user", JSON.stringify(res.user));
        }
        router.push("/student");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify mobile number with college portal");
    } finally {
      setLoading(false);
    }
  };

  const handleRollLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo.trim()) {
      setError("Please enter a valid roll number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser({ rollNo: rollNo.trim(), name: name.trim() || undefined });
      if (res.ok && res.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_student_user", JSON.stringify(res.user));
        }
        router.push("/student");
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate student");
    } finally {
      setLoading(false);
    }
  };

  const selectDemoStudent = async (demo: typeof DEMO_STUDENTS[0]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithPhone({ phone: demo.phone, otp: "1234" });
      if (res.ok && res.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("canteen_student_user", JSON.stringify(res.user));
        }
        router.push("/student");
      }
    } catch (err: any) {
      setError(err.message || "Failed to login as demo student");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#0F172A] flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/80 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            <span className="font-extrabold text-sm text-[#0F172A]">Smart Canteen</span>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/" className="text-slate-500 hover:text-slate-900 font-bold">
              Hub
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/staff/login" className="text-blue-600 hover:text-blue-700 font-bold">
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md mx-auto px-6 py-8 w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
            🎓
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Student Portal Login</h1>
          <p className="text-xs text-slate-500">
            Access live canteen menu, skip waiting queues, and track your tokens in real-time.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Quick Demo Student Picker */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 space-y-3 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Official Portal Registered Students (1-Click)
          </span>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_STUDENTS.map((demo) => (
              <button
                key={demo.userId}
                type="button"
                onClick={() => selectDemoStudent(demo)}
                disabled={loading}
                className="p-3 bg-orange-50/70 hover:bg-orange-100/70 border border-orange-200/80 rounded-2xl text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-orange-950">{demo.name}</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black">
                    Verified
                  </span>
                </div>
                <span className="text-[10px] text-orange-700 block mt-1 font-mono">📱 {demo.phone}</span>
                <span className="text-[10px] text-stone-500 block font-mono">{demo.rollNo}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Auth Mode Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setAuthMode("phone")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              authMode === "phone" ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📱 Mobile Verification (Portal)
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("roll")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              authMode === "roll" ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🎓 College Roll Number
          </button>
        </div>

        {authMode === "phone" ? (
          <form onSubmit={handlePhoneLogin} className="bg-white border border-stone-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
              <span className="text-emerald-600 text-sm">🏛️</span>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Official College Portal Verification
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 uppercase tracking-wider block">
                Registered Mobile Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono outline-none focus:border-orange-500 focus:bg-white transition-all text-sm"
                placeholder="10-digit mobile number (e.g. 9876543210)"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  One-Time Password (OTP)
                </label>
                <span className="text-[10px] text-emerald-600 font-bold">Mock OTP: 1234</span>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-slate-200 rounded-xl text-slate-900 font-semibold font-mono outline-none focus:border-orange-500 focus:bg-white transition-all text-sm"
                placeholder="Enter 4-digit OTP"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "Verifying with College Portal..." : "Verify & Enter Student Portal ➔"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRollLogin} className="bg-white border border-stone-200 rounded-3xl p-6 space-y-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Sign In with College Roll Number
            </span>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 uppercase tracking-wider block">
                College Roll Number
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-orange-500 focus:bg-white transition-all"
                placeholder="e.g. 1602-25-001"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 uppercase tracking-wider block">
                Student Full Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:border-orange-500 focus:bg-white transition-all"
                placeholder="e.g. Priya Sharma"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Enter Student Canteen Portal ➔"}
            </button>
          </form>
        )}

        {/* Guest Alternative */}
        <div className="text-center pt-2">
          <Link
            href="/guest/main-canteen"
            className="text-xs text-amber-700 hover:text-amber-800 font-bold inline-flex items-center gap-1.5"
          >
            <span>Campus Visitor or Parent?</span>
            <span className="underline">Use Guest QR Screen (No Login Required) ➔</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-100 py-4 px-6 text-center text-xs text-slate-400">
        Smart Canteen · Student Portal Session Auth
      </footer>
    </div>
  );
}

