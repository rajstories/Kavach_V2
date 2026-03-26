import { useEffect, useState } from "react";
import { useSimulationMutation } from "../api/logs";
import { PipelineStatus } from "../components/PipelineStatus";

const scenarioOptions = [
  { label: "Voter Portal Brute Force", value: "brute_force" },
  { label: "Aadhaar API DDoS", value: "ddos" },
  { label: "Municipal Portal Data Exfiltration", value: "data_exfiltration" },
  { label: "Election Commission SQL Injection", value: "sql_injection" },
  { label: "Aadhaar Credential Stuffing", value: "credential_stuffing" },
];

type StepStatus = "pending" | "running" | "done";

interface Step {
  step: string;
  status: StepStatus;
  detail?: string;
}

const baseSteps: Step[] = [
  { step: "Logs Ingested", status: "pending" },
  { step: "Rule Filter", status: "pending" },
  { step: "ML Screening", status: "pending" },
  { step: "AI Analysis", status: "pending" },
  { step: "Remediation", status: "pending" },
];

export default function SimulatorPage() {
  const [scenario, setScenario] = useState("brute_force");
  const [steps, setSteps] = useState<Step[]>(baseSteps);
  const mutation = useSimulationMutation();

  useEffect(() => {
    if (!mutation.isPending) {
      return;
    }

    setSteps(baseSteps);
    let current = 0;

    const timer = window.setInterval(() => {
      setSteps((prev) =>
        prev.map((item, index) => {
          if (index < current) {
            return { ...item, status: "done" as StepStatus };
          }
          if (index === current) {
            return { ...item, status: "running" as StepStatus };
          }
          return { ...item, status: "pending" as StepStatus };
        }),
      );

      current += 1;
      if (current > baseSteps.length) {
        window.clearInterval(timer);
      }
    }, 700);

    return () => {
      window.clearInterval(timer);
    };
  }, [mutation.isPending]);

  useEffect(() => {
    if (!mutation.data) {
      return;
    }

    setSteps([
      {
        step: "Logs Ingested",
        status: "done",
        detail: `${mutation.data.logsReceived} logs received`,
      },
      {
        step: "Rule Filter",
        status: "done",
        detail: `${mutation.data.logsDiscarded} discarded, ${mutation.data.logsEscalatedCritical} auto-critical`,
      },
      {
        step: "ML Screening",
        status: "done",
        detail: `${mutation.data.mlScreening.anomaliesDetected}/${mutation.data.mlScreening.totalScreened} flagged`,
      },
      {
        step: "AI Analysis",
        status: "done",
        detail: `${mutation.data.logsAnalyzed} analyzed, ${mutation.data.findingsCount} findings`,
      },
      {
        step: "Remediation",
        status: "done",
        detail: `${mutation.data.incidentsCreated} incidents created`,
      },
    ]);

    try {
      window.localStorage.setItem(
        "kavach:last-simulation-screening",
        JSON.stringify({
          executionId: mutation.data.executionId,
          logsReceived: mutation.data.logsReceived,
          logsDiscarded: mutation.data.logsDiscarded,
          mlScreening: mutation.data.mlScreening,
          filterStats: mutation.data.filterStats,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // no-op
    }
  }, [mutation.data]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-100">Attack Simulator</h2>
        <p className="mt-1 text-sm text-slate-400">Demo page for March 28 live walkthrough.</p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            {scenarioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            onClick={() => mutation.mutate(scenario)}
            disabled={mutation.isPending}
          >
            Launch Attack Simulation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <PipelineStatus steps={steps} />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-panel xl:col-span-2">
          <h3 className="text-lg font-semibold text-slate-100">Simulation Results</h3>

          {mutation.isPending ? <p className="text-sm text-slate-400">Running simulation pipeline...</p> : null}

          {mutation.data ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Logs Received" value={mutation.data.logsReceived} />
                <Metric label="Discarded (L1)" value={mutation.data.logsDiscarded} />
                <Metric label="ML Anomalies" value={mutation.data.mlScreening.anomaliesDetected} />
                <Metric label="Incidents" value={mutation.data.incidentsCreated} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Cost Impact</p>
                  <p className="mt-1 text-sm text-slate-200">
                    Without filter: {mutation.data.costImpact.withoutFilter.estimatedCost} (
                    {mutation.data.costImpact.withoutFilter.mlCalls} ML calls)
                  </p>
                  <p className="text-sm text-slate-200">
                    With filter: {mutation.data.costImpact.withFilter.estimatedCost} (
                    {mutation.data.costImpact.withFilter.mlCalls} ML calls)
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-400">
                    Savings: {mutation.data.costImpact.savings}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">ML Civic Contexts</p>
                  {mutation.data.mlScreening.civicContexts.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {mutation.data.mlScreening.civicContexts.map((item) => (
                        <div key={item.civicContext} className="flex items-start justify-between gap-3">
                          <p className="text-xs text-slate-300">{item.civicContext}</p>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-100">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">No anomalous civic contexts in this run.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-3">
                  <p>
                    Execution: <span className="font-mono">{mutation.data.executionId}</span>
                  </p>
                  <p>
                    Processing Time: <span className="font-semibold">{mutation.data.processingTimeMs}ms</span>
                  </p>
                  <p>
                    Scenario: <span className="font-semibold">{mutation.data.scenarioUsed ?? scenario}</span>
                  </p>
                </div>
                {typeof mutation.data.syntheticLogsGenerated === "number" ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Synthetic logs generated: {mutation.data.syntheticLogsGenerated}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Run a scenario to see detection and remediation details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-100">{value}</p>
    </div>
  );
}
