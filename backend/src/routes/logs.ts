import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { analyzeLogs } from "../agents/commanderAgent";
import type { CommanderFinding } from "../agents/commanderAgent";
import { dispatch } from "../agents/dispatcher";
import { processFindings } from "../agents/immediatorAgent";
import { logger } from "../config/logger";
import { costImpact, filterBatch, filterStats } from "../filters/ruleFilter";
import { AppError } from "../middleware/errorHandler";
import { swarmCheck } from "../middleware/swarmCheck";
import { detectAnomalies } from "../ml/anomalyDetector";
import type { Finding, LogEntry, RawLog } from "../types";

const router = Router();
const prisma = new PrismaClient();

type ScenarioType =
  | "brute_force"
  | "ddos"
  | "sql_injection"
  | "data_exfiltration"
  | "credential_stuffing";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomIpFromPrefix(prefix: string): string {
  return `${prefix}.${randomInt(1, 254)}.${randomInt(1, 254)}`;
}

function baseLog(overrides: Partial<RawLog>): RawLog {
  return {
    timestamp: new Date().toISOString(),
    source_ip: "10.0.0.10",
    endpoint: "/health",
    method: "GET",
    status_code: 200,
    user_agent: "KAVACH-Simulator/1.0",
    response_time: randomInt(30, 180),
    bytes_sent: randomInt(500, 4000),
    user_id: "citizen-user",
    service: "voter-auth-api",
    source: "voter-auth-api",
    ...overrides,
  };
}

function generateBruteForceScenario(): RawLog[] {
  const usernames = ["admin", "root", "dbadmin", "superuser", "test"];
  const start = Date.now() - 5 * 60 * 1000;
  const intervalMs = Math.floor((5 * 60 * 1000) / 45);

  return Array.from({ length: 45 }, (_, index) =>
    baseLog({
      timestamp: new Date(start + intervalMs * index).toISOString(),
      source_ip: "203.0.113.50",
      endpoint: "/auth/login",
      method: "POST",
      status_code: 401,
      user_agent: "Mozilla/5.0 (BruteForceRunner)",
      response_time: randomInt(70, 210),
      bytes_sent: randomInt(800, 1800),
      user_id: usernames[index % usernames.length],
      service: "voter-auth-api",
      source: "voter-auth-api",
    }),
  );
}

function generateDDoSScenario(): RawLog[] {
  const ipPrefixes = ["185", "91", "45"];
  const distinctIps = Array.from({ length: 15 }, (_, i) => {
    const prefix = ipPrefixes[i % ipPrefixes.length];
    return `${prefix}.${randomInt(1, 254)}.${randomInt(1, 254)}.${randomInt(1, 254)}`;
  });
  const start = Date.now() - 60 * 1000;

  return Array.from({ length: 200 }, (_, index) =>
    baseLog({
      timestamp: new Date(start + randomInt(0, 60_000)).toISOString(),
      source_ip: distinctIps[index % distinctIps.length],
      endpoint: "/api/citizen/data",
      method: "GET",
      status_code: 429,
      user_agent: "FloodBot/3.4",
      response_time: randomInt(400, 1800),
      bytes_sent: randomInt(600, 2500),
      user_id: `guest-${index % 20}`,
      service: "municipal-portal",
      source: "municipal-portal",
    }),
  );
}

function generateSQLInjectionScenario(): RawLog[] {
  const payloadEndpoints = [
    "/search?id=1' OR '1'='1",
    "/records?search='; DROP TABLE users;--",
    "/users?user=admin'--",
  ];
  const start = Date.now() - 10 * 60 * 1000;

  return Array.from({ length: 12 }, (_, index) =>
    baseLog({
      timestamp: new Date(start + index * 35_000).toISOString(),
      source_ip: randomIpFromPrefix("198.51"),
      endpoint: payloadEndpoints[index % payloadEndpoints.length],
      method: "GET",
      status_code: index % 3 === 0 ? 200 : 400,
      user_agent: "SQLProbe/1.2",
      response_time: randomInt(120, 420),
      bytes_sent: randomInt(1000, 7000),
      user_id: `rti-user-${index}`,
      service: "rti-portal",
      source: "rti-portal",
    }),
  );
}

