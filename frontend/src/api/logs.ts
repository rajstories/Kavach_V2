import { useMutation } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { SimulationResponse } from "../types";

export interface RawLogInput {
  timestamp: string;
  source_ip: string;
  endpoint: string;
  status_code: number;
  method: string;
  user_agent: string;
  response_time: number;
  bytes_sent: number;
  source?: string;
  service?: string;
}

async function ingestLogs(logs: RawLogInput[]) {
  const response = await apiClient.post("/api/logs/ingest", { logs });
  return response.data;
}

async function simulateAttack(scenario: string) {
  const response = await apiClient.post<SimulationResponse>("/api/logs/simulate", { scenario });
  return response.data;
}

export function useIngestLogsMutation() {
  return useMutation({
    mutationFn: ingestLogs,
  });
}

export function useSimulationMutation() {
  return useMutation({
    mutationFn: simulateAttack,
  });
}
