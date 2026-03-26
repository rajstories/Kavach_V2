import axios from "axios";
import { logger } from "../config/logger";
import type { AnomalyResult, LogEntry } from "../types";

interface LogFeatures {
  service: string;
  req_per_min: number;
  auth_failure_rate: number;
  unique_endpoints: number;
  bytes_sent_avg: number;
  error_rate: number;
  session_age_sec: number;
  user_agent_entropy: number;
}

interface BatchDetectRequest {
  items: LogFeatures[];
}

interface DetectionResult {
  anomaly_score: number;
  is_anomaly: boolean;
  confidence: number;
  civic_context: string;
}

type LogEntryWithReq = LogEntry & { req_per_min?: number };

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? ms : Date.now();
}

function shannonEntropy(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const char of text) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const total = text.length;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  const maxEntropy = Math.log2(total);
  if (maxEntropy <= 0) {
    return 0;
  }

  return Number(Math.min(entropy / maxEntropy, 1).toFixed(4));
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

export function buildFeaturesFromLog(log: LogEntry): LogFeatures {
  const typed = log as LogEntryWithReq;
  const reqPerMin =
    typeof typed.req_per_min === "number" && Number.isFinite(typed.req_per_min)
      ? typed.req_per_min
      : log.status_code >= 400
        ? 12
        : 4;

  return {
    service: log.service,
    req_per_min: reqPerMin,
    auth_failure_rate: log.status_code === 401 || log.status_code === 403 ? 1 : 0,
    unique_endpoints: 1,
    bytes_sent_avg: Math.max(log.bytes_sent, 0),
    error_rate: log.status_code >= 400 ? 1 : 0,
    session_age_sec: Math.max(Math.round(log.response_time / 1000), 1),
    user_agent_entropy: shannonEntropy(log.user_agent),
  };
}

function buildBatchFeatures(logs: LogEntry[]): LogFeatures[] {
  const totalsByIp = new Map<string, number>();
  const authFailByIp = new Map<string, number>();
  const errorByIp = new Map<string, number>();
  const bytesByIp = new Map<string, number>();
  const minTsByIp = new Map<string, number>();
  const maxTsByIp = new Map<string, number>();
  const endpointsByIp = new Map<string, Set<string>>();
  const rpmByIpMinute = new Map<string, number>();

  for (const log of logs) {
    const ip = log.source_ip;
    const ts = toEpochMs(log.timestamp);
    const minuteBucket = Math.floor(ts / 60_000);
    const rpmKey = `${ip}:${minuteBucket}`;

    totalsByIp.set(ip, (totalsByIp.get(ip) ?? 0) + 1);
    if (log.status_code === 401 || log.status_code === 403) {
      authFailByIp.set(ip, (authFailByIp.get(ip) ?? 0) + 1);
    }
    if (log.status_code >= 400) {
      errorByIp.set(ip, (errorByIp.get(ip) ?? 0) + 1);
    }

    bytesByIp.set(ip, (bytesByIp.get(ip) ?? 0) + Math.max(log.bytes_sent, 0));

    const previousMin = minTsByIp.get(ip);
    const previousMax = maxTsByIp.get(ip);
    minTsByIp.set(ip, previousMin === undefined ? ts : Math.min(previousMin, ts));
    maxTsByIp.set(ip, previousMax === undefined ? ts : Math.max(previousMax, ts));

    const endpointSet = endpointsByIp.get(ip) ?? new Set<string>();
    endpointSet.add(log.endpoint);
    endpointsByIp.set(ip, endpointSet);

    rpmByIpMinute.set(rpmKey, (rpmByIpMinute.get(rpmKey) ?? 0) + 1);
  }

  return logs.map((log) => {
    const base = buildFeaturesFromLog(log);
    const ip = log.source_ip;
    const ts = toEpochMs(log.timestamp);
    const minuteBucket = Math.floor(ts / 60_000);
    const rpmKey = `${ip}:${minuteBucket}`;

    const total = totalsByIp.get(ip) ?? 1;
    const authFailRate = safeRatio(authFailByIp.get(ip) ?? 0, total);
    const errorRate = safeRatio(errorByIp.get(ip) ?? 0, total);
    const bytesAvg = safeRatio(bytesByIp.get(ip) ?? base.bytes_sent_avg, total);

    const minTs = minTsByIp.get(ip) ?? ts;
    const maxTs = maxTsByIp.get(ip) ?? ts;
    const sessionAgeSec = Math.max((maxTs - minTs) / 1000, 1);

    return {
      ...base,
      req_per_min: rpmByIpMinute.get(rpmKey) ?? base.req_per_min,
      auth_failure_rate: Number(Math.min(Math.max(authFailRate, 0), 1).toFixed(4)),
      unique_endpoints: endpointsByIp.get(ip)?.size ?? base.unique_endpoints,
      bytes_sent_avg: Number(Math.max(bytesAvg, 0).toFixed(2)),
      error_rate: Number(Math.min(Math.max(errorRate, 0), 1).toFixed(4)),
      session_age_sec: Number(sessionAgeSec.toFixed(2)),
    };
  });
}

export function handleMLServiceDown(logs: LogEntry[]): AnomalyResult[] {
  logger.warn("ML service unavailable. Activating fail-safe anomaly mode for all logs.", {
    impactedLogs: logs.length,
  });

  return logs.map((log) => ({
    log,
    anomaly_score: 1,
    is_anomalous: true,
    confidence: 1,
    civic_context: "ML service unavailable - fail-safe escalation",
  }));
}

export async function detectAnomalies(logs: LogEntry[]): Promise<AnomalyResult[]> {
  if (logs.length === 0) {
    return [];
  }

  const mlServiceUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
  const items = buildBatchFeatures(logs);

  try {
    const payload: BatchDetectRequest = { items };
    const response = await axios.post<DetectionResult[]>(
      `${mlServiceUrl}/batch-detect`,
      payload,
      { timeout: 10000 },
    );

    if (!Array.isArray(response.data) || response.data.length !== logs.length) {
      logger.warn("Unexpected ML batch response shape. Falling back to fail-safe.", {
        expected: logs.length,
        received: Array.isArray(response.data) ? response.data.length : -1,
      });
      return handleMLServiceDown(logs);
    }

    const mapped: AnomalyResult[] = response.data.map((item, index) => ({
      log: logs[index],
      anomaly_score: item.anomaly_score,
      is_anomalous: item.is_anomaly,
      confidence: item.confidence,
      civic_context: item.civic_context,
    }));

    const flagged = mapped.filter((item) => item.is_anomalous || item.anomaly_score > 0.6);

    logger.info("ML batch detection completed", {
      inputCount: logs.length,
      flaggedCount: flagged.length,
      threshold: 0.6,
      civicContexts: [...new Set(response.data.filter((item) => item.is_anomaly).map((item) => item.civic_context))],
    });

    return mapped;
  } catch (error) {
    logger.warn("ML batch-detect call failed. Falling back to fail-safe pass-through.", {
      error: error instanceof Error ? error.message : "Unknown error",
      endpoint: `${mlServiceUrl}/batch-detect`,
    });
    return handleMLServiceDown(logs);
  }
}
