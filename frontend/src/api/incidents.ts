import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { IncidentDetail, IncidentListResponse, IncidentStats, TimelinePoint } from "../types";

export interface IncidentQueryParams {
  page?: number;
  limit?: number;
  severity?: string;
  domain?: string;
  status?: string;
}

async function fetchIncidents(params: IncidentQueryParams): Promise<IncidentListResponse> {
  const response = await apiClient.get<IncidentListResponse>("/api/incidents", { params });
  return response.data;
}

async function fetchIncident(id: string): Promise<IncidentDetail> {
  const response = await apiClient.get<IncidentDetail>(`/api/incidents/${id}`);
  return response.data;
}

async function fetchStats(): Promise<IncidentStats> {
  const response = await apiClient.get<IncidentStats>("/api/incidents/stats");
  return response.data;
}

async function fetchTimeline(): Promise<TimelinePoint[]> {
  const response = await apiClient.get<TimelinePoint[]>("/api/incidents/timeline");
  return response.data;
}

async function updateIncidentStatus(id: string, status: string): Promise<IncidentDetail> {
  const response = await apiClient.patch<IncidentDetail>(`/api/incidents/${id}`, { status });
  return response.data;
}

export function useIncidentsQuery(params: IncidentQueryParams) {
  return useQuery({
    queryKey: ["incidents", params],
    queryFn: () => fetchIncidents(params),
    refetchInterval: 30000,
  });
}

export function useIncidentQuery(id: string) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: () => fetchIncident(id),
    enabled: Boolean(id),
  });
}

export function useIncidentStatsQuery() {
  return useQuery({
    queryKey: ["incident-stats"],
    queryFn: fetchStats,
    refetchInterval: 30000,
  });
}

export function useIncidentTimelineQuery() {
  return useQuery({
    queryKey: ["incident-timeline"],
    queryFn: fetchTimeline,
    refetchInterval: 30000,
  });
}

export function useUpdateIncidentStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateIncidentStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["incident", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["incident-stats"] });
    },
  });
}
