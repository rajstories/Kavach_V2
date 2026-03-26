import { PrismaClient } from "@prisma/client";
import { sendUIDAISOCAlert } from "../../alerts/emailAlert";
import { logger } from "../../config/logger";
import type { Finding, PrioritizedIncident, RemediationResult } from "../../types";

const prisma = new PrismaClient();

type AuthPolicyInput = {
  maxFailedAttempts?: number;
  lockoutMin?: number;
  otpRefreshRequired?: boolean;
  rateLimit?: "1/30s";
};

type CloudflareIPBlockInput = {
  ip: string;
  note: string;
  ttl_hours: number;
};

type CloudflareCIDRBlockEntry = {
  cidr: string;
  note: string;
  ttl_hours: number;
};

export interface AuthAgentResult {
  agent: "auth";
  actions: string[];
  accounts_locked: number;
  sessions_revoked: number;
  ips_blocked: number;
}

export function extractTargetedAccounts(evidence: string): string[] {
  const usernames = new Set<string>();
  const regex = /\buser=([A-Za-z0-9_.-]{1,64})\b/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(evidence)) !== null) {
    usernames.add(match[1]);
    if (usernames.size >= 50) {
      break;
    }
  }

  return Array.from(usernames);
}

export function extractIPCluster(evidence: string): string[] {
  const ips = new Set<string>();
  const regex = /\bip=((?:\d{1,3}\.){3}\d{1,3})\b/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(evidence)) !== null) {
    ips.add(match[1]);
  }

  return Array.from(ips);
}

export function extractSuccessfulUIDs(evidence: string): string[] {
  const uids = new Set<string>();
  const lines = evidence.split("\n");
  const uidRegex = /\buid=([0-9xX*]{6,32})\b/i;

  for (const line of lines) {
    if (!/POST\s+\/verify\s+200/i.test(line)) {
      continue;
    }

    const uidMatch = line.match(uidRegex);
    if (uidMatch?.[1]) {
      uids.add(uidMatch[1]);
    }
  }

  return Array.from(uids);
}

function toEvidenceText(evidence: string[]): string {
  return evidence.join("\n");
}

function toCIDR24(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return `${ip}/32`;
  }

  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

async function cloudflareBlockIP({ ip, note, ttl_hours }: CloudflareIPBlockInput): Promise<void> {
  logger.info("AUTH AGENT: Cloudflare WAF block IP (stub)", {
    provider: "cloudflare",
    ip,
    note,
    ttl_hours,
  });
}

async function cloudflareBlockCIDRBatch(entries: CloudflareCIDRBlockEntry[]): Promise<void> {
  logger.info("AUTH AGENT: Cloudflare WAF block CIDR batch (stub)", {
    provider: "cloudflare",
    count: entries.length,
    entries,
  });
}

async function preserveForensicLogs(service: string, windowSec: number): Promise<void> {
  logger.info("AUTH AGENT: Preserving forensic logs", {
    service,
    windowSec,
  });
}

async function lockAccounts(service: string, accounts: string[]): Promise<number> {
  logger.info("AUTH AGENT: Locking accounts (stub)", {
    service,
    accounts_locked: accounts.length,
    accounts,
  });
  return accounts.length;
}

async function revokeSessionsFromIP(service: string, ip: string): Promise<number> {
  logger.info("AUTH AGENT: Revoking sessions from source IP (stub)", {
    service,
    ip,
  });
  return 0;
}

async function revokeSessionsForUIDs(service: string, uids: string[]): Promise<number> {
  logger.info("AUTH AGENT: Revoking sessions for compromised UIDs (stub)", {
    service,
    uid_count: uids.length,
    uids,
  });
  return uids.length;
}

async function setAuthPolicy(incidentId: string, service: string, policy: AuthPolicyInput): Promise<void> {
  await prisma.remediation.create({
    data: {
      incidentId,
      agentType: "AUTH_POLICY",
      actionTaken: ["auth_policy_updated"],
      success: true,
      responseJson: {
        service,
        policy,
      },
      accounts_locked: 0,
      sessions_revoked: 0,
      ips_blocked: 0,
    } as never,
  });
}

