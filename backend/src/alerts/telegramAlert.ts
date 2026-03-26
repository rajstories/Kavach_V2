import TelegramBot from "node-telegram-bot-api";
import { logger } from "../config/logger";
import { prisma } from "../db/client";
import type { PrioritizedIncident, RemediationResult } from "../types";

/**
 * TELEGRAM ALERT SERVICE
 * Sends formatted incident alerts to government CISO Telegram channel.
 * Uses HTML formatting for rich messages.
 * Includes incident severity emoji, affected service,
 * actions taken, and timestamp in IST.
 */
const severityEmoji: Record<string, string> = {
  critical: "🚨",
  high: "⚠️",
  medium: "🔶",
  low: "ℹ️",
};

const severityHindiLabel: Record<string, string> = {
  critical: "अत्यंत गंभीर",
  high: "गंभीर",
  medium: "मध्यम",
  low: "सामान्य",
};

function formatIstTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
  }).format(date);
}

export async function sendTelegramAlert(
  incident: PrioritizedIncident,
  remediation: RemediationResult,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const timestamp = formatIstTimestamp(new Date());

  const message = `
<b>${severityEmoji[incident.severity]} KAVACH INCIDENT ALERT</b>

<b>Severity:</b> ${incident.severity.toUpperCase()} (${severityHindiLabel[incident.severity]})
<b>Domain:</b> ${incident.domain.toUpperCase()}
<b>Classification:</b> ${incident.classification}
<b>Incident ID:</b> ${incident.incidentId}
<b>Offender:</b> ${incident.offender.type}:${incident.offender.value}
<b>Affected Service:</b> ${incident.affectedService}
<b>Actions Taken:</b> ${remediation.actionsTaken.join(", ")}
<b>Confidence:</b> ${incident.confidence.toFixed(2)}
<b>Timestamp (IST):</b> ${timestamp}
`.trim();

  if (!botToken || !chatId) {
    logger.warn("Telegram credentials missing; alert not sent");
    await prisma.alertLog.create({
      data: {
        incidentId: incident.incidentId,
        channel: "TELEGRAM",
        status: "FAILED",
        messagePreview: message.slice(0, 150),
      },
    });
    return;
  }

  try {
    const bot = new TelegramBot(botToken, { polling: false });
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });

    await prisma.alertLog.create({
      data: {
        incidentId: incident.incidentId,
        channel: "TELEGRAM",
        status: "SENT",
        messagePreview: message.slice(0, 150),
      },
    });

    logger.info("Telegram alert sent", { incidentId: incident.incidentId });
  } catch (error) {
    logger.error("Telegram alert failed", {
      incidentId: incident.incidentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await prisma.alertLog.create({
      data: {
        incidentId: incident.incidentId,
        channel: "TELEGRAM",
        status: "FAILED",
        messagePreview: message.slice(0, 150),
      },
    });
  }
}