function generateDataExfiltrationScenario(): RawLog[] {
  const endpoints = ["/api/voter/export", "/api/records/download"];
  const sourceIp = "172.16.88.23";
  const start = Date.now() - 6 * 60 * 1000;

  return Array.from({ length: 8 }, (_, index) =>
    baseLog({
      timestamp: new Date(start + index * 42_000).toISOString(),
      source_ip: sourceIp,
      endpoint: endpoints[index % endpoints.length],
      method: "GET",
      status_code: 200,
      user_agent: "BulkDownloader/2.0",
      response_time: randomInt(300, 950),
      bytes_sent: randomInt(500_000, 2_000_000),
      user_id: "ec-export-operator",
      service: "election-commission-api",
      source: "election-commission-api",
    }),
  );
}

function generateCredentialStuffingScenario(): RawLog[] {
  const usernames = [
    "aadhaar_admin",
    "data-entry1",
    "uidai_ops",
    "service_account",
    "enrolment_supervisor",
    "citizen_helpdesk",
  ];
  const start = Date.now() - 8 * 60 * 1000;

  return Array.from({ length: 35 }, (_, index) =>
    baseLog({
      timestamp: new Date(start + index * 11_000).toISOString(),
      source_ip: `203.0.${index + 10}.${randomInt(1, 254)}`,
      endpoint: "/aadhaar/auth/login",
      method: "POST",
      status_code: 401,
      user_agent: "CredentialSpray/5.1",
      response_time: randomInt(90, 240),
      bytes_sent: randomInt(900, 2000),
      user_id: usernames[index % usernames.length],
      service: "aadhaar-verify-service",
      source: "aadhaar-verify-service",
    }),
  );
}

function buildScenarioLogs(scenario: ScenarioType): RawLog[] {
  switch (scenario) {
    case "brute_force":
      return generateBruteForceScenario();
    case "ddos":
      return generateDDoSScenario();
    case "sql_injection":
      return generateSQLInjectionScenario();
    case "data_exfiltration":
      return generateDataExfiltrationScenario();
    case "credential_stuffing":
      return generateCredentialStuffingScenario();
    default:
      return generateBruteForceScenario();
  }
}

function sanitizeLog(input: unknown, defaultSource: string): RawLog | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const raw = input as Partial<RawLog>;
  if (!raw.timestamp || !raw.source_ip || !raw.endpoint || !raw.method || typeof raw.status_code !== "number") {
    return null;
  }

  return {
    timestamp: raw.timestamp,
    source_ip: raw.source_ip,
    endpoint: raw.endpoint,
    method: raw.method,
    status_code: raw.status_code,
    user_agent: raw.user_agent ?? "UnknownAgent/0.0",
    response_time: typeof raw.response_time === "number" ? raw.response_time : 0,
    bytes_sent: typeof raw.bytes_sent === "number" ? raw.bytes_sent : 0,
    user_id: raw.user_id,
    service: raw.service ?? raw.source ?? defaultSource,
    source: raw.source ?? raw.service ?? defaultSource,
  };
}

function toLogEntry(log: RawLog, fallbackSource: string): LogEntry {
  return {
    ...log,
    source: log.source ?? fallbackSource,
    service: log.service ?? log.source ?? fallbackSource,
  };
}

function mapCommanderFindingToFinding(finding: CommanderFinding, eventCount: number): Finding {
  const severityMap = {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
  } as const;

  const offenderTypeMap = {
    ip: "ip",
    session: "user",
    ip_cluster: "service",
  } as const;

  const classificationDomainMap: Record<string, "identity" | "network" | "infrastructure"> = {
    brute_force: "identity",
    credential_stuffing: "identity",
    ddos: "network",
    sql_injection: "network",
    api_abuse: "network",
    reconnaissance: "network",
    data_exfiltration: "infrastructure",
    ransomware_precursor: "infrastructure",
  };

  return {
    finding_id: finding.finding_id,
    domain: classificationDomainMap[finding.classification] ?? "infrastructure",
    classification: finding.classification,
    severity: severityMap[finding.severity],
    confidence: finding.confidence,
    offender: {
      type: offenderTypeMap[finding.offender.type],
      value: finding.offender.value,
    },
    affected_service: finding.service,
    metrics: {
      event_count: eventCount,
      duration_sec: 0,
      unique_targets: 1,
    },
    evidence: [finding.evidence_summary],
    recommended_actions: finding.recommended_actions,
    civic_context: finding.civic_context,
  };
}

