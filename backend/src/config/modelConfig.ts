export type ModelMode = "cost_optimised" | "high_accuracy";

export const MODEL_CONFIG: Record<
  ModelMode,
  {
    model: string;
    baseURL: string;
    apiKeyEnv: string;
    label: string;
    costPer1kTokens: number;
  }
> = {
  cost_optimised: {
    model: "deepseek-v3",
    baseURL: "https://api.agentrouter.org/v1",
    apiKeyEnv: "AGENTROUTER_API_KEY",
    label: "DeepSeek V3 via AgentRouter",
    costPer1kTokens: 0.001,
  },
  high_accuracy: {
    model: "claude-sonnet-4-6",
    baseURL: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    label: "Claude Sonnet 4.6",
    costPer1kTokens: 0.015,
  },
};

export let currentMode: ModelMode =
  (process.env.MODEL_MODE as ModelMode) ?? "cost_optimised";

export function setModelMode(mode: ModelMode): void {
  currentMode = mode;
}

export function getCurrentConfig() {
  return MODEL_CONFIG[currentMode];
}