import Link from "next/link";

export default function RootHomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div>
              <h1 className="font-black text-lg text-white tracking-tight">Smart Canteen</h1>
              <p className="text-xs text-slate-400">Queue Management & Waiting-Time Analysis Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Hackathon Ready (P0 & P1 Complete)
            </span>
          </div>
        </div>
      </header>

      {/* Main Experience Selector */}
      <main className="max-w-6xl mx-auto px-6 py-10 w-full space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Smart Canteen System Portals
          </h2>
          <p className="text-slate-400 text-sm">
            Demonstrating measurable queue improvement through dynamic counter allocation, batch scheduling, and live waiting-time analysis.
          </p>
        </div>

        {/* 4 Connected Portals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2">
          {/* Card 1: Student App */}
          <Link
            href="/student"
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-orange-500/60 rounded-3xl p-5 transition-all shadow-xl flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                📱
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-orange-400 uppercase tracking-wider">
                  Mobile PWA
                </span>
                <h3 className="text-lg font-black text-white mt-0.5 group-hover:text-orange-300 transition-colors">
                  Student Portal
                </h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Browse menu, stock status, cart with estimated wait preview, instant token generation, and live countdown tracker.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-orange-400">
              <span>Open Student App</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </Link>

          {/* Card 2: Guest QR Webpage */}
          <Link
            href="/guest/main-canteen"
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 transition-all shadow-xl flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                  Frictionless Scan
                </span>
                <h3 className="text-lg font-black text-white mt-0.5 group-hover:text-amber-300 transition-colors">
                  Guest QR Page
                </h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Zero mandatory registration. Express ordering for campus visitors with unguessable digital tokens and ETA tracking.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
              <span>Open Guest QR</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </Link>

          {/* Card 3: Staff KDS Dashboard */}
          <Link
            href="/staff/dashboard"
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-3xl p-5 transition-all shadow-xl flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                🖥️
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-wider">
                  Kitchen KDS
                </span>
                <h3 className="text-lg font-black text-white mt-0.5 group-hover:text-blue-300 transition-colors">
                  Staff Dashboard
                </h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Manage multiple counters, status transitions (Start, Ready, Complete), delays, item availability, and inventory stock.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-blue-400">
              <span>Open Kitchen KDS</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </Link>

          {/* Card 4: Analytics & Comparison Simulator */}
          <Link
            href="/analytics"
            className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-3xl p-5 transition-all shadow-xl flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                📊
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                  Judge Benchmarks
                </span>
                <h3 className="text-lg font-black text-white mt-0.5 group-hover:text-emerald-300 transition-colors">
                  Queue Analytics
                </h3>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Side-by-side comparison of Baseline FCFS vs Proposed Allocation Strategy on identical test arrival datasets.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>View Analytics</span>
              <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </Link>
        </div>

        {/* Direct Access Quick-Links Directory */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <span>🔗</span>
                <span>Direct Feature Links & Navigation Directory</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Quick jump to any portal or workflow. All components run synchronized on the unified backend.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold">
              Live Monolith
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            {/* Student Section */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2">
              <span className="font-black text-orange-400 uppercase tracking-wider text-[11px] block flex items-center gap-1.5">
                <span>🎓</span>
                <span>Student Experience</span>
              </span>
              <div className="space-y-1.5 pt-1">
                <Link
                  href="/student/login"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-orange-600/20 text-slate-200 hover:text-orange-300 transition-colors font-medium"
                >
                  <span>Student Login</span>
                  <code className="text-[10px] text-orange-400 font-mono">/student/login</code>
                </Link>
                <Link
                  href="/student?tab=menu"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-orange-600/20 text-slate-200 hover:text-orange-300 transition-colors font-medium"
                >
                  <span>Menu & Ordering</span>
                  <code className="text-[10px] text-orange-400 font-mono">/student</code>
                </Link>
                <Link
                  href="/student/cart"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-orange-600/20 text-slate-200 hover:text-orange-300 transition-colors font-medium"
                >
                  <span>Cart & ETA Preview</span>
                  <code className="text-[10px] text-orange-400 font-mono">/student/cart</code>
                </Link>
                <Link
                  href="/student?tab=tracker"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-orange-600/20 text-slate-200 hover:text-orange-300 transition-colors font-medium"
                >
                  <span>Live Queue Tracker</span>
                  <code className="text-[10px] text-orange-400 font-mono">/student?tab=tracker</code>
                </Link>
                <Link
                  href="/student/orders"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-orange-600/20 text-slate-200 hover:text-orange-300 transition-colors font-medium"
                >
                  <span>Order History</span>
                  <code className="text-[10px] text-orange-400 font-mono">/student/orders</code>
                </Link>
              </div>
            </div>

            {/* Staff & Kitchen Section */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2">
              <span className="font-black text-blue-400 uppercase tracking-wider text-[11px] block flex items-center gap-1.5">
                <span>🖥️</span>
                <span>Staff & Kitchen Console</span>
              </span>
              <div className="space-y-1.5 pt-1">
                <Link
                  href="/staff/login"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-blue-600/20 text-slate-200 hover:text-blue-300 transition-colors font-medium"
                >
                  <span>Staff Login</span>
                  <code className="text-[10px] text-blue-400 font-mono">/staff/login</code>
                </Link>
                <Link
                  href="/staff/dashboard"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-blue-600/20 text-slate-200 hover:text-blue-300 transition-colors font-medium"
                >
                  <span>Kitchen Display (KDS)</span>
                  <code className="text-[10px] text-blue-400 font-mono">/staff/dashboard</code>
                </Link>
                <Link
                  href="/staff/inventory"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-blue-600/20 text-slate-200 hover:text-blue-300 transition-colors font-medium"
                >
                  <span>Stock & Audit Events</span>
                  <code className="text-[10px] text-blue-400 font-mono">/staff/inventory</code>
                </Link>
              </div>
            </div>

            {/* Guest & Analytics Section */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2">
              <span className="font-black text-emerald-400 uppercase tracking-wider text-[11px] block flex items-center gap-1.5">
                <span>⚡</span>
                <span>Guest QR & Evaluation</span>
              </span>
              <div className="space-y-1.5 pt-1">
                <Link
                  href="/guest/login"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-amber-600/20 text-slate-200 hover:text-amber-300 transition-colors font-medium"
                >
                  <span>Guest Login & Access</span>
                  <code className="text-[10px] text-amber-400 font-mono">/guest/login</code>
                </Link>
                <Link
                  href="/guest/main-canteen"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-amber-600/20 text-slate-200 hover:text-amber-300 transition-colors font-medium"
                >
                  <span>Guest QR Ordering</span>
                  <code className="text-[10px] text-amber-400 font-mono">/guest/main-canteen</code>
                </Link>
                <Link
                  href="/guest/north-canteen"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-amber-600/20 text-slate-200 hover:text-amber-300 transition-colors font-medium"
                >
                  <span>North Canteen QR</span>
                  <code className="text-[10px] text-amber-400 font-mono">/guest/north-canteen</code>
                </Link>
                <Link
                  href="/analytics"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 hover:bg-emerald-600/20 text-slate-200 hover:text-emerald-300 transition-colors font-medium"
                >
                  <span>Queue Analytics & Simulator</span>
                  <code className="text-[10px] text-emerald-400 font-mono">/analytics</code>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Checklist Mapping directly to Hackathon Document */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">
              Hackathon Plan Compliance & Verification Matrix
            </h3>
            <span className="text-xs text-emerald-400 font-bold">100% Implemented</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <strong className="text-white block font-bold">P0 — Must Have Features</strong>
              <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                <li>Menu with live stock & availability recheck</li>
                <li>Order creation with unique token generation (T021, T022...)</li>
                <li>Live queue position, estimated wait & multi-counter routing</li>
                <li>Staff actions: QUEUED ➔ PREPARING ➔ READY ➔ COMPLETED</li>
                <li>Actual Average & Maximum wait recording (service_start − queue_entry)</li>
                <li>Counter utilisation calculation & tie-break edge cases</li>
              </ul>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <strong className="text-white block font-bold">P1 — Should Have Features & Scenarios</strong>
              <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                <li>Batch preparation capacity: Math.ceil(qty / batchSize) * prepTime</li>
                <li>Counter capabilities: 4 Take Away Counters (C01 - C04) with auto-balancing</li>
                <li>Dynamic Crowd Level: LOW, MODERATE, HIGH, PEAK + Congestion Alert</li>
                <li>Estimated wait time preview in cart before order confirmation</li>
                <li>Guest QR express entry without mandatory login</li>
                <li>3 Test Scenarios: Low traffic, Peak lunch rush, Counter breakdown</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Demo Credentials Quick Reference */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>
              <strong>Demo Accounts:</strong> Student A (<code>1602-25-001</code>), Student B (<code>1602-25-002</code>), Staff (<code>staff@canteen.edu</code>)
            </span>
          </div>
          <span className="text-slate-500">Modular Monolith · Express API on port 4000</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        Smart Canteen Architecture · Built for Hackathon Evaluation
      </footer>
    </div>
  );
}
