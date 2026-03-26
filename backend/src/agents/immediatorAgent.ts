import { randomUUID } from "node:crypto";
import { Domain, IncidentStatus, Prisma, PrismaClient, Severity } from "@prisma/client";
import winston from "winston";
import { logger as appLogger } from "../config/logger";
import type { Finding as CommanderFinding, PrioritizedIncident } from "../types";

const prisma = new PrismaClient();
const logger: winston.Logger = appLogger;

const BASE_CIVIC_MULTIPLIERS: Record<string, number> = {
  "election-commission-api": 2.0,
  "voter-auth-api": 2.0,
  "aadhaar-verify-service": 1.8,
  "aadhaar-verify": 1.8,
  "nhm-health-portal": 1.6,
  "rti-portal": 1.5,
  "municipal-portal": 1.4,
  default: 1.0,
};

export type CivicCalendarEvent = {
  name: string;
  portals: string[];
  boost: Record<string, number>;
  active: (now?: Date) => boolean;
};

export type CivicMultiplierResult = {
  multiplier: number;
  calendar_event: string | null;
  is_elevated: boolean;
};

export type ImmediatorResult = PrioritizedIncident & {
  calendarEvent: string | null;
  isCalendarElevated: boolean;
  priorityScore: number;
  dispatch_immediately: boolean;
  escalated: boolean;
  escalation_reason?: string;
};

function currentMonth(now: Date): number {
  return now.getMonth() + 1;
}

function isElectionSeason(now: Date = new Date()): boolean {
  const electionMonths = [3, 4, 10, 11];
  return electionMonths.includes(currentMonth(now));
}

function isUnionBudgetDay(now: Date = new Date()): boolean {
  return currentMonth(now) === 2 && now.getDate() === 1;
}

function isAadhaarKycDrive(now: Date = new Date()): boolean {
  const month = currentMonth(now);
  return month === 6 || month === 7;
}

export const CIVIC_CALENDAR: CivicCalendarEvent[] = [
  {
    name: "Election Season",
    portals: ["voter-auth-api", "election-commission-api"],
    boost: {
      "voter-auth-api": 0.5,
      "election-commission-api": 0.8,
    },
    active: (now = new Date()) => isElectionSeason(now),
  },
  {
    name: "Union Budget",
    portals: ["municipal-portal"],
    boost: {
      "municipal-portal": 0.8,
    },
    active: (now = new Date()) => isUnionBudgetDay(now),
  },
  {
    name: "Aadhaar KYC Drive",
    portals: ["aadhaar-verify-service", "aadhaar-verify"],
    boost: {
      "aadhaar-verify-service": 1.0,
      "aadhaar-verify": 1.0,
    },
    active: (now = new Date()) => isAadhaarKycDrive(now),
  },
];

