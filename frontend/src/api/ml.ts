import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface ModelVersionInfo {
  accuracy: number;
  latency_ms: number;
  incidents_used: number;
  label: string;
  loaded: boolean;
}

export interface MLStatusResponse {
  current_version: string;
  versions: Record<string, ModelVersionInfo>;
}

export interface MLSwitchResponse {
  current_version: string;
  label: string;
  accuracy: number;
  latency_ms: number;
  message: string;
}

async function fetchMLStatus(): Promise<MLStatusResponse> {
  const response = await apiClient.get<MLStatusResponse>("/api/ml/status");
  return response.data;
}

async function switchModel(version: string): Promise<MLSwitchResponse> {
  const response = await apiClient.post<MLSwitchResponse>("/api/ml/switch", { version });
  return response.data;
}

export function useMLStatusQuery() {
  return useQuery({
    queryKey: ["ml-status"],
    queryFn: fetchMLStatus,
    refetchInterval: 10000,
  });
}

export function useMLSwitchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: string) => switchModel(version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ml-status"] });
    },
  });
}
