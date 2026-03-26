import type { LogEntry as BaseLogEntry } from "../types";

export interface LogEntry extends BaseLogEntry {
  req_per_min?: number;
}

export type FilterResult = "DISCARD" | "PASS_TO_ML" | "ESCALATE_CRITICAL";

export const GOVT_WHITELIST_CIDRS = [
  "164.100.0.0/16", // NIC
  "117.242.0.0/16", // MeitY
  "14.139.0.0/16", // ERNET/NKN
  "10.0.0.0/8", // Internal
  "172.16.0.0/12", // MeghRaj private
] as const;

export const SAFE_STATIC_PATTERNS: RegExp[] = [
  /\.(css|js|png|jpg|jpeg|gif|ico|woff|pdf)(\?.*)?$/i,
  /^\/health(?:\/|\?|$)/i,
  /^\/favicon(?:\.ico)?(?:\?|$)/i,
  /^\/static\//i,
];

export const HARD_BLOCK_SIGNATURES: RegExp[] = [
  /\bunion\s+select\b/i,
  /\bselect\s+.+\s+from\b/i,
  /\bdrop\s+table\b/i,
  /%27|\'|--|%23|#/i,
  /\.\.\/|\.\.\\/i,
  /<script\b/i,
];

type FilterStats = {
  total: number;
  discarded: number;
  passToML: number;
  critical: number;
};

const stats: FilterStats = {
  total: 0,
  discarded: 0,
  passToML: 0,
  critical: 0,
};

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function cidrContains(ip: string, cidr: string): boolean {
  const [base, maskBitsRaw] = cidr.split("/");
  const maskBits = Number.parseInt(maskBitsRaw, 10);
  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(base);

  if (ipInt === null || baseInt === null || Number.isNaN(maskBits)) {
    return false;
  }

  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isWhitelistedIp(ip: string): boolean {
  return GOVT_WHITELIST_CIDRS.some((cidr) => cidrContains(ip, cidr));
}

function isSafeStaticEndpoint(endpoint: string): boolean {
  return SAFE_STATIC_PATTERNS.some((pattern) => pattern.test(endpoint));
}

function hasHardBlockSignature(log: LogEntry): boolean {
  const haystack = `${log.endpoint} ${log.user_agent ?? ""}`;
  return HARD_BLOCK_SIGNATURES.some((pattern) => pattern.test(haystack));
}

function requestsPerMinute(log: LogEntry): number {
  if (typeof log.req_per_min === "number" && Number.isFinite(log.req_per_min)) {
    return log.req_per_min;
  }

  return Number.POSITIVE_INFINITY;
}

export function ruleFilter(log: LogEntry): FilterResult {
  if (hasHardBlockSignature(log)) {
    return "ESCALATE_CRITICAL";
  }

  if (isWhitelistedIp(log.source_ip)) {
    return "DISCARD";
  }

  if (isSafeStaticEndpoint(log.endpoint)) {
    return "DISCARD";
  }

  const rpm = requestsPerMinute(log);

  if (log.method.toUpperCase() === "GET" && log.status_code === 200 && rpm < 10) {
    return "DISCARD";
  }

  if (log.method.toUpperCase() === "POST" && log.status_code === 200 && rpm < 3) {
    return "DISCARD";
  }

  return "PASS_TO_ML";
}

export function filterBatch(logs: LogEntry[]): {
  discarded: LogEntry[];
  passToML: LogEntry[];
  critical: LogEntry[];
} {
  const discarded: LogEntry[] = [];
  const passToML: LogEntry[] = [];
  const critical: LogEntry[] = [];

  for (const log of logs) {
    const decision = ruleFilter(log);
    stats.total += 1;

    if (decision === "DISCARD") {
      stats.discarded += 1;
      discarded.push(log);
      continue;
    }

    if (decision === "ESCALATE_CRITICAL") {
      stats.critical += 1;
      critical.push(log);
      continue;
    }

    stats.passToML += 1;
    passToML.push(log);
  }

  return { discarded, passToML, critical };
}

export function filterStats(): {
  total: number;
  discarded: number;
  passToML: number;
  critical: number;
  percentFiltered: number;
} {
  return {
    ...stats,
    percentFiltered: stats.total === 0 ? 0 : Number(((stats.discarded / stats.total) * 100).toFixed(2)),
  };
}

export function costImpact(totalLogs: number): {
  withoutFilter: { mlCalls: number; estimatedCost: string };
  withFilter: { mlCalls: number; estimatedCost: string };
  savings: string;
  percentFiltered: number;
} {
  const filtered = Math.round(totalLogs * 0.7);
  const mlWithout = totalLogs;
  const mlWith = Math.max(totalLogs - filtered, 0);

  const COST_PER_ML_CALL_INR = 0.13;
  const withoutCost = mlWithout * COST_PER_ML_CALL_INR;
  const withCost = mlWith * COST_PER_ML_CALL_INR;
  const savings = Math.max(withoutCost - withCost, 0);

  return {
    withoutFilter: {
      mlCalls: mlWithout,
      estimatedCost: `₹${withoutCost.toFixed(2)}`,
    },
    withFilter: {
      mlCalls: mlWith,
      estimatedCost: `₹${withCost.toFixed(2)}`,
    },
    savings: `₹${savings.toFixed(2)}`,
    percentFiltered: totalLogs === 0 ? 0 : Number(((filtered / totalLogs) * 100).toFixed(2)),
  };
}
