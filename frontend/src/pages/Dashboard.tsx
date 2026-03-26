import React, { useEffect, useMemo, useState } from 'react';
import { GovernmentCard } from '../components/GovernmentCard';
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react';
interface LastSimulationSnapshot {
  executionId: string;
  logsReceived: number;
  logsDiscarded: number;
  mlScreening: {
    anomaliesDetected: number;
    totalScreened: number;
    civicContexts: Array<{ civicContext: string; count: number }>;
  };
  filterStats: {
    percentFiltered: number;
  };
  updatedAt: string;
}

export default function Dashboard() {
  const [lastScreening, setLastScreening] = useState<LastSimulationSnapshot | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('kavach:last-simulation-screening');
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as LastSimulationSnapshot;
      setLastScreening(parsed);
    } catch {
      // no-op
    }
  }, []);

  const topCivicContext = useMemo(() => {
    if (!lastScreening || lastScreening.mlScreening.civicContexts.length === 0) {
      return null;
    }
    return [...lastScreening.mlScreening.civicContexts].sort((a, b) => b.count - a.count)[0];
  }, [lastScreening]);
  return (
    <div>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Total Incidents</p>
            <h3 className="text-2xl font-bold text-slate-800">1,248</h3>
          </div>
          <div className="flex items-center mt-3 text-sm">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-semibold">
              +2.4%
            </span>
            <span className="text-slate-400 ml-2 text-xs">vs last week</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-[var(--gov-saffron)]"></div>
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Critical Active</p>
            <h3 className="text-2xl font-bold text-slate-800">42</h3>
          </div>
          <div className="flex items-center mt-3 text-sm">
            <span className="text-[var(--gov-saffron)] font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Needs Attention
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Contained Today</p>
            <h3 className="text-2xl font-bold text-slate-800">89%</h3>
          </div>
          <div className="flex items-center mt-3 text-sm">
            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-semibold">
              +1.2%
            </span>
            <span className="text-slate-400 ml-2 text-xs">Efficiency rate</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Avg. Response Time</p>
            <h3 className="text-2xl font-bold text-slate-800">14m 32s</h3>
          </div>
          <div className="flex items-center mt-3 text-sm">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <TrendingUp className="h-4 w-4 rotate-180" />
              -2m improvement
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Last ML Civic Context</p>
            <h3 className="text-sm font-bold text-slate-800 leading-5">
              {topCivicContext ? topCivicContext.civicContext : "No simulation data yet"}
            </h3>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {lastScreening ? (
              <div className="space-y-0.5">
                <p>
                  Count: <span className="font-semibold text-slate-700">{topCivicContext?.count ?? 0}</span>
                </p>
                <p>
                  Filtered: <span className="font-semibold text-slate-700">{lastScreening.filterStats.percentFiltered}%</span>
                </p>
              </div>
            ) : (
              <p>Run a simulation to populate civic context insights.</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts & Tables */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Incidents Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Incidents - Last 24 Hours</h3>
                <p className="text-sm text-slate-500">Hourly volume of detected security events</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-[var(--gov-navy)] text-white text-xs px-2.5 py-1.5 rounded cursor-pointer font-medium">
                  All
                </span>
                <span className="text-slate-500 text-xs px-2.5 py-1.5 hover:bg-slate-100 rounded cursor-pointer font-medium border border-slate-200">
                  Critical
                </span>
              </div>
            </div>
            <div className="relative h-72 flex">
              <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-3 pb-6 border-r border-slate-100">
                <span>150</span>
                <span>100</span>
                <span>50</span>
                <span>0</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-end justify-between px-4 pb-0 pt-2 gap-2 relative">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none px-4">
                    <div className="w-full border-t border-slate-50 mt-[0%]"></div>
                    <div className="w-full border-t border-slate-50 mt-[33.3%]"></div>
                    <div className="w-full border-t border-slate-50 mt-[33.3%]"></div>
                    <div className="w-full border-t border-slate-100 mt-auto"></div>
                  </div>
                  {[35, 30, 28, 25, 22, 35, 45, 60, 75, 65, 55, 48, 42, 40, 52, 68, 72, 60, 50, 45, 40, 35, 42, 38].map(
                    (height, i) => (
                      <div
                        key={i}
                        className={`flex-1 bg-[var(--gov-navy)] rounded-t-[2px] hover:opacity-80 transition-opacity ${
                          i % 4 === 0 ? '' : 'opacity-20 sm:opacity-100'
                        }`}
                        style={{ height: `${height}%` }}
                        title={`${String(i).padStart(2, '0')}:00 - ${Math.round((height / 100) * 150)} incidents`}
                      ></div>
                    )
                  )}
                </div>
                <div className="flex justify-between px-4 mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                  <span className="w-0 flex justify-center">00:00</span>
                  <span className="w-0 flex justify-center">04:00</span>
                  <span className="w-0 flex justify-center">08:00</span>
                  <span className="w-0 flex justify-center">12:00</span>
                  <span className="w-0 flex justify-center">16:00</span>
                  <span className="w-0 flex justify-center">20:00</span>
                  <span className="w-0 flex justify-center">23:59</span>
                </div>
              </div>
            </div>
          </div>

          {/* Protected Portals Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Protected Portals Status</h3>
              <button className="text-[var(--gov-navy)] text-sm font-medium hover:underline">
                View All Services
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Portal Service</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Traffic</th>
                    <th className="px-6 py-4 font-semibold text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      Aadhaar Services
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        ✓ Normal
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">1.2M req/s</td>
                    <td className="px-6 py-4 text-slate-600 text-right font-mono">45ms</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors bg-[var(--gov-saffron)]/5">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[var(--gov-saffron)]"></div>
                      UPI Gateway
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--gov-saffron)]/10 text-[var(--gov-saffron)] border border-[var(--gov-saffron)]/20">
                        ⚠ At Risk
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">8.5M req/s</td>
                    <td className="px-6 py-4 text-right font-mono text-[var(--gov-saffron)] font-bold">
                      120ms
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      DigiLocker
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        ✓ Normal
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">450k req/s</td>
                    <td className="px-6 py-4 text-slate-600 text-right font-mono">32ms</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      IRCTC
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        ✓ Normal
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">2.1M req/s</td>
                    <td className="px-6 py-4 text-slate-600 text-right font-mono">68ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Live Feed & Threat Breakdown */}
        <div className="flex flex-col gap-6">
          {/* Live Incident Feed */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full max-h-[500px]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span className="text-[var(--gov-saffron)] text-xl">📡</span>
                Live Incident Feed
              </h3>
              <button className="text-slate-400 hover:text-[var(--gov-navy)]">
                <span className="text-xl">☰</span>
              </button>
            </div>
            <div className="overflow-y-auto p-0">
              <div className="p-4 border-b border-slate-100 border-l-4 border-l-[var(--gov-saffron)] hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-semibold text-slate-800">DDoS Attempt on UPI</h4>
                  <span className="text-[10px] font-bold text-[var(--gov-saffron)] uppercase tracking-wider">
                    Critical
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Unusual traffic spike detected targeting payment gateway.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 2m ago
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    #INC-9921
                  </span>
                </div>
              </div>
              <div className="p-4 border-b border-slate-100 border-l-4 border-l-[var(--gov-navy)] hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-semibold text-slate-800">Malware Signature</h4>
                  <span className="text-[10px] font-bold text-[var(--gov-navy)] uppercase tracking-wider">
                    Medium
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Heuristic analysis flagged a suspicious executable on WS-402.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 15m ago
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    #INC-9920
                  </span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center rounded-b-lg">
              <button className="text-xs text-[var(--gov-navy)] font-bold uppercase tracking-wide">
                View Full Log
              </button>
            </div>
          </div>

          {/* Threat Domain Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex flex-col">
            <h3 className="text-base font-bold text-slate-800 mb-4">Threat Domain Breakdown</h3>
            <div className="flex items-center gap-4">
              <div
                className="relative w-32 h-32 flex-shrink-0 rounded-full"
                style={{
                  background:
                    'conic-gradient(#1a237e 0% 45%, #FF9933 45% 65%, #64748b 65% 85%, #94a3b8 85% 100%)',
                }}
              >
                <div className="absolute inset-0 m-auto w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <span className="block text-xs text-slate-400">Total</span>
                    <span className="block text-lg font-bold text-slate-800">856</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--gov-navy)]"></span>
                    <span className="text-slate-600">Malware</span>
                  </div>
                  <span className="font-bold text-slate-800">45%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[var(--gov-saffron)]"></span>
                    <span className="text-slate-600">DDoS</span>
                  </div>
                  <span className="font-bold text-slate-800">20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
