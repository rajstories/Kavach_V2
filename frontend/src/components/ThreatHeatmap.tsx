import { useMemo, useState } from "react";

interface StateThreat {
  state: string;
  incidents: number;
  critical: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function colorForCount(count: number): string {
  if (count >= 20) {
    return "#ef4444";
  }
  if (count >= 12) {
    return "#f97316";
  }
  if (count >= 7) {
    return "#f59e0b";
  }
  if (count >= 3) {
    return "#22c55e";
  }
  return "#1e293b";
}

export function ThreatHeatmap({ stateData }: { stateData: StateThreat[] }) {
  const [hovered, setHovered] = useState<StateThreat | null>(null);

  const totals = useMemo(
    () => ({
      incidents: stateData.reduce((sum, item) => sum + item.incidents, 0),
      critical: stateData.reduce((sum, item) => sum + item.critical, 0),
    }),
    [stateData],
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Threat Heatmap (India)</h3>
        <p className="text-xs text-slate-400">
          Total: {totals.incidents} | Critical: {totals.critical}
        </p>
      </div>

      <div className="relative">
        <svg viewBox="0 0 360 430" className="h-[340px] w-full rounded-lg bg-slate-950/70 p-2">
          {stateData.map((state) => (
            <g key={state.state}>
              <rect
                x={state.x}
                y={state.y}
                width={state.w}
                height={state.h}
                rx="6"
                fill={colorForCount(state.incidents)}
                stroke="#334155"
                strokeWidth="1"
                onMouseEnter={() => setHovered(state)}
                onMouseLeave={() => setHovered(null)}
              />
              <text x={state.x + 4} y={state.y + 14} fontSize="9" fill="#e2e8f0">
                {state.state}
              </text>
            </g>
          ))}
        </svg>

        {hovered && (
          <div className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200">
            <p className="font-semibold">{hovered.state}</p>
            <p>Incidents: {hovered.incidents}</p>
            <p>Critical: {hovered.critical}</p>
          </div>
        )}
      </div>
    </div>
  );
}
