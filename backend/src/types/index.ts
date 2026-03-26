export type DomainType = "identity" | "network" | "infrastructure";

export type FindingClassification =
  | "brute_force"
  | "credential_stuffing"
  | "ddos"
  | "sql_injection"
  | "ransomware_precursor"
  | "reconnaissance"
  | "port_scan"
  | "data_exfiltration"
  | "privilege_escalation"
  | "phishing_attempt"
  | "api_abuse"
  | "unauthorized_access";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export interface RawLog {
  timestamp: string;
  source_ip: string;
  endpoint: string;
  status_code: number;
  method: string;
  user_agent: string;
  response_time: number;
  bytes_sent: number;
  source?: string;
  service?: string;
  user_id?: string;
}

export interface LogEntry extends RawLog {
  source: string;
  service: string;
}

export interface Finding {
  finding_id: string;
  domain: DomainType;
  classification: FindingClassification;
  severity: FindingSeverity;
  confidence: number;
  offender: {
    type: "ip" | "user" | "service";
    value: string;
  };
  affected_service: string;
  metrics: {
    event_count: number;
    duration_sec: number;
    unique_targets: number;
  };
  evidence: string[];
  recommended_actions: string[];
  civic_context: string;
}

export interface PrioritizedIncident {
  incidentId: string;
  executionId: string;
  findingId: string;
  domain: DomainType;
  classification: FindingClassification;
  severity: FindingSeverity;
  confidence: number;
  offender: {
    type: "ip" | "user" | "service";
    value: string;
  };
  affectedService: string;
  evidence: string[];
  recommendedActions: string[];
  civicContext: string;
  civicImpactMultiplier: number;
  finalScore: number;
  calendarEvent?: string | null;
  isCalendarElevated?: boolean;
  dispatch_immediately?: boolean;
  detectedAt: string;
}

export interface RemediationResult {
  incidentId: string;
  agentType: "AUTH" | "NETWORK" | "INFRA";
  success: boolean;
  actionsTaken: string[];
  response: Record<string, unknown>;
  executedAt: string;
}

export interface AlertLogRecord {
  incidentId: string;
  channel: "TELEGRAM" | "EMAIL" | "SLACK" | "SMS" | "JIRA";
  status: "SENT" | "FAILED";
  messagePreview: string;
  sentAt: string;
}

export interface DashboardStats {
  totalIncidents: number;
  criticalCount: number;
  containedToday: number;
  avgResponseTimeMinutes: number;
  bySeverity: Record<string, number>;
  byDomain: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  message: string;
  timestamp: string;
}

export interface DailBriefing {
  hindi: string;
  english: string;
  generatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  role: "admin" | "viewer";
}

export interface AnomalyResult {
  log: RawLog;
  anomaly_score: number;
  is_anomalous: boolean;
  confidence?: number;
  civic_context?: string;
}
