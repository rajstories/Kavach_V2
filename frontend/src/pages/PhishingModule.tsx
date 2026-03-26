import { useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

type DepartmentRow = {
  name: string;
  clickRate: number;
  trainingCompletion: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  trend: number[];
};

const rows: DepartmentRow[] = [
  { name: "NIC", clickRate: 8.1, trainingCompletion: 93, risk: "LOW", trend: [9, 8.6, 8.5, 8.1] },
  { name: "UIDAI", clickRate: 12.4, trainingCompletion: 88, risk: "MEDIUM", trend: [14, 13.1, 12.8, 12.4] },
  { name: "ECI", clickRate: 16.9, trainingCompletion: 81, risk: "HIGH", trend: [17.5, 17.4, 17.2, 16.9] },
  { name: "MCD", clickRate: 10.8, trainingCompletion: 86, risk: "MEDIUM", trend: [12.4, 11.8, 11.2, 10.8] },
  { name: "Delhi Police", clickRate: 7.2, trainingCompletion: 95, risk: "LOW", trend: [8.7, 8.3, 7.8, 7.2] },
  { name: "NDMC", clickRate: 11.5, trainingCompletion: 84, risk: "MEDIUM", trend: [13, 12.4, 11.9, 11.5] },
];

function riskBadge(risk: DepartmentRow["risk"]): string {
  if (risk === "HIGH") {
    return "bg-red-500/20 text-red-300 border-red-500/60";
  }
  if (risk === "MEDIUM") {
    return "bg-amber-500/20 text-amber-200 border-amber-500/60";
  }
  return "bg-emerald-500/20 text-emerald-200 border-emerald-500/60";
}

export default function PhishingModule() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Phishing Awareness Dashboard</h2>
        <button
          type="button"
          className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
          onClick={() => setShowModal(true)}
        >
          Run Simulation
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Click Rate %</th>
              <th className="px-3 py-2 text-left">Training Completion %</th>
              <th className="px-3 py-2 text-left">Risk Level</th>
              <th className="px-3 py-2 text-left">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-slate-800">
                <td className="px-3 py-2 text-slate-100">{row.name}</td>
                <td className="px-3 py-2 text-slate-200">{row.clickRate.toFixed(1)}</td>
                <td className="px-3 py-2 text-slate-200">{row.trainingCompletion}%</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full border px-2 py-1 text-xs ${riskBadge(row.risk)}`}>{row.risk}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="h-10 w-24">
                    <ResponsiveContainer>
                      <LineChart data={row.trend.map((value, index) => ({ index, value }))}>
                        <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 text-center">
            <h3 className="text-lg font-semibold text-slate-100">Simulation Coming Soon</h3>
            <p className="mt-2 text-sm text-slate-400">Department-level phishing simulator is queued for next release.</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
