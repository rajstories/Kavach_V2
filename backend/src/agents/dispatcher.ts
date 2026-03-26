import { IncidentStatus, Prisma } from "@prisma/client";
import { sendEmailAlert } from "../alerts/emailAlert";
import { sendTelegramAlert } from "../alerts/telegramAlert";
import { logger } from "../config/logger";
import { prisma } from "../db/client";
import type { PrioritizedIncident, RemediationResult } from "../types";
import { intelAgent } from "./intelAgent";
import { remediateAuth } from "./remediationAgents/authAgent";
import { remediateInfra } from "./remediationAgents/infraAgent";
import { remediateNetwork } from "./remediationAgents/networkAgent";
import { swarmBroadcast } from "./swarmBroadcast";
import type { ImmediatorResult } from "./immediatorAgent";

type RouteAgent = "auth" | "network" | "infra";
type AlertChannel = "telegram" | "email" | "jira" | "sms";

export const ROUTING_TABLE: Record<
  string,
  {
    agents: RouteAgent[];
    parallel: boolean;
    channels: AlertChannel[];
  }
> = {
  brute_force: {
    agents: ["auth"],
    parallel: false,
    channels: ["telegram", "email"],
  },
  credential_stuffing: {
    agents: ["auth"],
    parallel: false,
    channels: ["telegram", "email"],
  },
  ddos: {
    agents: ["network", "infra"],
    parallel: true,
    channels: ["telegram"],
  },
  sql_injection: {
    agents: ["network"],
    parallel: false,
    channels: ["telegram", "email"],
  },
  data_exfiltration: {
    agents: ["auth", "network"],
    parallel: true,
    channels: ["telegram", "email", "jira"],
  },
  api_abuse: {
    agents: ["network"],
    parallel: false,
    channels: ["telegram"],
  },
  reconnaissance: {
    agents: ["network"],
    parallel: false,
    channels: ["telegram"],
  },
  ransomware_precursor: {
    agents: ["auth", "network", "infra"],
    parallel: true,
    channels: ["telegram", "email", "jira", "sms"],
  },
};

function appendDispatchError(rawFindingJson: Prisma.JsonValue, errorNote: string): Prisma.InputJsonValue {
  const base =
    typeof rawFindingJson === "object" && rawFindingJson !== null && !Array.isArray(rawFindingJson)
      ? (rawFindingJson as Record<string, Prisma.JsonValue>)
      : {};

  return {
    ...base,
    dispatch_error: errorNote,
    dispatch_failed_at: new Date().toISOString(),
  } as Prisma.InputJsonValue;
}

function buildFallbackRemediation(incident: PrioritizedIncident): RemediationResult {
  return {
    incidentId: incident.incidentId,
    agentType: "INFRA",
    success: false,
    actionsTaken: ["no_successful_remediation"],
    response: { note: "No successful remediation result found" },
    executedAt: new Date().toISOString(),
  };
}

async function sendJiraAlert(incident: PrioritizedIncident): Promise<void> {
  logger.warn("Jira alert requested but integration is not implemented", {
    incidentId: incident.incidentId,
    classification: incident.classification,
  });
}

async function sendSmsAlert(incident: PrioritizedIncident): Promise<void> {
  logger.warn("SMS alert requested but integration is not implemented", {
    incidentId: incident.incidentId,
    classification: incident.classification,
  });
}

export async function runSequential<T>(tasks: Array<() => Promise<T>>): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];

  for (const task of tasks) {
    try {
      const value = await task();
      results.push({ status: "fulfilled", value });
    } catch (error) {
      results.push({
        status: "rejected",
        reason: error instanceof Error ? error : new Error("Unknown sequential task failure"),
      });
    }
  }

  return results;
}

function buildAgentTasks(incident: PrioritizedIncident, agents: RouteAgent[]): Array<() => Promise<RemediationResult>> {
  return agents.map((agent) => {
    if (agent === "auth") {
      return () => remediateAuth(incident);
    }

    if (agent === "network") {
      return () => remediateNetwork(incident);
    }

    return () => remediateInfra(incident);
  });
}

async function fireAlerts(
  incident: PrioritizedIncident,
  channels: AlertChannel[],
  remediation: RemediationResult,
): Promise<PromiseSettledResult<void>[]> {
  const tasks = channels.map((channel) => {
    if (channel === "telegram") {
      return sendTelegramAlert(incident, remediation);
    }

    if (channel === "email") {
      return sendEmailAlert(incident);
    }

    if (channel === "jira") {
      return sendJiraAlert(incident);
    }

    return sendSmsAlert(incident);
  });

  return Promise.allSettled(tasks);
}

export async function dispatch(incident: PrioritizedIncident): Promise<void> {
  const route = ROUTING_TABLE[incident.classification];

  if (!route) {
    logger.warn("Dispatcher found unknown classification", {
      incidentId: incident.incidentId,
      classification: incident.classification,
    });
    return;
  }

  const existing = await prisma.incident.findUnique({
    where: { id: incident.incidentId },
  });

  if (!existing) {
    logger.warn("Dispatcher could not find incident before remediation", {
      incidentId: incident.incidentId,
      classification: incident.classification,
    });
    return;
  }

  await prisma.incident.update({
    where: { id: incident.incidentId },
    data: { status: IncidentStatus.REMEDIATING },
  });

  const taskFactories = buildAgentTasks(incident, route.agents);
  const remediationResults = route.parallel
    ? await Promise.allSettled(taskFactories.map((task) => task()))
    : await runSequential(taskFactories);

  void intelAgent(incident as ImmediatorResult)
    .then((intel) => {
      if (intel) {
        console.log(`[Intel] Enriched: ${intel.threat_level}`);
      }
    })
    .catch(() => {});

  const fulfilled = remediationResults.filter(
    (result): result is PromiseFulfilledResult<RemediationResult> => result.status === "fulfilled",
  );
  const rejected = remediationResults.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (rejected.length === 0) {
    await prisma.incident.update({
      where: { id: incident.incidentId },
      data: { status: IncidentStatus.CONTAINED },
    });
  } else {
    const errorNote = rejected
      .map((result) => (result.reason instanceof Error ? result.reason.message : "Unknown remediation failure"))
      .join(" | ");

    await prisma.incident.update({
      where: { id: incident.incidentId },
      data: {
        status: IncidentStatus.CONTAINED,
        rawFindingJson: appendDispatchError(existing.rawFindingJson, errorNote),
      },
    });
  }

  const remediationForAlert = fulfilled[0]?.value ?? buildFallbackRemediation(incident);
  const alertResults = await fireAlerts(incident, route.channels, remediationForAlert);
  const failedAlerts = alertResults.filter((result) => result.status === "rejected").length;

  logger.info("Dispatcher finished incident", {
    incidentId: incident.incidentId,
    classification: incident.classification,
    routedAgents: route.agents,
    parallel: route.parallel,
    channels: route.channels,
    remediationFulfilled: fulfilled.length,
    remediationRejected: rejected.length,
    failedAlerts,
  });

  // Swarm auto-vaccination: propagate block to all portals for CRITICAL incidents.
  // Uses Promise.allSettled so swarm failure never breaks the main dispatch flow.
  if (incident.severity === "critical") {
    Promise.allSettled([
      swarmBroadcast(incident as ImmediatorResult),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === "rejected") {
          logger.warn("Swarm broadcast failed (non-blocking)", {
            incidentId: incident.incidentId,
            error: r.reason instanceof Error ? r.reason.message : "Unknown swarm error",
          });
        }
      }
    });
  }
}
