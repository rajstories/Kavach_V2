import { Domain, IncidentStatus, Prisma, PrismaClient, Severity } from "@prisma/client";

const prisma = new PrismaClient();

type SeedIncident = {
  executionId: string;
  domain: Domain;
  severity: Severity;
  status: IncidentStatus;
  classification: string;
  confidence: number;
  offenderType: string;
  offenderValue: string;
  affectedService: string;
  evidenceJson: string[];
  recommendedActionsJson: string[];
  rawFindingJson: Record<string, unknown>;
  detectedAt: Date;
  resolvedAt?: Date;
  remediations: Array<{
    agentType: string;
    actionTaken: string[];
    success: boolean;
    responseJson: Record<string, unknown>;
    executedAt: Date;
  }>;
  alerts: Array<{
    channel: "TELEGRAM" | "EMAIL" | "SLACK";
    status: "SENT" | "FAILED";
    messagePreview: string;
    sentAt: Date;
  }>;
};

function getSeedBaseMultiplier(service: string): number {
  const normalized = service.toLowerCase();
  if (normalized === "election-commission-api" || normalized === "voter-auth-api") return 2.0;
  if (normalized.includes("aadhaar")) return 1.8;
  if (normalized.includes("nhm") || normalized.includes("health")) return 1.6;
  if (normalized.includes("rti")) return 1.5;
  if (normalized.includes("municipal")) return 1.4;
  return 1.0;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

const incidents: SeedIncident[] = [
  {
    executionId: "exec-voter-identity-wave",
    domain: Domain.IDENTITY,
    severity: Severity.CRITICAL,
    status: IncidentStatus.CONTAINED,
    classification: "brute_force",
    confidence: 0.97,
    offenderType: "ip",
    offenderValue: "185.199.110.21",
    affectedService: "voter-auth-api",
    evidenceJson: [
      "2026-02-24T19:11:22Z POST /voter/login 401 src=185.199.110.21 user=voter_13021",
      "2026-02-24T19:11:25Z POST /voter/login 401 src=185.199.110.21 user=voter_13022",
      "2026-02-24T19:12:10Z POST /voter/login 401 src=185.199.110.21 user=voter_13044",
    ],
    recommendedActionsJson: ["block_ip", "enable_lockout_policy", "force_password_reset"],
    rawFindingJson: {
      finding_id: "F-1001",
      domain: "identity",
      classification: "brute_force",
      severity: "critical",
    },
    detectedAt: hoursAgo(20),
    remediations: [
      {
        agentType: "AUTH",
        actionTaken: ["block_ip", "lock_account", "enable_lockout_policy"],
        success: true,
        responseJson: { blocked_ip: "185.199.110.21", lock_count: 44 },
        executedAt: hoursAgo(19.8),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "CRITICAL brute force on voter-auth-api from 185.199.110.21",
        sentAt: hoursAgo(19.7),
      },
      {
        channel: "EMAIL",
        status: "SENT",
        messagePreview: "CERT-style report issued for voter auth incident",
        sentAt: hoursAgo(19.6),
      },
    ],
  },
  {
    executionId: "exec-aadhaar-network-storm",
    domain: Domain.NETWORK,
    severity: Severity.CRITICAL,
    status: IncidentStatus.OPEN,
    classification: "ddos",
    confidence: 0.95,
    offenderType: "ip",
    offenderValue: "203.0.113.0/24",
    affectedService: "aadhaar-verify-service",
    evidenceJson: [
      "2026-02-24T20:03:10Z POST /aadhaar/verify 503 src=203.0.113.45 rt=1320ms",
      "2026-02-24T20:03:11Z POST /aadhaar/verify 503 src=203.0.113.52 rt=1455ms",
      "2026-02-24T20:03:12Z POST /aadhaar/verify 429 src=203.0.113.97 rt=1188ms",
    ],
    recommendedActionsJson: ["traffic_scrubbing", "block_ip_range", "enable_rate_limit"],
    rawFindingJson: {
      finding_id: "F-1002",
      domain: "network",
      classification: "ddos",
      severity: "critical",
    },
    detectedAt: hoursAgo(18),
    remediations: [
      {
        agentType: "NETWORK",
        actionTaken: ["apply_rate_limit", "traffic_scrubbing", "geo_block"],
        success: true,
        responseJson: { requests_blocked_per_minute: 18500 },
        executedAt: hoursAgo(17.7),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "CRITICAL DDoS pressure detected against aadhaar-verify-service",
        sentAt: hoursAgo(17.6),
      },
      {
        channel: "EMAIL",
        status: "SENT",
        messagePreview: "Immediate CERT-style DDoS escalation briefing delivered",
        sentAt: hoursAgo(17.5),
      },
    ],
  },
  {
    executionId: "exec-municipal-exfiltration",
    domain: Domain.INFRASTRUCTURE,
    severity: Severity.CRITICAL,
    status: IncidentStatus.CONTAINED,
    classification: "data_exfiltration",
    confidence: 0.93,
    offenderType: "user",
    offenderValue: "contractor-43",
    affectedService: "municipal-portal",
    evidenceJson: [
      "2026-02-24T22:11:04Z GET /municipal/reports/download?id=4490 bytes=9821144 user=contractor-43",
      "2026-02-24T22:11:32Z GET /municipal/reports/download?id=4491 bytes=10012344 user=contractor-43",
      "2026-02-24T22:12:09Z GET /municipal/reports/download?id=4492 bytes=11055212 user=contractor-43",
    ],
    recommendedActionsJson: ["isolate_service", "trigger_backup", "notify_cert_in"],
    rawFindingJson: {
      finding_id: "F-1003",
      domain: "infrastructure",
      classification: "data_exfiltration",
      severity: "critical",
    },
    detectedAt: hoursAgo(16),
    remediations: [
      {
        agentType: "INFRA",
        actionTaken: ["isolate_service", "trigger_backup", "notify_cert_in", "escalate_to_human"],
        success: true,
        responseJson: { quarantine_segment: "SEG-4", cert_in_ticket: "CERT-2026-7781" },
        executedAt: hoursAgo(15.7),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "CRITICAL data exfiltration contained in municipal-portal",
        sentAt: hoursAgo(15.6),
      },
      {
        channel: "EMAIL",
        status: "SENT",
        messagePreview: "CERT draft and exfiltration impact note sent to CISO desk",
        sentAt: hoursAgo(15.5),
      },
    ],
  },
  {
    executionId: "exec-identity-followup",
    domain: Domain.IDENTITY,
    severity: Severity.HIGH,
    status: IncidentStatus.CONTAINED,
    classification: "credential_stuffing",
    confidence: 0.89,
    offenderType: "ip",
    offenderValue: "198.51.100.42",
    affectedService: "aadhaar-verify-service",
    evidenceJson: [
      "2026-02-25T00:21:20Z POST /aadhaar/token 401 src=198.51.100.42 user=batch-login-31",
      "2026-02-25T00:21:23Z POST /aadhaar/token 401 src=198.51.100.42 user=batch-login-32",
    ],
    recommendedActionsJson: ["revoke_tokens", "block_ip", "step_up_auth"],
    rawFindingJson: { finding_id: "F-1004", domain: "identity", severity: "high" },
    detectedAt: hoursAgo(14),
    remediations: [
      {
        agentType: "AUTH",
        actionTaken: ["block_ip", "revoke_token"],
        success: true,
        responseJson: { revoked_tokens: 212 },
        executedAt: hoursAgo(13.8),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "HIGH credential stuffing attempt blocked for aadhaar token endpoint",
        sentAt: hoursAgo(13.7),
      },
      {
        channel: "EMAIL",
        status: "SENT",
        messagePreview: "High-priority identity hardening advisory sent",
        sentAt: hoursAgo(13.6),
      },
    ],
  },
  {
    executionId: "exec-election-query-abuse",
    domain: Domain.NETWORK,
    severity: Severity.HIGH,
    status: IncidentStatus.OPEN,
    classification: "sql_injection",
    confidence: 0.86,
    offenderType: "ip",
    offenderValue: "198.51.100.34",
    affectedService: "election-commission-api",
    evidenceJson: [
      "2026-02-25T01:02:11Z GET /election/candidate?name=' OR 1=1 -- 500 src=198.51.100.34",
      "2026-02-25T01:02:22Z GET /election/booth?ward=12 UNION SELECT password FROM admins 403 src=198.51.100.34",
    ],
    recommendedActionsJson: ["enable_waf_rule", "endpoint_block", "db_audit"],
    rawFindingJson: { finding_id: "F-1005", domain: "network", severity: "high" },
    detectedAt: hoursAgo(13),
    remediations: [
      {
        agentType: "NETWORK",
        actionTaken: ["enable_waf_rule", "endpoint_block"],
        success: true,
        responseJson: { waf_rule_id: "WAF-SQLI-22" },
        executedAt: hoursAgo(12.8),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "HIGH SQLi attempt on election-commission-api",
        sentAt: hoursAgo(12.7),
      },
    ],
  },
  {
    executionId: "exec-rti-admin-tamper",
    domain: Domain.INFRASTRUCTURE,
    severity: Severity.HIGH,
    status: IncidentStatus.CONTAINED,
    classification: "privilege_escalation",
    confidence: 0.88,
    offenderType: "user",
    offenderValue: "rti-admin-temp",
    affectedService: "rti-portal",
    evidenceJson: [
      "2026-02-25T01:41:15Z PATCH /admin/roles elevated_to=super_admin user=rti-admin-temp",
      "2026-02-25T01:41:17Z POST /admin/policies disabled_mfa=true user=rti-admin-temp",
    ],
    recommendedActionsJson: ["force_mfa", "audit_all", "rotate_admin_keys"],
    rawFindingJson: { finding_id: "F-1006", domain: "infrastructure", severity: "high" },
    detectedAt: hoursAgo(12),
    remediations: [
      {
        agentType: "INFRA",
        actionTaken: ["force_mfa", "audit_all"],
        success: true,
        responseJson: { admin_sessions_revoked: 4 },
        executedAt: hoursAgo(11.8),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "HIGH privilege escalation detected in RTI portal",
        sentAt: hoursAgo(11.7),
      },
    ],
  },
  {
    executionId: "exec-municipal-api-flood",
    domain: Domain.NETWORK,
    severity: Severity.HIGH,
    status: IncidentStatus.CONTAINED,
    classification: "api_abuse",
    confidence: 0.84,
    offenderType: "service",
    offenderValue: "third-party-analytics-bot",
    affectedService: "municipal-portal",
    evidenceJson: [
      "2026-02-25T02:25:31Z GET /municipal/property/search 429 service=third-party-analytics-bot",
      "2026-02-25T02:25:38Z GET /municipal/property/search 429 service=third-party-analytics-bot",
    ],
    recommendedActionsJson: ["apply_rate_limit", "api_key_revoke", "partner_notification"],
    rawFindingJson: { finding_id: "F-1007", domain: "network", severity: "high" },
    detectedAt: hoursAgo(11),
    remediations: [
      {
        agentType: "NETWORK",
        actionTaken: ["apply_rate_limit", "api_key_revoke"],
        success: true,
        responseJson: { revoked_api_keys: 3 },
        executedAt: hoursAgo(10.8),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "HIGH API abuse throttled for municipal-portal",
        sentAt: hoursAgo(10.7),
      },
    ],
  },
  {
    executionId: "exec-election-auth-gap",
    domain: Domain.IDENTITY,
    severity: Severity.HIGH,
    status: IncidentStatus.OPEN,
    classification: "unauthorized_access",
    confidence: 0.83,
    offenderType: "user",
    offenderValue: "eci-contract-user-9",
    affectedService: "election-commission-api",
    evidenceJson: [
      "2026-02-25T03:15:08Z GET /eci/internal/roster 200 user=eci-contract-user-9 role=viewer",
      "2026-02-25T03:15:11Z POST /eci/internal/token/impersonate 200 user=eci-contract-user-9",
    ],
    recommendedActionsJson: ["lock_account", "audit_log", "privilege_review"],
    rawFindingJson: { finding_id: "F-1008", domain: "identity", severity: "high" },
    detectedAt: hoursAgo(10),
    remediations: [
      {
        agentType: "AUTH",
        actionTaken: ["lock_account", "audit_log"],
        success: true,
        responseJson: { account_locked: "eci-contract-user-9" },
        executedAt: hoursAgo(9.9),
      },
    ],
    alerts: [
      {
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: "HIGH unauthorized access in election-commission-api",
        sentAt: hoursAgo(9.8),
      },
    ],
  },
  {
    executionId: "exec-voter-perimeter-scan",
    domain: Domain.NETWORK,
    severity: Severity.MEDIUM,
    status: IncidentStatus.CONTAINED,
    classification: "port_scan",
    confidence: 0.74,
    offenderType: "ip",
    offenderValue: "45.83.91.77",
    affectedService: "voter-auth-api",
    evidenceJson: [
      "2026-02-25T04:10:01Z TCP SYN scan src=45.83.91.77 dst_port=22",
      "2026-02-25T04:10:02Z TCP SYN scan src=45.83.91.77 dst_port=443",
    ],
    recommendedActionsJson: ["geo_block", "enable_waf_rule"],
    rawFindingJson: { finding_id: "F-1009", domain: "network", severity: "medium" },
    detectedAt: hoursAgo(9),
    remediations: [
      {
        agentType: "NETWORK",
        actionTaken: ["enable_waf_rule", "geo_block"],
        success: true,
        responseJson: { blocked_country: "unknown" },
        executedAt: hoursAgo(8.8),
      },
    ],
    alerts: [],
  },
  {
    executionId: "exec-nic-phishing-wave",
    domain: Domain.INFRASTRUCTURE,
    severity: Severity.MEDIUM,
    status: IncidentStatus.OPEN,
    classification: "phishing_attempt",
    confidence: 0.79,
    offenderType: "service",
    offenderValue: "mail-gateway-spoof",
    affectedService: "nic-mail-relay",
    evidenceJson: [
      "2026-02-25T05:02:12Z SMTP suspicious domain=nic-support.in from=help@secure-nic.in",
      "2026-02-25T05:03:44Z 54 users clicked embedded reset link",
    ],
    recommendedActionsJson: ["force_mfa", "escalate_to_human", "employee_advisory"],
    rawFindingJson: { finding_id: "F-1010", domain: "infrastructure", severity: "medium" },
    detectedAt: hoursAgo(8),
    remediations: [
      {
        agentType: "INFRA",
        actionTaken: ["force_mfa", "escalate_to_human"],
        success: true,
        responseJson: { users_notified: 320 },
        executedAt: hoursAgo(7.8),
      },
    ],
    alerts: [],
  },
  {
    executionId: "exec-rti-auth-noise",
    domain: Domain.IDENTITY,
    severity: Severity.MEDIUM,
    status: IncidentStatus.RESOLVED,
    classification: "brute_force",
    confidence: 0.71,
    offenderType: "ip",
    offenderValue: "103.61.224.18",
    affectedService: "rti-portal",
    evidenceJson: [
      "2026-02-25T05:41:09Z POST /rti/login 401 src=103.61.224.18",
      "2026-02-25T05:41:44Z POST /rti/login 401 src=103.61.224.18",
    ],
    recommendedActionsJson: ["block_ip", "captcha_hardening"],
    rawFindingJson: { finding_id: "F-1011", domain: "identity", severity: "medium" },
    detectedAt: hoursAgo(7),
    resolvedAt: hoursAgo(5.5),
    remediations: [
      {
        agentType: "AUTH",
        actionTaken: ["block_ip", "enable_lockout_policy"],
        success: true,
        responseJson: { ip_blocked: "103.61.224.18" },
        executedAt: hoursAgo(6.9),
      },
    ],
    alerts: [],
  },
  {
    executionId: "exec-eci-query-overuse",
    domain: Domain.NETWORK,
    severity: Severity.MEDIUM,
    status: IncidentStatus.CONTAINED,
    classification: "api_abuse",
    confidence: 0.68,
    offenderType: "service",
    offenderValue: "reporting-aggregator-12",
    affectedService: "election-commission-api",
    evidenceJson: [
      "2026-02-25T06:18:10Z GET /eci/results/district 429 service=reporting-aggregator-12",
      "2026-02-25T06:18:11Z GET /eci/results/state 429 service=reporting-aggregator-12",
    ],
    recommendedActionsJson: ["apply_rate_limit", "partner_traffic_contract"],
    rawFindingJson: { finding_id: "F-1012", domain: "network", severity: "medium" },
    detectedAt: hoursAgo(6),
    remediations: [
      {
        agentType: "NETWORK",
        actionTaken: ["apply_rate_limit"],
        success: true,
        responseJson: { requests_per_min_cap: 120 },
        executedAt: hoursAgo(5.9),
      },
    ],
    alerts: [],
  },
  {
    executionId: "exec-municipal-session-check",
    domain: Domain.IDENTITY,
    severity: Severity.LOW,
    status: IncidentStatus.RESOLVED,
    classification: "unauthorized_access",
    confidence: 0.57,
    offenderType: "user",
    offenderValue: "temp-clerk-17",
    affectedService: "municipal-portal",
    evidenceJson: [
      "2026-02-25T07:11:20Z GET /municipal/internal/stats user=temp-clerk-17 role=guest",
      "2026-02-25T07:11:29Z GET /municipal/internal/config user=temp-clerk-17 role=guest",
    ],
    recommendedActionsJson: ["audit_log", "role_cleanup"],
    rawFindingJson: { finding_id: "F-1013", domain: "identity", severity: "low" },
    detectedAt: hoursAgo(5),
    resolvedAt: hoursAgo(3.5),
    remediations: [
      {
        agentType: "AUTH",
        actionTaken: ["audit_log", "lock_account"],
        success: true,
        responseJson: { account: "temp-clerk-17", action: "disabled" },
        executedAt: hoursAgo(4.8),
      },
    ],
    alerts: [],
  },
  {
    executionId: "exec-aadhaar-surface-scan",
    domain: Domain.NETWORK,
    severity: Severity.LOW,
    status: IncidentStatus.CONTAINED,
    classification: "port_scan",
    confidence: 0.52,
    offenderType: "ip",
    offenderValue: "91.199.212.44",
    affectedService: "aadhaar-verify-service",
    evidenceJson: [
      "2026-02-25T08:02:51Z SYN probe src=91.199.212.44 dst=443",
      "2026-02-25T08:02:52Z SYN probe src=91.199.212.44 dst=8443",
    ],
    recommendedActionsJson: ["geo_block", "watchlist_ip"],
    rawFindingJson: { finding_id: "F-1014", domain: "network", severity: "low" },
    detectedAt: hoursAgo(4),
    remediations: [
      {
        agentType: "NETWORK",
        actionTaken: ["geo_block"],
        success: true,
        responseJson: { source_region: "untrusted" },
        executedAt: hoursAgo(3.8),
      },
    ],
    alerts: [],
  },
  {
    executionId: "exec-delhi-police-phish-check",
    domain: Domain.INFRASTRUCTURE,
    severity: Severity.LOW,
    status: IncidentStatus.OPEN,
    classification: "phishing_attempt",
    confidence: 0.55,
    offenderType: "service",
    offenderValue: "lookalike-mail-node",
    affectedService: "delhi-police-portal",
    evidenceJson: [
      "2026-02-25T08:44:12Z email_subject='Urgent FIR Update' sender=fir-secure@police-delhi.in",
      "2026-02-25T08:45:00Z clickthrough_count=6 endpoint=/secure-login",
    ],
    recommendedActionsJson: ["user_awareness_notice", "mfa_reminder"],
    rawFindingJson: { finding_id: "F-1015", domain: "infrastructure", severity: "low" },
    detectedAt: hoursAgo(3),
    remediations: [
      {
        agentType: "INFRA",
        actionTaken: ["force_mfa", "escalate_to_human"],
        success: true,
        responseJson: { awareness_mail_sent: true },
        executedAt: hoursAgo(2.8),
      },
    ],
    alerts: [],
  },
];

async function main(): Promise<void> {
  await prisma.alertLog.deleteMany();
  await prisma.remediation.deleteMany();
  await prisma.threatIntelligence.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.logBatch.deleteMany();
  await prisma.copilotSession.deleteMany();

  for (const incident of incidents) {
    const civicMultiplier = getSeedBaseMultiplier(incident.affectedService);
    const priorityScore = Number((incident.confidence * civicMultiplier).toFixed(2));

    const created = await prisma.incident.create({
      data: {
        executionId: incident.executionId,
        findingId: String(incident.rawFindingJson.finding_id ?? `seed-${incident.executionId}`),
        domain: incident.domain,
        severity: incident.severity,
        status: incident.status,
        classification: incident.classification,
        confidence: incident.confidence,
        offenderType: incident.offenderType,
        offenderValue: incident.offenderValue,
        affectedService: incident.affectedService,
        evidenceJson: incident.evidenceJson,
        recommendedActionsJson: incident.recommendedActionsJson,
        rawFindingJson: incident.rawFindingJson as Prisma.InputJsonValue,
        detectedAt: incident.detectedAt,
        resolvedAt: incident.resolvedAt,
        civicMultiplier,
        calendarEvent: null,
        isCalendarElevated: false,
        priorityScore,
        intelEnriched: false,
        threatLevel: null,
      },
    });

    for (const remediation of incident.remediations) {
      await prisma.remediation.create({
        data: {
          incidentId: created.id,
          agentType: remediation.agentType,
          actionTaken: remediation.actionTaken,
          success: remediation.success,
          responseJson: remediation.responseJson as Prisma.InputJsonValue,
          executedAt: remediation.executedAt,
        },
      });
    }

    for (const alert of incident.alerts) {
      await prisma.alertLog.create({
        data: {
          incidentId: created.id,
          channel: alert.channel,
          status: alert.status,
          messagePreview: alert.messagePreview,
          sentAt: alert.sentAt,
        },
      });
    }
  }

  await prisma.logBatch.createMany({
    data: [
      {
        source: "voter-auth-api",
        rawLogsJson: { sample: "batch-1", log_count: 422 },
        findingsCount: 4,
        executionId: "exec-voter-identity-wave",
      },
      {
        source: "aadhaar-verify-service",
        rawLogsJson: { sample: "batch-2", log_count: 980 },
        findingsCount: 5,
        executionId: "exec-aadhaar-network-storm",
      },
      {
        source: "municipal-portal",
        rawLogsJson: { sample: "batch-3", log_count: 305 },
        findingsCount: 3,
        executionId: "exec-municipal-exfiltration",
      },
    ],
  });

  console.log(`Seeded ${incidents.length} incidents with remediations and alert logs.`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
