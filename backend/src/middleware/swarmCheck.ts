import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";
import { getRedis } from "../config/redis";
import { prisma } from "../db/client";
import { Domain, IncidentStatus, Severity } from "@prisma/client";

const REDIS_BLOCKED_SET = "kavach:blocked_ips";
const REDIS_META_PREFIX = "kavach:block_meta:";

export interface SwarmBlockResult {
  status: "pre_blocked";
  reason: "swarm_vaccination";
  source_incident: string;
  blocked_ip: string;
  civic_origin: string;
}

/**
 * Extracts the most likely source IP from the incoming log batch.
 * Checks the first log entry's source_ip field, falling back to the
 * request IP.
 */
function extractSourceIp(req: Request): string | null {
  const body = req.body as { logs?: Array<{ source_ip?: string }> };

  if (Array.isArray(body.logs) && body.logs.length > 0 && body.logs[0].source_ip) {
    return body.logs[0].source_ip;
  }

  return req.ip ?? null;
}

/**
 * Express middleware that checks if the source IP of an incoming log
 * batch is already in the KAVACH swarm blocklist (Redis SET).
 *
 * If blocked → returns immediately with a pre_blocked response and
 * logs a lightweight "Swarm Block" incident in the DB (no ML needed).
 *
 * If not blocked or Redis is unavailable → passes through to the next handler.
 */
export async function swarmCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  const redis = getRedis();

  // If Redis is unavailable, let the request through — defense in depth,
  // the rest of the pipeline still works.
  if (!redis) {
    next();
    return;
  }

  const sourceIp = extractSourceIp(req);
  if (!sourceIp) {
    next();
    return;
  }

  try {
    const isBlocked = await redis.sismember(REDIS_BLOCKED_SET, sourceIp);

    if (!isBlocked) {
      next();
      return;
    }

    // Fetch block metadata
    const metaKey = `${REDIS_META_PREFIX}${sourceIp}`;
    const meta = await redis.hgetall(metaKey);
    const findingId = meta.finding_id ?? "unknown";
    const civicOrigin = meta.service_origin ?? "unknown";

    // Log lightweight "Swarm Block" incident — no ML, no Commander needed
    try {
      await prisma.incident.create({
        data: {
          executionId: `swarm-block-${Date.now()}`,
          findingId,
          domain: Domain.NETWORK,
          severity: Severity.HIGH,
          status: IncidentStatus.CONTAINED,
          classification: "swarm_pre_block",
          confidence: 1.0,
          offenderType: "ip",
          offenderValue: sourceIp,
          affectedService: civicOrigin,
          evidenceJson: [
            `IP ${sourceIp} pre-blocked by swarm vaccination`,
            `Original finding: ${findingId}`,
            `Civic origin: ${civicOrigin}`,
          ],
          recommendedActionsJson: ["no_action_needed_pre_blocked"],
          rawFindingJson: {
            type: "swarm_pre_block",
            source_incident: findingId,
            civic_origin: civicOrigin,
            blocked_ip: sourceIp,
            intercepted_at: new Date().toISOString(),
          },
          detectedAt: new Date(),
          civicMultiplier: 1.0,
          isCalendarElevated: false,
          priorityScore: 1.0,
          intelEnriched: false,
          threatLevel: null,
        },
      });
    } catch (dbErr) {
      // DB write failure should not prevent the block response
      logger.warn("Swarm check: failed to log pre-block incident to DB", {
        ip: sourceIp,
        error: dbErr instanceof Error ? dbErr.message : "Unknown error",
      });
    }

    logger.info("Swarm Block: pre-blocked IP intercepted before pipeline", {
      incident_type: "swarm_pre_block",
      ip: sourceIp,
      source_incident: findingId,
      civic_origin: civicOrigin,
    });

    const blockResult: SwarmBlockResult = {
      status: "pre_blocked",
      reason: "swarm_vaccination",
      source_incident: findingId,
      blocked_ip: sourceIp,
      civic_origin: civicOrigin,
    };

    res.status(403).json(blockResult);
  } catch (err) {
    // Redis lookup failure should never break the main pipeline
    logger.warn("Swarm check: Redis lookup failed — allowing request through", {
      ip: sourceIp,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    next();
  }
}
