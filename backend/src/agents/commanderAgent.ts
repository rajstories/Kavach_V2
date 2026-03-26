import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma, PrismaClient } from "@prisma/client";
import axios from "axios";
import winston from "winston";
import { z } from "zod";
import { logger as appLogger } from "../config/logger";
import { currentMode, getCurrentConfig, MODEL_CONFIG } from "../config/modelConfig";
import type { LogEntry } from "../types";

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const prisma = new PrismaClient();
const logger: winston.Logger = appLogger;

export const CIVIC_MULTIPLIERS: Record<string, number> = {
  "election-commission-api": 2.0,
  "voter-auth-api": 2.0,
  "aadhaar-verify-service": 1.8,
  "nhm-health-portal": 1.6,
  "rti-portal": 1.5,
  "municipal-portal": 1.4,
};

const CIVIC_IMPACT_CONTEXT: Record<string, string> = {
  "election-commission-api": "Democratic infrastructure risk during election operations.",
  "voter-auth-api": "Potential voter suppression risk impacting citizen participation.",
  "aadhaar-verify-service": "Identity layer risk affecting large-scale citizen verification.",
  "nhm-health-portal": "Critical health infrastructure risk affecting continuity of care.",
  "rti-portal": "Journalist and activist safety risk via information access targeting.",
  "municipal-portal": "Daily civic services disruption risk for residents.",
};

const SYSTEM_PROMPT = `You are KAVACH Commander Agent (Layer 3), AI threat classifier for Indian government digital infrastructure.
Classify ML-flagged traffic into structured findings for autonomous remediation.
Civic multipliers:
- election-commission-api: 2.0x
- voter-auth-api: 2.0x
- aadhaar-verify-service: 1.8x
- nhm-health-portal: 1.6x
- rti-portal: 1.5x
- municipal-portal: 1.4x
Allowed classification values:
- brute_force
- credential_stuffing
- ddos
- sql_injection
- data_exfiltration
- ransomware_precursor
- api_abuse
- reconnaissance
Allowed severity values:
- CRITICAL
- HIGH
- MEDIUM
- LOW
Civic context rules:
- Must be India-specific and service-specific.
- Must describe likely citizen/government impact.
Return ONLY valid JSON. No prose. No markdown.`;

const commanderFindingSchema = z.object({
  finding_id: z.string().min(1),
  classification: z.enum([
    "brute_force",
    "credential_stuffing",
    "ddos",
    "sql_injection",
    "data_exfiltration",
    "ransomware_precursor",
    "api_abuse",
    "reconnaissance",
  ]),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  confidence: z.number().min(0).max(1),
  service: z.string().min(1),
  civic_multiplier: z.number().positive(),
  offender: z.object({
    type: z.enum(["ip", "session", "ip_cluster"]),
    value: z.string().min(1),
  }),
  civic_context: z.string().min(1),
  recommended_actions: z.array(z.string()),
  immediator_priority: z.enum(["escalate_now", "queue", "monitor"]),
  evidence_summary: z.string().min(1),
});

export type CommanderFinding = z.infer<typeof commanderFindingSchema>;

export interface MLFindings {
  service: string;
  anomaly_score: number;
  time_window_sec: number;
  requests_per_min: number;
  auth_failure_rate: number;
  unique_source_ips: number;
  logs: LogEntry[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const maybeStatus = (error as { status?: unknown }).status;
  return typeof maybeStatus === "number" ? maybeStatus : undefined;
}

function stripMarkdownWrapper(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }
  return trimmed;
}

function extractClaudeText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "{}";
  }

  for (const block of content) {
    if (typeof block !== "object" || block === null) {
      continue;
    }

    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string") {
      return candidate.text;
    }
  }

  return "{}";
}

function extractOpenAIText(data: unknown): string {
  const resp = data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return resp?.choices?.[0]?.message?.content ?? "{}";
}

function buildFindingId(service: string): string {
  const timestamp = Date.now();
  const prefix = (service.slice(0, 4) || "svc").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `exec-${timestamp}-${prefix}`;
}

function buildLogSample(logs: LogEntry[], take: number): string {
  return logs
    .slice(-take)
    .map((log) => `${log.method} ${log.endpoint} ${log.status_code} ip=${log.source_ip}`)
    .join("\n");
}

