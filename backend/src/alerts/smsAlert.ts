import { logger } from "../config/logger";
import { prisma } from "../db/client";

type SendSMSOncallInput = {
  message: string;
  finding_id: string;
};
export async function sendSMSOncall(input: SendSMSOncallInput): Promise<void> {
  const incident = await prisma.incident.findFirst({
    where: {
      rawFindingJson: {
        path: ["finding_id"],
        equals: input.finding_id,
      },
    },
    orderBy: { detectedAt: "desc" },
  });

  logger.info("SMS alert to NIC on-call (stub)", {
    finding_id: input.finding_id,
    sms: input.message,
    provider: "stub",
    note: "Production: replace with Twilio/MSG91 India SMS API",
  });

  if (!incident) {
    logger.warn("Could not resolve incident for SMS alert", {
      finding_id: input.finding_id,
    });
    return;
  }

  await prisma.alertLog.create({
    data: {
      incidentId: incident.id,
      channel: "SMS",
      status: "SENT",
      messagePreview: input.message.slice(0, 160),
    },
  });
}