async function writeAuditRecord(params: {
  incidentId: string;
  finding: Finding;
  result: AuthAgentResult;
  forensicWindowSec: 90 | 120;
}): Promise<void> {
  await prisma.remediation.create({
    data: {
      incidentId: params.incidentId,
      agentType: "AUTH_IDENTITY",
      actionTaken: params.result.actions,
      success: true,
      responseJson: {
        findingId: params.finding.finding_id,
        classification: params.finding.classification,
        civicContext: params.finding.civic_context,
        forensicWindowSec: params.forensicWindowSec,
        ...params.result,
      },
      accounts_locked: params.result.accounts_locked,
      sessions_revoked: params.result.sessions_revoked,
      ips_blocked: params.result.ips_blocked,
    } as never,
  });
}

function toFindingFromIncident(incident: PrioritizedIncident): Finding {
  return {
    finding_id: incident.findingId,
    domain: incident.domain,
    classification: incident.classification,
    severity: incident.severity,
    confidence: incident.confidence,
    offender: incident.offender,
    affected_service: incident.affectedService,
    metrics: {
      event_count: incident.evidence.length,
      duration_sec: 0,
      unique_targets: 1,
    },
    evidence: incident.evidence,
    recommended_actions: incident.recommendedActions,
    civic_context: incident.civicContext,
  };
}

async function processBruteForce(finding: Finding, incidentId: string): Promise<AuthAgentResult> {
  const offenderIP = finding.offender.value;

  await cloudflareBlockIP({
    ip: offenderIP,
    note: `KAVACH brute_force incident=${incidentId}`,
    ttl_hours: 24,
  });

  const evidenceText = toEvidenceText(finding.evidence);
  const targetedAccounts = extractTargetedAccounts(evidenceText);
  const accountsLocked = await lockAccounts(finding.affected_service, targetedAccounts);

  await setAuthPolicy(incidentId, finding.affected_service, {
    maxFailedAttempts: 5,
    lockoutMin: 30,
  });

  const sessionsRevoked = await revokeSessionsFromIP(finding.affected_service, offenderIP);
  await preserveForensicLogs(finding.affected_service, 90);

  const actions = [
    `blocked_ip:${offenderIP}`,
    `locked_accounts:${targetedAccounts.length > 0 ? targetedAccounts.join(",") : "none"}`,
    "lockout_policy_applied",
    `revoked_${sessionsRevoked}_sessions`,
    "forensic_logs_preserved",
  ];

  const result: AuthAgentResult = {
    agent: "auth",
    actions,
    accounts_locked: accountsLocked,
    sessions_revoked: sessionsRevoked,
    ips_blocked: 1,
  };

  await writeAuditRecord({
    incidentId,
    finding,
    result,
    forensicWindowSec: 90,
  });

  return result;
}

