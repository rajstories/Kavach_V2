import { useParams } from "react-router-dom";
import { useIncidentQuery, useUpdateIncidentStatusMutation } from "../api/incidents";
import { SeverityBadge } from "../components/SeverityBadge";

const nextStatusMap: Record<string, string | null> = {
  OPEN: "CONTAINED",
  CONTAINED: "RESOLVED",
  RESOLVED: null,
  ARCHIVED: null,
};

export default function IncidentDetail() {
  const { id = "" } = useParams();
  const incidentQuery = useIncidentQuery(id);
  const mutation = useUpdateIncidentStatusMutation();

  const incident = incidentQuery.data;
  const nextStatus = incident ? nextStatusMap[incident.status] : null;

  if (incidentQuery.isLoading) {
    return <p className="text-slate-300">Loading incident...</p>;
  }

  if (!incident) {
    return <p className="text-slate-300">Incident not found.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Incident</p>
            <h2 className="font-mono text-lg text-slate-100">{incident.id}</h2>
          </div>
          <SeverityBadge severity={incident.severity} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
          <Meta title="Domain" value={incident.domain} />
          <Meta title="Classification" value={incident.classification} />
          <Meta title="Confidence" value={incident.confidence.toFixed(2)} />
          <Meta title="Status" value={incident.status} />
          <Meta title="Offender" value={`${incident.offenderType}:${incident.offenderValue}`} />
          <Meta title="Affected Service" value={incident.affectedService} />
          <Meta
            title="Detected (IST)"
            value={new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short",
              hour12: false,
            }).format(new Date(incident.detectedAt))}
          />
        </div>

        {nextStatus ? (
          <button
            type="button"
            className="mt-5 rounded-md bg-kavach-accent px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            onClick={() => mutation.mutate({ id: incident.id, status: nextStatus })}
            disabled={mutation.isPending}
          >
            Update Status to {nextStatus}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
          <h3 className="mb-3 text-base font-semibold">Evidence Logs</h3>
          <div className="space-y-2">
            {incident.evidenceJson.map((line, index) => (
              <pre key={`${line}-${index}`} className="overflow-x-auto rounded-md bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                {line}
              </pre>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
          <h3 className="mb-3 text-base font-semibold">Remediation Timeline</h3>
          <div className="space-y-3">
            {incident.remediations.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950/70 p-3 text-sm">
                <p className="font-semibold text-slate-200">{item.agentType}</p>
                <p className="text-xs text-slate-400">{item.actionTaken.join(", ")}</p>
                <p className="text-xs text-slate-500">
                  {new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                    hour12: false,
                  }).format(new Date(item.executedAt))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
        <h3 className="mb-3 text-base font-semibold">Alert History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-2 py-2">Channel</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Message</th>
                <th className="px-2 py-2">Time (IST)</th>
              </tr>
            </thead>
            <tbody>
              {incident.alerts.map((alert) => (
                <tr key={alert.id} className="border-b border-slate-900">
                  <td className="px-2 py-2">{alert.channel}</td>
                  <td className="px-2 py-2">{alert.status}</td>
                  <td className="px-2 py-2">{alert.messagePreview}</td>
                  <td className="px-2 py-2 text-xs text-slate-400">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                      hour12: false,
                    }).format(new Date(alert.sentAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Meta({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-slate-200">{value}</p>
    </div>
  );
}
