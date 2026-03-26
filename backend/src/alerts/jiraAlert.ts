import { logger } from "../config/logger";
import { prisma } from "../db/client";

type JiraTicketInput = {
  incidentId: string;
  summary: string;
  description: string;
  priority: "P0" | "P1" | "P2";
};

export async function createJiraTicket(input: JiraTicketInput): Promise<{ key: string }> {
  const key = `KAVACH-${Date.now().toString().slice(-6)}`;

  logger.info("Jira ticket creation (stub)", {
    key,
    ...input,
  });
  await prisma.alertLog.create({
    data: {
      incidentId: input.incidentId,
      channel: "JIRA",
      status: "SENT",
      messagePreview: `[${input.priority}] ${input.summary}`.slice(0, 255),
    },
  });

  await prisma.infraOperation.create({
    data: {
      operation: "jira_ticket_create",
      target: key,
      detailsJson: {
        incidentId: input.incidentId,
        summary: input.summary,
        description: input.description,
        priority: input.priority,
      },
    },
  });

  return { key };
}
