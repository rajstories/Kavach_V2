import type { IncidentSeverity } from "../types";

const palette: Record<IncidentSeverity, string> = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-400/70",
  HIGH: "bg-orange-500/20 text-orange-200 border-orange-400/70",
  MEDIUM: "bg-amber-500/20 text-amber-200 border-amber-400/70",
  LOW: "bg-sky-500/20 text-sky-200 border-sky-400/70",
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${palette[severity]}`}>
      {severity}
    </span>
  );
}
