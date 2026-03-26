import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { CopilotResponse, DailyBriefing } from "../types";

async function sendCopilotMessage(payload: {
  message: string;
  language: "hindi" | "english";
  sessionId: string;
}): Promise<CopilotResponse> {
  const response = await apiClient.post<CopilotResponse>("/api/copilot/message", payload);
  return response.data;
}

async function fetchBriefing(): Promise<DailyBriefing> {
  const response = await apiClient.get<DailyBriefing>("/api/copilot/briefing");
  return response.data;
}

export function useCopilotMessageMutation() {
  return useMutation({
    mutationFn: sendCopilotMessage,
  });
}

export function useDailyBriefingQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["daily-briefing"],
    queryFn: fetchBriefing,
    enabled,
  });
}
