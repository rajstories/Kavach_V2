import { useState } from "react";
import { useMLStatusQuery, useMLSwitchMutation } from "../api/ml";

const COLORS = {
  navy: "#1a237e",
  successBg: "#e8f5e9",
  successText: "#2e7d32",
  warningBg: "#fffde7",
  warningText: "#f57f17",
  border: "#e0e0e0",
  cardBg: "#ffffff",
};

const VERSION_INSIGHTS: Record<string, string> = {
  v1: "Detecting based on statistical deviation from benign traffic baseline",
  v2: "Enhanced with patterns from 5 contained attacks — brute force, DDoS, credential stuffing, voter auth attack, recon pattern",
};

export default function MLVersionWidget() {
  const { data, isLoading, isError } = useMLStatusQuery();
  const switchMutation = useMLSwitchMutation();
  const [toast, setToast] = useState<string | null>(null);

  const currentVersion = data?.current_version ?? "v1";
  const versions = data?.versions ?? {};
  const versionKeys = Object.keys(versions).sort();

  function handleSwitch(version: string) {
    if (version === currentVersion || switchMutation.isPending) return;
    switchMutation.mutate(version, {
      onSuccess: (res) => {
        setToast(res.message);
        setTimeout(() => setToast(null), 4000);
      },
      onError: () => {
        setToast("Failed to switch model — ML service may be down");
        setTimeout(() => setToast(null), 4000);
      },
    });
  }

  return (
    <div
      style={{
        background: COLORS.cardBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Header */}
      <h3
        style={{
          margin: "0 0 16px 0",
          fontSize: 16,
          fontWeight: 700,
          color: COLORS.navy,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20 }}>🧠</span>
        ML Model — Continuous Hardening
      </h3>

      {/* Toast */}
      {toast && (
        <div
          style={{
            background: COLORS.successBg,
            color: COLORS.successText,
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          {toast}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <p style={{ color: "#64748b", fontSize: 13 }}>Loading model status...</p>
      )}

      {/* Error state */}
      {isError && !data && (
        <p style={{ color: COLORS.warningText, fontSize: 13 }}>
          ML service unreachable — showing cached config
        </p>
      )}

      {/* Comparison Table */}
      {versionKeys.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `2px solid ${COLORS.border}`,
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 600 }}>
                  Version
                </th>
                <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 600 }}>
                  Incidents Used
                </th>
                <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 600 }}>
                  Accuracy
                </th>
                <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 600 }}>
                  Detection Latency
                </th>
                <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 600 }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {versionKeys.map((v) => {
                const info = versions[v];
                const isActive = v === currentVersion;
                return (
                  <tr
                    key={v}
                    style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      borderLeft: isActive ? `3px solid ${COLORS.navy}` : "3px solid transparent",
                      background: isActive ? "#f8f9ff" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1e293b" }}>
                      {v === "v1" ? "v1 Baseline" : "v2 Hardened"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>
                      {info.incidents_used}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569", fontWeight: 600 }}>
                      {info.accuracy}%
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>
                      {info.latency_ms}ms
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {isActive ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: COLORS.successBg,
                            color: COLORS.successText,
                          }}
                        >
                          Active
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#f1f5f9",
                            color: "#64748b",
                          }}
                        >
                          Standby
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toggle Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {versionKeys.map((v) => {
          const isActive = v === currentVersion;
          return (
            <button
              key={v}
              type="button"
              disabled={switchMutation.isPending}
              onClick={() => handleSwitch(v)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 6,
                border: isActive ? `2px solid ${COLORS.navy}` : `1px solid ${COLORS.border}`,
                background: isActive ? COLORS.navy : COLORS.cardBg,
                color: isActive ? "#ffffff" : "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: isActive || switchMutation.isPending ? "default" : "pointer",
                opacity: switchMutation.isPending && !isActive ? 0.6 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {v === "v1" ? "v1 Baseline" : "v2 Hardened"} {isActive ? "✓" : ""}
            </button>
          );
        })}
      </div>

      {/* Insight Text */}
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "#64748b",
          lineHeight: 1.5,
          background: currentVersion === "v2" ? COLORS.successBg : COLORS.warningBg,
          padding: "8px 12px",
          borderRadius: 6,
        }}
      >
        {VERSION_INSIGHTS[currentVersion] ?? VERSION_INSIGHTS.v1}
      </p>
    </div>
  );
}
