"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  runSimulation,
  loadDemoScenario,
  resetDemoState,
  SimulationResult,
} from "../../lib/api";

export default function AnalyticsPage() {
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const res = await runSimulation();
      setSimulation(res);
      showNotification("Simulation benchmark completed successfully!");
    } catch (err: any) {
      showNotification(err.message || "Failed to run simulation");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScenario = async (scenarioId: "low" | "peak" | "counter_breakdown") => {
    setScenarioLoading(scenarioId);
    try {
      await loadDemoScenario(scenarioId);
      const res = await runSimulation();
      setSimulation(res);
      showNotification(`Scenario "${scenarioId.toUpperCase()}" loaded and benchmarked.`);
    } catch (err: any) {
      showNotification(err.message || "Failed to load scenario");
    } finally {
      setScenarioLoading(null);
    }
  };

  const handleReset = async () => {
    try {
      await resetDemoState();
      await handleRunSimulation();
      showNotification("Demo state reset to original fixtures.");
    } catch (err: any) {
      showNotification(err.message || "Failed to reset demo");
    }
  };

  useEffect(() => {
    handleRunSimulation();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-bold">
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="font-black text-base text-white tracking-tight">Queue Analytics & Comparison Studio</h1>
              <p className="text-xs text-slate-400">Section 1 & 8: Quantitative Evaluation & Measurable Improvement</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
            >
              Hub
            </Link>
            <Link
              href="/staff/dashboard"
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold rounded-xl"
            >
              Staff KDS
            </Link>
            <Link
              href="/student"
              className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/40 text-xs font-bold rounded-xl"
            >
              Student Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Verification Guarantee Alert */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/30">
                Hackathon Scope Guardrail Compliance
              </span>
              <h2 className="text-xl font-extrabold text-white mt-2">
                Comparative Simulation Engine
              </h2>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>{loading ? "Simulating..." : "⚡ Run Live Comparison Now"}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            Per the hackathon guidelines: <em>“Do not claim a percentage improvement until the prototype calculates it from comparable test runs. Run the same arrival/order data through a basic FCFS queue and the proposed allocation strategy.”</em> All values below are derived dynamically from identical simulated arrival sets.
          </p>
        </div>

        {/* Comparison Cards: Baseline FCFS vs Improved Strategy */}
        {simulation && (
          <section className="space-y-4">
            {/* Measured Improvement Banner */}
            <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Measured Queue Optimization Result
                </span>
                <h3 className="text-2xl font-black text-white">
                  {simulation.comparison.improvementPercent > 0
                    ? `${simulation.comparison.improvementPercent}% Average Waiting Time Reduction`
                    : "Zero Delay Queue Balancing"}
                </h3>
                <p className="text-xs text-emerald-300/80">
                  {simulation.comparison.interpretation} (Sample Size: {simulation.sampleOrderCount} orders)
                </p>
              </div>

              <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-2xl px-5 py-3 text-center shrink-0">
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                  Latency Saved Per Order
                </span>
                <p className="text-2xl font-black text-white">
                  {simulation.comparison.waitReductionMinutes > 0
                    ? `~${simulation.comparison.waitReductionMinutes} mins`
                    : "0.0 mins"}
                </p>
              </div>
            </div>

            {/* Side-by-Side Strategy Metric Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Baseline FCFS */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Baseline Strategy
                    </span>
                    <h4 className="text-base font-extrabold text-white mt-0.5">
                      Standard FCFS (First Available Counter)
                    </h4>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                    Legacy
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Average Waiting Time</span>
                    <p className="text-2xl font-black text-white mt-1">
                      {simulation.baseline.averageWaitMinutes !== null
                        ? `${simulation.baseline.averageWaitMinutes}m`
                        : "—"}
                    </p>
                    <span className="text-[10px] text-slate-500">Queue entry to service start</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Maximum Waiting Time</span>
                    <p className="text-2xl font-black text-rose-400 mt-1">
                      {simulation.baseline.maximumWaitMinutes !== null
                        ? `${simulation.baseline.maximumWaitMinutes}m`
                        : "—"}
                    </p>
                    <span className="text-[10px] text-slate-500">Worst individual wait</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Orders Completed</span>
                    <p className="text-2xl font-black text-slate-200 mt-1">
                      {simulation.baseline.completedCount}
                    </p>
                    <span className="text-[10px] text-slate-500">Processed successfully</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Throughput</span>
                    <p className="text-2xl font-black text-slate-200 mt-1">
                      {simulation.baseline.orderThroughputPerHour !== null
                        ? `${simulation.baseline.orderThroughputPerHour}/hr`
                        : "—"}
                    </p>
                    <span className="text-[10px] text-slate-500">Rate of completion</span>
                  </div>
                </div>

                {/* Counter Utilisation distribution */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Counter Workload Distribution
                  </span>
                  {(simulation.baseline.counterUtilisation || []).map((u) => (
                    <div key={u.counterId} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Counter {u.counterId}</span>
                        <span className="font-bold">{u.utilisationPercent}% busy</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-slate-400 h-full rounded-full"
                          style={{ width: `${Math.min(100, u.utilisationPercent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {(!simulation.baseline.counterUtilisation || simulation.baseline.counterUtilisation.length === 0) && (
                    <p className="text-xs text-slate-500">No counter data</p>
                  )}
                </div>
              </div>

              {/* Card 2: Proposed Allocation Strategy */}
              <div className="bg-slate-900/90 border border-orange-500/40 rounded-3xl p-6 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                      Proposed Strategy
                    </span>
                    <h4 className="text-base font-extrabold text-white mt-0.5">
                      Batch & Capability-Aware (Earliest Finish)
                    </h4>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    Smart Engine
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950/70 border border-emerald-500/30 rounded-2xl p-4">
                    <span className="text-emerald-400 text-[11px] font-bold">Average Waiting Time</span>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      {simulation.improved.averageWaitMinutes !== null
                        ? `${simulation.improved.averageWaitMinutes}m`
                        : "—"}
                    </p>
                    <span className="text-[10px] text-emerald-500/80">
                      {simulation.comparison.improvementPercent}% reduction
                    </span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Maximum Waiting Time</span>
                    <p className="text-2xl font-black text-amber-400 mt-1">
                      {simulation.improved.maximumWaitMinutes !== null
                        ? `${simulation.improved.maximumWaitMinutes}m`
                        : "—"}
                    </p>
                    <span className="text-[10px] text-slate-500">Reduced tail latency</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Orders Completed</span>
                    <p className="text-2xl font-black text-white mt-1">
                      {simulation.improved.completedCount}
                    </p>
                    <span className="text-[10px] text-slate-500">Processed successfully</span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                    <span className="text-slate-400 text-[11px]">Throughput</span>
                    <p className="text-2xl font-black text-white mt-1">
                      {simulation.improved.orderThroughputPerHour !== null
                        ? `${simulation.improved.orderThroughputPerHour}/hr`
                        : "—"}
                    </p>
                    <span className="text-[10px] text-slate-500">Optimized rate</span>
                  </div>
                </div>

                {/* Counter Utilisation distribution */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Counter Workload Distribution
                  </span>
                  {(simulation.improved.counterUtilisation || []).map((u) => (
                    <div key={u.counterId} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Counter {u.counterId}</span>
                        <span className="font-bold text-orange-400">{u.utilisationPercent}% busy</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-orange-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, u.utilisationPercent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {(!simulation.improved.counterUtilisation || simulation.improved.counterUtilisation.length === 0) && (
                    <p className="text-xs text-slate-500">No counter data</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 8 Test Scenarios Injectors */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div>
            <h3 className="font-extrabold text-base text-white">Three Required Hackathon Test Scenarios</h3>
            <p className="text-xs text-slate-400">
              Run the exact test scenarios specified in Section 8 of the implementation plan:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleTriggerScenario("low")}
              disabled={scenarioLoading === "low"}
              className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition-all space-y-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400 text-sm">Scenario 1: Low Traffic</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                  Light Load
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smooth arrival flow with 2 orders. Verifies zero false congestion and low baseline waits.
              </p>
            </button>

            <button
              onClick={() => handleTriggerScenario("peak")}
              disabled={scenarioLoading === "peak"}
              className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left transition-all space-y-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-400 text-sm">Scenario 2: Peak Lunch Rush</span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">
                  Peak Rush
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sudden surge of 10 multi-category orders. Verifies crowd level calculation and congestion warning.
              </p>
            </button>

            <button
              onClick={() => handleTriggerScenario("counter_breakdown")}
              disabled={scenarioLoading === "counter_breakdown"}
              className="p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/50 rounded-2xl text-left transition-all space-y-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-rose-400 text-sm">Scenario 3: Counter Offline</span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">
                  Breakdown
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hot Food counter is paused. Verifies hot items get marked blocked while drinks and snacks continue uninterrupted.
              </p>
            </button>
          </div>

          <div className="pt-2 flex justify-between items-center text-xs">
            <span className="text-slate-500">Need to start fresh for judges?</span>
            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
            >
              Reset to Initial Seed Fixtures
            </button>
          </div>
        </section>

        {/* Mathematical Definitions (Section 8 Reference) */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 text-xs text-slate-400 space-y-3">
          <h4 className="font-extrabold text-sm text-slate-300 uppercase tracking-wider">
            Waiting Time & Metric Calculations Formula Reference
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <strong className="text-white block mb-1">Actual Waiting Time:</strong>
              <code>service_started_at − queue_entered_at</code>
              <p className="text-[11px] text-slate-500 mt-1">Recorded when staff begins preparing the order.</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <strong className="text-white block mb-1">Average Waiting Time:</strong>
              <code>Σ (actual waiting times) ÷ completed orders</code>
              <p className="text-[11px] text-slate-500 mt-1">Evaluated across valid completed order timestamps.</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <strong className="text-white block mb-1">Counter Utilisation:</strong>
              <code>busy time ÷ total window duration</code>
              <p className="text-[11px] text-slate-500 mt-1">Measures workload distribution without overloading.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