async function runFullPipeline(params: {
  logs: RawLog[];
  source: string;
  scenario?: ScenarioType;
}): Promise<{
  executionId: string;
  logsReceived: number;
  logsDiscarded: number;
  logsEscalatedCritical: number;
  logsPassedToMl: number;
  mlScreening: {
    totalScreened: number;
    anomaliesDetected: number;
    anomalyRate: number;
    civicContexts: Array<{ civicContext: string; count: number }>;
  };
  logsAnalyzed: number;
  findingsCount: number;
  incidentsCreated: number;
  processingTimeMs: number;
  filterStats: ReturnType<typeof filterStats>;
  costImpact: ReturnType<typeof costImpact>;
  syntheticLogsGenerated?: number;
  scenarioUsed?: ScenarioType;
}> {
  const startedAt = Date.now();
  const executionId = `exec-${Date.now()}-${randomUUID().slice(0, 8)}`;

  try {
    const logEntries = params.logs.map((log) => toLogEntry(log, params.source));

    logger.info("/api/logs pipeline started", {
      executionId,
      logsReceived: logEntries.length,
      source: params.source,
      scenario: params.scenario,
    });
    const { discarded, passToML, critical } = filterBatch(logEntries);
    const anomalyResults = passToML.length > 0 ? await detectAnomalies(passToML) : [];
    const flaggedLogs = anomalyResults.filter(
      (item) => item.is_anomalous || item.anomaly_score > 0.6,
    );
    const civicContextCounts = new Map<string, number>();
    for (const item of flaggedLogs) {
      const civicContext = item.civic_context ?? "General civic cyber risk";
      civicContextCounts.set(civicContext, (civicContextCounts.get(civicContext) ?? 0) + 1);
    }
    const mlScreening = {
      totalScreened: passToML.length,
      anomaliesDetected: flaggedLogs.length,
      anomalyRate: passToML.length === 0 ? 0 : Number((flaggedLogs.length / passToML.length).toFixed(4)),
      civicContexts: Array.from(civicContextCounts.entries()).map(([civicContext, count]) => ({
        civicContext,
        count,
      })),
    };
    const mlLogsForCommander = flaggedLogs.length > 0 ? flaggedLogs.map((item) => item.log) : passToML;
    const logsForAnalysis = [...critical, ...mlLogsForCommander].map((log) => toLogEntry(log, params.source));

    const commanderFindings = logsForAnalysis.length > 0 ? await analyzeLogs(logsForAnalysis) : [];
    const findings = commanderFindings.map((finding) =>
      mapCommanderFindingToFinding(
        finding,
        logsForAnalysis.filter((log) => log.service === finding.service).length,
      ),
    );
    const prioritizedIncidents = await processFindings(findings);
    await Promise.allSettled(prioritizedIncidents.map((incident) => dispatch(incident)));
    const currentFilterStats = filterStats();
    const currentCostImpact = costImpact(logEntries.length);

    const processingTimeMs = Date.now() - startedAt;

    logger.info("/api/logs pipeline completed", {
      executionId,
      logsReceived: logEntries.length,
      logsDiscarded: discarded.length,
      logsEscalatedCritical: critical.length,
      logsPassedToMl: passToML.length,
      logsAnalyzed: logsForAnalysis.length,
      findingsCount: findings.length,
      incidentsCreated: prioritizedIncidents.length,
      processingTimeMs,
      filterStats: currentFilterStats,
      costImpact: currentCostImpact,
      mlScreening,
    });

    return {
      executionId,
      logsReceived: logEntries.length,
      logsDiscarded: discarded.length,
      logsEscalatedCritical: critical.length,
      logsPassedToMl: passToML.length,
      mlScreening,
      logsAnalyzed: logsForAnalysis.length,
      findingsCount: findings.length,
      incidentsCreated: prioritizedIncidents.length,
      processingTimeMs,
      filterStats: currentFilterStats,
      costImpact: currentCostImpact,
      scenarioUsed: params.scenario,
      syntheticLogsGenerated: params.scenario ? params.logs.length : undefined,
    };
  } catch (error) {
    logger.error("/api/logs pipeline failed", {
      executionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

router.post("/ingest", swarmCheck, async (req, res, next) => {
  try {
    const payload = req.body as { logs?: unknown[]; source?: string };
    const source = payload.source ?? "unknown-source";

    if (!Array.isArray(payload.logs) || payload.logs.length === 0) {
      throw new AppError("Request body must include non-empty logs array", 400);
    }

    const validLogs = payload.logs
      .map((log) => sanitizeLog(log, source))
      .filter((log): log is RawLog => log !== null);

    if (validLogs.length === 0) {
      throw new AppError("No valid logs found in payload", 400);
    }

    const result = await runFullPipeline({ logs: validLogs, source });

    res.status(200).json({
      executionId: result.executionId,
      logsReceived: result.logsReceived,
      logsDiscarded: result.logsDiscarded,
      logsEscalatedCritical: result.logsEscalatedCritical,
      logsPassedToMl: result.logsPassedToMl,
      logsAnalyzed: result.logsAnalyzed,
      findingsCount: result.findingsCount,
      incidentsCreated: result.incidentsCreated,
      processingTimeMs: result.processingTimeMs,
      filterStats: result.filterStats,
      costImpact: result.costImpact,
      mlScreening: result.mlScreening,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/simulate", async (req, res, next) => {
  try {
    const payload = req.body as { scenario?: string };
    const scenario = (payload.scenario ?? "brute_force") as ScenarioType;
    const allowed: ScenarioType[] = [
      "brute_force",
      "ddos",
      "sql_injection",
      "data_exfiltration",
      "credential_stuffing",
    ];

    if (!allowed.includes(scenario)) {
      throw new AppError(
        "Invalid scenario. Use brute_force|ddos|sql_injection|data_exfiltration|credential_stuffing",
        400,
      );
    }

    const syntheticLogs = buildScenarioLogs(scenario);
    if (syntheticLogs.length === 0) {
      throw new AppError("Synthetic generator returned no logs", 500);
    }

    const source = syntheticLogs[0].service ?? syntheticLogs[0].source ?? "simulator";

    logger.info("Running synthetic simulation", {
      scenario,
      syntheticLogsGenerated: syntheticLogs.length,
      source,
    });

    const result = await runFullPipeline({
      logs: syntheticLogs,
      source,
      scenario,
    });

    res.status(200).json({
      executionId: result.executionId,
      logsReceived: result.logsReceived,
      logsDiscarded: result.logsDiscarded,
      logsEscalatedCritical: result.logsEscalatedCritical,
      logsPassedToMl: result.logsPassedToMl,
      logsAnalyzed: result.logsAnalyzed,
      findingsCount: result.findingsCount,
      incidentsCreated: result.incidentsCreated,
      processingTimeMs: result.processingTimeMs,
      filterStats: result.filterStats,
      costImpact: result.costImpact,
      mlScreening: result.mlScreening,
      scenarioUsed: result.scenarioUsed,
      syntheticLogsGenerated: result.syntheticLogsGenerated,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/batches", async (req, res, next) => {
  try {
    const page = Number.parseInt(String(req.query.page ?? "1"), 10);
    const limit = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    const [total, batches] = await Promise.all([
      prisma.logBatch.count(),
      prisma.logBatch.findMany({
        orderBy: { analyzedAt: "desc" },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        select: {
          id: true,
          source: true,
          findingsCount: true,
          executionId: true,
          analyzedAt: true,
        },
      }),
    ]);

    res.status(200).json({
      data: batches,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
