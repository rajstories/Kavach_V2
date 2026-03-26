import { ShieldAlert, UserRound, Waypoints } from "lucide-react";
import type { Incident } from "../types";
import { SeverityBadge } from "./SeverityBadge";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  return `${Math.floor(diffMin / 60)}h ago`;
}

function domainIcon(domain: string) {
  if (domain === "IDENTITY") {
    return <UserRound className="h-4 w-4" />;
  }

  if (domain === "NETWORK") {
    return <Waypoints className="h-4 w-4" />;
  }

  return <ShieldAlert className="h-4 w-4" />;
}

function borderClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "border-l-red-500";
    case "HIGH":
      return "border-l-orange-500";
    case "MEDIUM":
      return "border-l-amber-500";
    default:
      return "border-l-sky-500";
  }
}

export function IncidentFeed({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">Incident Feed</h3>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2 scrollbar-thin">
        {incidents.map((incident) => (
          <div
            key={incident.id}
            className={`rounded-lg border border-slate-800 bg-slate-950/80 border-l-4 p-3 ${borderClass(incident.severity)}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                {domainIcon(incident.domain)}
                <span>{incident.classification}</span>
              </div>
              <SeverityBadge severity={incident.severity} />
            </div>
            <p className="text-xs text-slate-400">{incident.affectedService}</p>
            <p className="mt-1 text-xs text-slate-500">{timeAgo(incident.detectedAt)}</p>
          </div>
        ))}

        {incidents.length === 0 && <p className="text-sm text-slate-400">No incidents in the current window.</p>}
      </div>
    </div>
  );
}
