import type { Prisma } from "@prisma/client";
import { logger } from "../config/logger";
import { prisma } from "../db/client";

type CloudflareBlockIPInput = {
  ip: string;
  note: string;
  ttl_hours: number;
};

type CloudflareBlockBatchEntry = {
  ip: string;
  note: string;
  ttl_hours: number;
};

type CloudflareBlockCIDRBatchEntry = {
  cidr: string;
  note: string;
  ttl_hours: number;
};

type CloudflareWAFRuleInput = {
  name: string;
  match: string;
  action: "block" | "challenge" | "log_and_strip";
  priority: number;
};

type CloudflareActionModel = {
  create?: (args: unknown) => Promise<unknown>;
};

type CloudflareActionResult = {
  success: true;
  mock_id: string;
};

function mockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function logCloudflareAction(payload: Prisma.InputJsonValue): Promise<void> {
  const cloudflareActionModel = (prisma as unknown as { cloudflareAction?: CloudflareActionModel }).cloudflareAction;

  if (cloudflareActionModel?.create) {
    await cloudflareActionModel.create({
      data: { payload },
    });
    return;
  }

  logger.info("CLOUDFLARE ACTION TRACE (no Prisma model, logged only)", { payload });
}

export async function cloudflareBlockIP(entry: CloudflareBlockIPInput): Promise<CloudflareActionResult> {
  const mock_id = mockId("cf-ip");

  logger.info("Cloudflare stub: block single IP", {
    provider: "cloudflare",
    ...entry,
    mock_id,
  });

  await logCloudflareAction({
    type: "block_ip",
    mock_id,
    entry,
  } as Prisma.InputJsonValue);

  return { success: true, mock_id };
}

export async function cloudflareBlockBatch(entries: CloudflareBlockBatchEntry[]): Promise<CloudflareActionResult> {
  const mock_id = mockId("cf-batch");

  logger.info("Cloudflare stub: block IP batch", {
    provider: "cloudflare",
    count: entries.length,
    entries,
    mock_id,
  });

  await logCloudflareAction({
    type: "block_batch",
    mock_id,
    count: entries.length,
    entries,
  } as Prisma.InputJsonValue);

  return { success: true, mock_id };
}

export async function cloudflareBlockCIDRBatch(
  entries: CloudflareBlockCIDRBatchEntry[],
): Promise<CloudflareActionResult> {
  const mock_id = mockId("cf-cidr");

  logger.info("Cloudflare stub: block CIDR batch", {
    provider: "cloudflare",
    count: entries.length,
    entries,
    mock_id,
  });

  await logCloudflareAction({
    type: "block_cidr_batch",
    mock_id,
    count: entries.length,
    entries,
  } as Prisma.InputJsonValue);

  return { success: true, mock_id };
}

export async function cloudflareAddWAFRule(rule: CloudflareWAFRuleInput): Promise<CloudflareActionResult> {
  const mock_id = mockId("cf-waf");

  logger.info("Cloudflare stub: add WAF rule", {
    provider: "cloudflare",
    rule_name: rule.name,
    match: rule.match,
    action: rule.action,
    priority: rule.priority,
    mock_id,
  });

  await logCloudflareAction({
    type: "waf_rule",
    mock_id,
    rule,
  } as Prisma.InputJsonValue);

  return { success: true, mock_id };
}

export async function cloudflareSetDDoSMode(
  service: string,
  mode: "under_attack" | "normal",
): Promise<CloudflareActionResult> {
  const mock_id = mockId("cf-ddos");

  logger.info("Cloudflare stub: set DDoS mode", {
    provider: "cloudflare",
    service,
    mode,
    mock_id,
  });

  await logCloudflareAction({
    type: "ddos_mode",
    mock_id,
    service,
    mode,
  } as Prisma.InputJsonValue);

  return { success: true, mock_id };
}

export async function cloudflareEnableRuleset(
  service: string,
  ruleset: string,
): Promise<CloudflareActionResult> {
  const mock_id = mockId("cf-ruleset");

  logger.info("Cloudflare stub: enable ruleset", {
    provider: "cloudflare",
    service,
    ruleset,
    mock_id,
  });

  await logCloudflareAction({
    type: "ruleset_enable",
    mock_id,
    service,
    ruleset,
  } as Prisma.InputJsonValue);

  return { success: true, mock_id };
}