async function processCredentialStuffing(finding: Finding, incidentId: string): Promise<AuthAgentResult> {
  const evidenceText = toEvidenceText(finding.evidence);
  const extractedIPs = extractIPCluster(evidenceText);
  const ips = extractedIPs.length > 0 ? extractedIPs : [finding.offender.value];
  const clusterCIDRs = Array.from(new Set(ips.map((ip) => toCIDR24(ip))));

  await cloudflareBlockCIDRBatch(
    clusterCIDRs.map((cidr) => ({
      cidr,
      note: `KAVACH credential_stuffing incident=${incidentId}`,
      ttl_hours: 24,
    })),
  );

  const compromisedUIDs = extractSuccessfulUIDs(evidenceText);
  if (compromisedUIDs.length > 0) {
    const flaggedUIDModel = (prisma as unknown as { flaggedUID?: { createMany?: (args: unknown) => Promise<unknown> } })
      .flaggedUID;
    if (flaggedUIDModel?.createMany) {
      await flaggedUIDModel.createMany({
        data: compromisedUIDs.map((uid) => ({
          incidentId,
          uid,
          service: finding.affected_service,
          source: "auth_agent_credential_stuffing",
        })),
        skipDuplicates: true,
      });
    } else {
      logger.warn("AUTH AGENT: FlaggedUID model unavailable in Prisma client; skipped UID flagging", {
        incidentId,
        uidCount: compromisedUIDs.length,
      });
    }
  }

  await sendUIDAISOCAlert({
    incidentId,
    findingId: finding.finding_id,
    civicContext: finding.civic_context,
    flaggedUIDs: compromisedUIDs,
  });

  const sessionsRevoked = await revokeSessionsForUIDs(finding.affected_service, compromisedUIDs);

  await setAuthPolicy(incidentId, finding.affected_service, {
    otpRefreshRequired: true,
    rateLimit: "1/30s",
  });

  await preserveForensicLogs(finding.affected_service, 120);

  const actions = [
    `blocked_ip_cluster:${clusterCIDRs.join(",")}`,
    `flagged_uids:${compromisedUIDs.length > 0 ? compromisedUIDs.join(",") : "none"}`,
    "uidai_soc_alert_sent",
    `revoked_${sessionsRevoked}_sessions`,
    "auth_policy_hardened",
    "forensic_logs_preserved",
  ];

  const result: AuthAgentResult = {
    agent: "auth",
    actions,
    accounts_locked: 0,
    sessions_revoked: sessionsRevoked,
    ips_blocked: clusterCIDRs.length,
  };

  await writeAuditRecord({
    incidentId,
    finding,
    result,
    forensicWindowSec: 120,
  });

  return result;
}

async function processUnauthorizedAccess(finding: Finding, incidentId: string): Promise<AuthAgentResult> {
  const evidenceText = toEvidenceText(finding.evidence);
  const targetedAccounts = extractTargetedAccounts(evidenceText);
  const accountsLocked = await lockAccounts(finding.affected_service, targetedAccounts);

  await preserveForensicLogs(finding.affected_service, 90);

  const result: AuthAgentResult = {
    agent: "auth",
    actions: [
      `locked_accounts:${targetedAccounts.length > 0 ? targetedAccounts.join(",") : "none"}`,
      "forensic_logs_preserved",
    ],
    accounts_locked: accountsLocked,
    sessions_revoked: 0,
    ips_blocked: 0,
  };

  await writeAuditRecord({
    incidentId,
    finding,
    result,
    forensicWindowSec: 90,
  });

  return result;
}

async function processDataExfiltration(finding: Finding, incidentId: string): Promise<AuthAgentResult> {
  const offenderIP = finding.offender.value;

  await cloudflareBlockIP({
    ip: offenderIP,
    note: `KAVACH data_exfiltration incident=${incidentId}`,
    ttl_hours: 24,
  });

  const sessionsRevoked = await revokeSessionsFromIP(finding.affected_service, offenderIP);
  await preserveForensicLogs(finding.affected_service, 120);

  const result: AuthAgentResult = {
    agent: "auth",
    actions: [
      `blocked_ip:${offenderIP}`,
      `revoked_${sessionsRevoked}_sessions`,
      "forensic_logs_preserved",
    ],
    accounts_locked: 0,
    sessions_revoked: sessionsRevoked,
    ips_blocked: 1,
  };

  await writeAuditRecord({
    incidentId,
    finding,
    result,
    forensicWindowSec: 120,
  });

  return result;
}

export async function authAgent(finding: Finding, incidentId: string): Promise<AuthAgentResult> {
  switch (finding.classification) {
    case "brute_force":
      return processBruteForce(finding, incidentId);
    case "credential_stuffing":
      return processCredentialStuffing(finding, incidentId);
    case "unauthorized_access":
      return processUnauthorizedAccess(finding, incidentId);
    case "data_exfiltration":
      return processDataExfiltration(finding, incidentId);
    default:
      throw new Error(`Unsupported auth classification: ${finding.classification}`);
  }
}

export async function remediateAuth(incident: PrioritizedIncident): Promise<RemediationResult> {
  try {
    const finding = toFindingFromIncident(incident);
    const result = await authAgent(finding, incident.incidentId);

    return {
      incidentId: incident.incidentId,
      agentType: "AUTH",
      success: true,
      actionsTaken: result.actions,
      response: { ...result },
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Auth remediation failed", {
      incidentId: incident.incidentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