function buildMlFindings(service: string, logs: LogEntry[]): MLFindings {
  const sorted = [...logs].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const windowSec = Math.max(1, Math.round((Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000));
  const durationMin = Math.max(windowSec / 60, 1 / 60);
  const authFailures = logs.filter((log) => log.status_code === 401 || log.status_code === 403).length;
  const uniqueIps = new Set(logs.map((log) => log.source_ip)).size;
  const requestsPerMin = logs.length / durationMin;
  const authFailureRate = authFailures / Math.max(logs.length, 1);
  const anomalyScore = Number(Math.min(1, Math.max(0, 0.5 * authFailureRate + Math.min(1, requestsPerMin / 200))).toFixed(4));

  return {
    service,
    anomaly_score: anomalyScore,
    time_window_sec: windowSec,
    requests_per_min: Number(requestsPerMin.toFixed(2)),
    auth_failure_rate: Number(authFailureRate.toFixed(4)),
    unique_source_ips: uniqueIps,
    logs,
  };
}

function buildUserPrompt(mlFindings: MLFindings): string {
  const multiplier = CIVIC_MULTIPLIERS[mlFindings.service] ?? 1.0;
  const sampleCount = Math.min(12, mlFindings.logs.length);
  const authFailurePct = (mlFindings.auth_failure_rate * 100).toFixed(2);
  const sample = buildLogSample(mlFindings.logs, sampleCount);

  return `Service: ${mlFindings.service}
Civic multiplier: ${multiplier}×
ML anomaly score: ${mlFindings.anomaly_score}
Time window: ${mlFindings.time_window_sec}s
Requests/min: ${mlFindings.requests_per_min}
Auth failure rate: ${authFailurePct}%
Unique source IPs: ${mlFindings.unique_source_ips}
Log sample (last ${sampleCount} entries):
${sample}
Classify this threat. Return JSON with exactly these fields: finding_id, classification, severity, confidence, service, civic_multiplier, offender, civic_context, recommended_actions, immediator_priority, evidence_summary`;
}

function applyPostProcessing(finding: CommanderFinding): CommanderFinding {
  if (finding.civic_multiplier >= 1.8 && finding.severity === "HIGH") {
    return {
      ...finding,
      severity: "CRITICAL",
      immediator_priority: "escalate_now",
    };
  }
  return finding;
}

async function storeLogBatch(
  source: string,
  executionId: string,
  logBatch: LogEntry[],
  findingsCount: number,
): Promise<void> {
  try {
    await prisma.logBatch.create({
      data: {
        source,
        executionId,
        rawLogsJson: logBatch as unknown as Prisma.InputJsonValue,
        findingsCount,
      },
    });
  } catch (error) {
    logger.error("Commander failed to store log batch", {
      executionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Call Anthropic Claude using the native SDK.
 */
async function callAnthropicClaude(userPrompt: string): Promise<string> {
  const config = MODEL_CONFIG.high_accuracy;
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`${config.apiKeyEnv} not set for high_accuracy mode`);
  }

  const response = await anthropicClient.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractClaudeText(response.content);
}

/**
 * Call AgentRouter (OpenAI-compatible) via axios.
 */
async function callAgentRouter(userPrompt: string): Promise<string> {
  const config = MODEL_CONFIG.cost_optimised;
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`${config.apiKeyEnv} not set for cost_optimised mode`);
  }

  const response = await axios.post(
    `${config.baseURL}/chat/completions`,
    {
      model: config.model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  return extractOpenAIText(response.data);
}

/**
 * Unified model call that switches based on currentMode.
 */
async function callModel(userPrompt: string): Promise<string> {
  const mode = currentMode;
  const config = MODEL_CONFIG[mode];

  logger.info("Commander calling model", {
    mode,
    model: config.model,
    label: config.label,
  });

  if (mode === "high_accuracy") {
    return callAnthropicClaude(userPrompt);
  }
  return callAgentRouter(userPrompt);
}

export async function runCommanderAgent(mlFindings: MLFindings): Promise<CommanderFinding | null> {
  const retryBackoffMs = [2000, 4000, 8000];

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const userPrompt = buildUserPrompt(mlFindings);
      const rawText = await callModel(userPrompt);
      const cleanJson = stripMarkdownWrapper(rawText);
      const parsed = JSON.parse(cleanJson) as unknown;
      const validated = commanderFindingSchema.parse(parsed);

      const normalized: CommanderFinding = {
        ...validated,
        finding_id: buildFindingId(mlFindings.service),
        service: mlFindings.service,
        civic_multiplier: CIVIC_MULTIPLIERS[mlFindings.service] ?? 1.0,
        civic_context:
          validated.civic_context ||
          CIVIC_IMPACT_CONTEXT[mlFindings.service] ||
          "India government digital service impact under active assessment.",
      };

      return applyPostProcessing(normalized);
    } catch (error) {
      const statusCode = getStatusCode(error);
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Commander API call failed", {
        service: mlFindings.service,
        attempt,
        statusCode,
        error: message,
        mode: currentMode,
      });

      const parseLikeError =
        error instanceof SyntaxError ||
        (error instanceof Error &&
          (error.message.toLowerCase().includes("json") ||
            error.message.toLowerCase().includes("unexpected token")));
      if (parseLikeError) {
        logger.warn("Commander parse error; returning empty result for service", {
          service: mlFindings.service,
          error: message,
        });
        return null;
      }

      if (attempt >= 3) {
        break;
      }

      if (statusCode === 429) {
        await sleep(30_000);
      } else {
        await sleep(retryBackoffMs[attempt - 1]);
      }
    }
  }

  return null;
}

export async function analyzeLogs(logs: LogEntry[]): Promise<CommanderFinding[]> {
  if (logs.length === 0) {
    return [];
  }

  const executionId = `exec-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const grouped = new Map<string, LogEntry[]>();

  for (const log of logs) {
    const service = log.service ?? log.source ?? "unknown-service";
    const current = grouped.get(service) ?? [];
    current.push(log);
    grouped.set(service, current);
  }

  const findings: CommanderFinding[] = [];
  for (const [service, serviceLogs] of grouped.entries()) {
    const mlFindings = buildMlFindings(service, serviceLogs);
    const finding = await runCommanderAgent(mlFindings);
    if (finding) {
      findings.push(finding);
    }
  }

  const source = logs[0]?.service ?? logs[0]?.source ?? "unknown-source";
  await storeLogBatch(source, executionId, logs, findings.length);

  return findings;
}

export function getCurrentModelMode() {
  return currentMode;
}

export function getModelInfo() {
  return getCurrentConfig();
}