function getFindingTimestamp(finding: CommanderFinding, fallbackMs: number): number {
  for (const line of finding.evidence) {
    const match = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
    if (!match) {
      continue;
    }

    const parsed = Date.parse(match[0]);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return fallbackMs;
}

function normalizeService(service: string): string {
  return service.trim().toLowerCase();
}

function getBaseMultiplier(service: string): number {
  const normalized = normalizeService(service);

  if (BASE_CIVIC_MULTIPLIERS[normalized] !== undefined) {
    return BASE_CIVIC_MULTIPLIERS[normalized];
  }
  if (normalized.includes("election") || normalized.includes("voter")) {
    return 2.0;
  }
  if (normalized.includes("aadhaar")) {
    return 1.8;
  }
  if (normalized.includes("nhm") || normalized.includes("health")) {
    return 1.6;
  }
  if (normalized.includes("rti")) {
    return 1.5;
  }
  if (normalized.includes("municipal")) {
    return 1.4;
  }

  return 1.0;
}

export function getCivicMultiplier(service: string, now: Date = new Date()): CivicMultiplierResult {
  const normalized = normalizeService(service);
  const base = getBaseMultiplier(normalized);

  for (const event of CIVIC_CALENDAR) {
    if (!event.active(now)) {
      continue;
    }

    if (!event.portals.includes(normalized)) {
      continue;
    }

    const boost = event.boost[normalized] ?? 0;
    if (boost > 0) {
      return {
        multiplier: Number((base + boost).toFixed(2)),
        calendar_event: event.name,
        is_elevated: true,
      };
    }
  }

  return {
    multiplier: base,
    calendar_event: null,
    is_elevated: false,
  };
}

function toDomain(domain: string): Domain {
  const normalized = domain.toUpperCase();
  if (normalized === "IDENTITY") {
    return Domain.IDENTITY;
  }
  if (normalized === "NETWORK") {
    return Domain.NETWORK;
  }
  return Domain.INFRASTRUCTURE;
}

function toSeverity(severity: string): Severity {
  const normalized = severity.toUpperCase();
  if (normalized === "CRITICAL") {
    return Severity.CRITICAL;
  }
  if (normalized === "HIGH") {
    return Severity.HIGH;
  }
  if (normalized === "MEDIUM") {
    return Severity.MEDIUM;
  }
  return Severity.LOW;
}

function deduplicateFindings(findings: CommanderFinding[]): CommanderFinding[] {
  const sorted = [...findings]
    .map((finding, index) => ({
      finding,
      timestamp: getFindingTimestamp(finding, Date.now() + index * 1000),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const grouped = new Map<string, Array<{ finding: CommanderFinding; timestamp: number }>>();
  const fiveMinutesMs = 5 * 60 * 1000;

  for (const item of sorted) {
    const key = `${item.finding.offender.value}:${item.finding.classification}`;
    const existing = grouped.get(key) ?? [];
    const last = existing[existing.length - 1];

    if (!last) {
      existing.push(item);
      grouped.set(key, existing);
      continue;
    }

    if (item.timestamp - last.timestamp <= fiveMinutesMs) {
      if (item.finding.confidence > last.finding.confidence) {
        existing[existing.length - 1] = item;
      }
      grouped.set(key, existing);
      continue;
    }

    existing.push(item);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .flat()
    .map((item) => item.finding);
}

function classifySeverityFromPriority(priorityScore: number): "critical" | "high" | "medium" | "low" {
  if (priorityScore >= 1.6) {
    return "critical";
  }
  if (priorityScore >= 1.1) {
    return "high";
  }
  if (priorityScore >= 0.7) {
    return "medium";
  }
  return "low";
}

function shouldEscalateAadhaarOrTierOne(service: string, severity: string, civicMultiplier: number): boolean {
  const normalized = normalizeService(service);
  return (civicMultiplier >= 2.0 || normalized.includes("aadhaar")) && severity === "high";
}

export async function processFindings(findings: CommanderFinding[]): Promise<ImmediatorResult[]> {
  const executionId = `exec-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const deduped = deduplicateFindings(findings);
  const results: ImmediatorResult[] = [];

  for (const finding of deduped) {
    const civic = getCivicMultiplier(finding.affected_service);
    const priorityScore = Number((finding.confidence * civic.multiplier).toFixed(2));

    let severity = classifySeverityFromPriority(priorityScore);
    let escalated = false;
    let escalationReason: string | undefined;

    if (shouldEscalateAadhaarOrTierOne(finding.affected_service, severity, civic.multiplier)) {
      severity = "critical";
      escalated = true;
      escalationReason = normalizeService(finding.affected_service).includes("aadhaar")
        ? "Aadhaar service escalation rule"
        : "Tier-one civic multiplier escalation";
    }

    const dispatchImmediately = severity === "critical" || civic.is_elevated;
    const detectedAt = new Date();

    const rawFindingJson: Prisma.InputJsonValue = {
      ...finding,
      civic_multiplier: civic.multiplier,
      calendar_event: civic.calendar_event,
      is_calendar_elevated: civic.is_elevated,
      priority_score: priorityScore,
      derived_severity: severity,
      dispatch_immediately: dispatchImmediately,
      escalated,
      escalation_reason: escalationReason,
    } as Prisma.InputJsonValue;

    const created = await prisma.incident.create({
      data: {
        executionId,
        findingId: finding.finding_id,
        domain: toDomain(finding.domain),
        severity: toSeverity(severity),
        status: IncidentStatus.OPEN,
        classification: finding.classification,
        confidence: finding.confidence,
        offenderType: finding.offender.type,
        offenderValue: finding.offender.value,
        affectedService: finding.affected_service,
        evidenceJson: finding.evidence as unknown as Prisma.InputJsonValue,
        recommendedActionsJson: finding.recommended_actions as unknown as Prisma.InputJsonValue,
        rawFindingJson,
        detectedAt,
        civicMultiplier: civic.multiplier,
        calendarEvent: civic.calendar_event,
        isCalendarElevated: civic.is_elevated,
        priorityScore,
        intelEnriched: false,
        threatLevel: null,
      },
    });

    results.push({
      incidentId: created.id,
      executionId,
      findingId: finding.finding_id,
      domain: finding.domain,
      classification: finding.classification,
      severity,
      confidence: finding.confidence,
      offender: finding.offender,
      affectedService: finding.affected_service,
      evidence: finding.evidence,
      recommendedActions: finding.recommended_actions,
      civicContext: finding.civic_context,
      civicImpactMultiplier: civic.multiplier,
      finalScore: priorityScore,
      calendarEvent: civic.calendar_event,
      isCalendarElevated: civic.is_elevated,
      priorityScore,
      dispatch_immediately: dispatchImmediately,
      detectedAt: detectedAt.toISOString(),
      escalated,
      escalation_reason: escalationReason,
    });
  }

  results.sort((a, b) => b.priorityScore - a.priorityScore);

  logger.info("Immediator processed findings", {
    inputCount: findings.length,
    deduplicatedCount: deduped.length,
    createdIncidents: results.length,
    elevatedCount: results.filter((item) => item.isCalendarElevated).length,
    criticalCount: results.filter((item) => item.severity === "critical").length,
  });

  return results;
}

export function simulateScoringComparison(
  confidence = 0.72,
  now: Date = new Date("2026-03-28T10:00:00+05:30"),
) {
  const services = ["voter-auth-api", "municipal-portal", "generic-web-app"];

  return services.map((service) => {
    const civic = getCivicMultiplier(service, now);
    const priorityScore = Number((confidence * civic.multiplier).toFixed(2));
    let severity = classifySeverityFromPriority(priorityScore);

    if (shouldEscalateAadhaarOrTierOne(service, severity, civic.multiplier)) {
      severity = "critical";
    }

    return {
      service,
      confidence,
      civic_multiplier: civic.multiplier,
      calendar_event: civic.calendar_event,
      priority_score: priorityScore,
      severity,
    };
  });
}
