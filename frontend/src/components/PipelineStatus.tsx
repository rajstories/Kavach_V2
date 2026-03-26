interface PipelineStep {
  step: string;
  status: "pending" | "running" | "done";
  detail?: string;
}

function statusClass(status: PipelineStep["status"]): string {
  if (status === "done") {
    return "bg-emerald-500 border-emerald-300";
  }
  if (status === "running") {
    return "bg-amber-400 border-amber-200 animate-pulse";
  }
  return "bg-slate-700 border-slate-500";
}

export function PipelineStatus({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">Pipeline Status</h3>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.step} className="flex items-start gap-3">
            <div className={`mt-0.5 h-4 w-4 rounded-full border ${statusClass(step.status)}`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">
                {index + 1}. {step.step}
              </p>
              {step.detail ? <p className="text-xs text-slate-400">{step.detail}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
