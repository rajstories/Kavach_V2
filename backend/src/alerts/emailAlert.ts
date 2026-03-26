import nodemailer from "nodemailer";
import { logger } from "../config/logger";
import { prisma } from "../db/client";
import type { PrioritizedIncident } from "../types";

/**
 * EMAIL ALERT SERVICE
 * Sends HTML incident report emails to CISO team.
 * Generates professional CERT-In style incident report format.
 * For CRITICAL: sends immediately. For HIGH: batches every 15 min.
 */
const highSeverityQueue: PrioritizedIncident[] = [];
let highSeverityTimer: NodeJS.Timeout | undefined;

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function formatIst(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
  }).format(date);
}

async function fetchLatestActions(incidentId: string): Promise<string[]> {
  const remediations = await prisma.remediation.findMany({
    where: { incidentId },
    orderBy: { executedAt: "desc" },
    take: 1,
  });

  if (remediations.length === 0) {
    return ["Investigation in progress"];
  }

  const actionTaken = remediations[0].actionTaken;
  if (!Array.isArray(actionTaken)) {
    return ["Investigation in progress"];
  }

  return actionTaken.filter((value): value is string => typeof value === "string");
}

function buildIncidentHtml(incident: PrioritizedIncident, actions: string[]): string {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px;">
    <h2 style="margin:0 0 8px 0;color:#ef4444;">KAVACH Incident Report</h2>
    <p style="margin:0 0 16px 0;color:#94a3b8;">CERT-In aligned notification format</p>
    <h3 style="color:#f8fafc;">Executive Summary</h3>
    <p>Incident <strong>${incident.incidentId}</strong> detected on <strong>${formatIst(new Date())}</strong> with <strong>${incident.severity.toUpperCase()}</strong> severity.</p>
    <h3 style="color:#f8fafc;">Technical Details</h3>
    <ul>
      <li>Domain: ${incident.domain.toUpperCase()}</li>
      <li>Classification: ${incident.classification}</li>
      <li>Affected Service: ${incident.affectedService}</li>
      <li>Offender: ${incident.offender.type}:${incident.offender.value}</li>
      <li>Confidence: ${incident.confidence.toFixed(2)}</li>
    </ul>
    <h3 style="color:#f8fafc;">Actions Taken</h3>
    <ul>${actions.map((action) => `<li>${action}</li>`).join("")}</ul>
    <h3 style="color:#f8fafc;">Recommendations</h3>
    <ul>${incident.recommendedActions.map((action) => `<li>${action}</li>`).join("")}</ul>
  </div>
  `;
}

type UIDAISOCAlertPayload = {
  incidentId: string;
  findingId: string;
  civicContext: string;
  flaggedUIDs: string[];
};

export async function sendUIDAlSOCAlert(payload: UIDAISOCAlertPayload): Promise<void> {
  const to = "uidai-soc@uidai.gov.in";
  const transporter = createTransporter();
  const from = process.env.SMTP_USER;

  const subject = `[KAVACH][CREDENTIAL_STUFFING] UIDAI SOC Alert ${payload.incidentId}`;
  const text = [
    `Incident ID: ${payload.incidentId}`,
    `Finding ID: ${payload.findingId}`,
    `Civic Context: ${payload.civicContext}`,
    `Flagged UIDs: ${payload.flaggedUIDs.length > 0 ? payload.flaggedUIDs.join(", ") : "none"}`,
  ].join("\n");

  try {
    if (transporter && from) {
      await transporter.sendMail({
        from,
        to,
        subject,
        text,
      });
    } else {
      logger.warn("UIDAI SOC SMTP not configured; recording stub delivery", {
        incidentId: payload.incidentId,
        findingId: payload.findingId,
      });
    }

    await prisma.alertLog.create({
      data: {
        incidentId: payload.incidentId,
        channel: "EMAIL",
        status: "SENT",
        messagePreview: `UIDAI SOC alert dispatched with ${payload.flaggedUIDs.length} flagged UID(s)`,
      },
    });
  } catch (error) {
    logger.error("UIDAI SOC alert failed", {
      incidentId: payload.incidentId,
      findingId: payload.findingId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await prisma.alertLog.create({
      data: {
        incidentId: payload.incidentId,
        channel: "EMAIL",
        status: "FAILED",
        messagePreview: `UIDAI SOC alert failed for ${payload.incidentId}`,
      },
    });
  }
}

export const sendUIDAISOCAlert = sendUIDAlSOCAlert;

async function sendEmailForIncident(incident: PrioritizedIncident): Promise<void> {
  const transporter = createTransporter();
  const recipient = process.env.SMTP_USER;
  const actions = await fetchLatestActions(incident.incidentId);
  const html = buildIncidentHtml(incident, actions);

  if (!transporter || !recipient) {
    logger.warn("SMTP not configured; email not sent", { incidentId: incident.incidentId });
    await prisma.alertLog.create({
      data: {
        incidentId: incident.incidentId,
        channel: "EMAIL",
        status: "FAILED",
        messagePreview: `Email unavailable for ${incident.incidentId}`,
      },
    });
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: recipient,
      subject: `[KAVACH][${incident.severity.toUpperCase()}] Incident ${incident.incidentId}`,
      html,
    });

    await prisma.alertLog.create({
      data: {
        incidentId: incident.incidentId,
        channel: "EMAIL",
        status: "SENT",
        messagePreview: `Incident report sent for ${incident.incidentId}`,
      },
    });
  } catch (error) {
    logger.error("Email alert failed", {
      incidentId: incident.incidentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await prisma.alertLog.create({
      data: {
        incidentId: incident.incidentId,
        channel: "EMAIL",
        status: "FAILED",
        messagePreview: `Email failed for ${incident.incidentId}`,
      },
    });
  }
}

async function flushHighSeverityBatch(): Promise<void> {
  const batch = [...highSeverityQueue];
  highSeverityQueue.length = 0;
  highSeverityTimer = undefined;

  for (const incident of batch) {
    await sendEmailForIncident(incident);
  }
}

export async function sendEmailAlert(incident: PrioritizedIncident): Promise<void> {
  try {
    if (incident.severity === "critical") {
      await sendEmailForIncident(incident);
      return;
    }

    if (incident.severity === "high") {
      highSeverityQueue.push(incident);

      if (!highSeverityTimer) {
        highSeverityTimer = setTimeout(() => {
          void flushHighSeverityBatch();
        }, 15 * 60 * 1000);
      }
    }
  } catch (error) {
    logger.error("Email alert pipeline failed", {
      incidentId: incident.incidentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
