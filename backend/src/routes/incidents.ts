import { Domain, IncidentStatus, Severity } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db/client";
import { AppError } from "../middleware/errorHandler";
import { getMunicipalPortalRecoveryMetrics } from "../agents/remediationAgents/networkAgent";

const router = Router();

function parseSeverity(value: string | undefined): Severity | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  if (upper === "CRITICAL" || upper === "HIGH" || upper === "MEDIUM" || upper === "LOW") {
    return upper as Severity;
  }

  return undefined;
}

function parseDomain(value: string | undefined): Domain | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  if (upper === "IDENTITY" || upper === "NETWORK" || upper === "INFRASTRUCTURE") {
    return upper as Domain;
  }

  return undefined;
}

function parseStatus(value: string | undefined): IncidentStatus | undefined {
  if (!value) {
    return undefined;
  }

  const upper = value.toUpperCase();
  if (upper === "OPEN" || upper === "REMEDIATING" || upper === "CONTAINED" || upper === "RESOLVED" || upper === "ARCHIVED") {
    return upper as IncidentStatus;
  }

  return undefined;
}

router.get("/stats", async (_req, res, next) => {
  try {
    const [totalIncidents, criticalCount, containedToday, incidents] = await Promise.all([
      prisma.incident.count({ where: { status: { not: IncidentStatus.ARCHIVED } } }),
      prisma.incident.count({
        where: {
          severity: Severity.CRITICAL,
          status: { not: IncidentStatus.ARCHIVED },
        },
      }),
      prisma.incident.count({
        where: {
          status: IncidentStatus.CONTAINED,
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.incident.findMany({
        where: {
          status: { not: IncidentStatus.ARCHIVED },
        },
        select: {
          domain: true,
          severity: true,
          status: true,
          detectedAt: true,
          resolvedAt: true,
        },
      }),
    ]);

    let totalResponseMinutes = 0;
    let resolvedCount = 0;

    const bySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byDomain: Record<string, number> = { IDENTITY: 0, NETWORK: 0, INFRASTRUCTURE: 0 };
    const byStatus: Record<string, number> = { OPEN: 0, REMEDIATING: 0, CONTAINED: 0, RESOLVED: 0, ARCHIVED: 0 };

    for (const incident of incidents) {
      bySeverity[incident.severity] += 1;
      byDomain[incident.domain] += 1;
      byStatus[incident.status] += 1;

      if (incident.resolvedAt) {
        const durationMs = incident.resolvedAt.getTime() - incident.detectedAt.getTime();
        totalResponseMinutes += durationMs / (1000 * 60);
        resolvedCount += 1;
      }
    }

    res.json({
      totalIncidents,
      criticalCount,
      containedToday,
      avgResponseTimeMinutes: resolvedCount > 0 ? Number((totalResponseMinutes / resolvedCount).toFixed(2)) : 0,
      bySeverity,
      byDomain,
      byStatus,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/timeline", async (_req, res, next) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const incidents = await prisma.incident.findMany({
      where: {
        detectedAt: {
          gte: dayAgo,
        },
        status: { not: IncidentStatus.ARCHIVED },
      },
      select: {
        detectedAt: true,
        severity: true,
      },
    });

    const buckets = new Map<string, { hour: string; count: number; critical: number; high: number }>();

    for (let i = 23; i >= 0; i -= 1) {
      const bucketDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(bucketDate);
      buckets.set(hour, { hour, count: 0, critical: 0, high: 0 });
    }

    for (const incident of incidents) {
      const hour = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(incident.detectedAt);

      const entry = buckets.get(hour);
      if (!entry) {
        continue;
      }

      entry.count += 1;
      if (incident.severity === Severity.CRITICAL) {
        entry.critical += 1;
      }
      if (incident.severity === Severity.HIGH) {
        entry.high += 1;
      }
    }

    res.json(Array.from(buckets.values()));
  } catch (error) {
    next(error);
  }
});

router.get("/portal-metrics/:service", (req, res) => {
  if (req.params.service === "municipal-portal") {
    res.json(getMunicipalPortalRecoveryMetrics());
    return;
  }

  res.json({
    service: req.params.service,
    status_before: "ONLINE",
    status_after: "ONLINE",
    req_per_min_before: 12,
    req_per_min_after: 12,
    ips_blocked: 0,
    updatedAt: new Date().toISOString(),
  });
});

router.get("/", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? "1");
    const limit = Number(req.query.limit ?? "20");
    const severity = parseSeverity(typeof req.query.severity === "string" ? req.query.severity : undefined);
    const domain = parseDomain(typeof req.query.domain === "string" ? req.query.domain : undefined);
    const status = parseStatus(typeof req.query.status === "string" ? req.query.status : undefined);

    const where = {
      severity,
      domain,
      status,
    };

    const [total, incidents] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      data: incidents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: {
        remediations: {
          orderBy: { executedAt: "asc" },
        },
        alerts: {
          orderBy: { sentAt: "asc" },
        },
      },
    });

    if (!incident) {
      throw new AppError("Incident not found", 404);
    }

    res.json(incident);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const nextStatus = parseStatus(req.body.status as string | undefined);
    if (!nextStatus || nextStatus === IncidentStatus.ARCHIVED) {
      throw new AppError("Invalid status", 400);
    }

    const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new AppError("Incident not found", 404);
    }

    const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
      OPEN: [IncidentStatus.REMEDIATING, IncidentStatus.CONTAINED],
      REMEDIATING: [IncidentStatus.CONTAINED],
      CONTAINED: [IncidentStatus.RESOLVED],
      RESOLVED: [],
      ARCHIVED: [],
    };

    if (!validTransitions[existing.status].includes(nextStatus)) {
      throw new AppError(`Invalid transition from ${existing.status} to ${nextStatus}`, 400);
    }

    const updated = await prisma.incident.update({
      where: { id: req.params.id },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === IncidentStatus.RESOLVED ? new Date() : undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const updated = await prisma.incident.update({
      where: { id: req.params.id },
      data: { status: IncidentStatus.ARCHIVED },
    });

    res.json({ success: true, incident: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
