import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIncidentsQuery } from "../api/incidents";
import { SeverityBadge } from "../components/SeverityBadge";

export default function IncidentsPage() {
  const navigate = useNavigate();
  const [severity, setSeverity] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState<"latest" | "oldest">("latest");

  const incidentsQuery = useIncidentsQuery({
    page: 1,
    limit: 100,
    severity: severity || undefined,
    domain: domain || undefined,
    status: status || undefined,
  });

  const filtered = useMemo(() => {
    const rows = incidentsQuery.data?.data ?? [];

    const dateFiltered = rows.filter((row) => {
      const time = new Date(row.detectedAt).getTime();
      const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.MIN_SAFE_INTEGER;
      const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
      return time >= start && time <= end;
    });

    return [...dateFiltered].sort((a, b) => {
      const aTime = new Date(a.detectedAt).getTime();
      const bTime = new Date(b.detectedAt).getTime();
      return sort === "latest" ? bTime - aTime : aTime - bTime;
    });
  }, [incidentsQuery.data?.data, startDate, endDate, sort]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-100">Incidents</h2>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:grid-cols-6">
        <select value={domain} onChange={(event) => setDomain(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="">All Domains</option>
          <option value="IDENTITY">Identity</option>
          <option value="NETWORK">Network</option>
          <option value="INFRASTRUCTURE">Infrastructure</option>
        </select>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="CONTAINED">CONTAINED</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
        <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
        <select value={sort} onChange={(event) => setSort(event.target.value as "latest" | "oldest")} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="latest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Incident ID</th>
              <th className="px-3 py-2 text-left">Domain</th>
              <th className="px-3 py-2 text-left">Classification</th>
              <th className="px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Detected (IST)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((incident) => (
              <tr
                key={incident.id}
                className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/40"
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-200">{incident.id}</td>
                <td className="px-3 py-2">{incident.domain}</td>
                <td className="px-3 py-2">{incident.classification}</td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={incident.severity} />
                </td>
                <td className="px-3 py-2">{incident.status}</td>
                <td className="px-3 py-2 text-slate-300">
                  {new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                    hour12: false,
                  }).format(new Date(incident.detectedAt))}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-400" colSpan={6}>
                  No incidents found for selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
