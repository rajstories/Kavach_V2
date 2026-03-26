import { CopilotLanguage, Prisma, Severity } from "@prisma/client";
import { Router } from "express";
import { anthropic, ANTHROPIC_MODEL } from "../config/anthropic";
import { logger } from "../config/logger";
import { prisma } from "../db/client";
import { AppError } from "../middleware/errorHandler";
import type { CopilotMessage, DailBriefing } from "../types";

const router = Router();

const COPILOT_SYSTEM_PROMPT = `
You are KAVACH's CISO Co-Pilot — a multilingual security advisor 
for India's government cybersecurity officers.

You help government CISOs understand security incidents in plain language.
You MUST respond in the same language as the user's message.
If the user writes in Hindi/Devanagari, respond in Hindi.
If in English, respond in English.

You have access to current incident data provided in the user's context.

Your responses must be:
- Clear and non-technical when possible
- Action-oriented (always end with what to do next)
- Concise (max 150 words)
- Supportive and calm (CISOs are under pressure)

For Hindi responses use formal Hindi (आप form), not casual.
Always reference specific incident IDs when discussing cases.
`;

function normalizeLanguage(language: string | undefined, message: string): CopilotLanguage {
  if (language?.toLowerCase() === "hindi") {
    return CopilotLanguage.HINDI;
  }

  if (language?.toLowerCase() === "english") {
    return CopilotLanguage.ENGLISH;
  }

  const hasDevanagari = /[\u0900-\u097F]/.test(message);
  return hasDevanagari ? CopilotLanguage.HINDI : CopilotLanguage.ENGLISH;
}

async function getIncidentContext(): Promise<string> {
  const incidents = await prisma.incident.findMany({
    where: {
      severity: { in: [Severity.CRITICAL, Severity.HIGH] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      severity: true,
      domain: true,
      classification: true,
      status: true,
      affectedService: true,
      createdAt: true,
    },
  });

  return JSON.stringify(incidents);
}

router.post("/message", async (req, res, next) => {
  try {
    const { message, language, sessionId } = req.body as {
      message?: string;
      language?: "hindi" | "english";
      sessionId?: string;
    };

    if (!message || !sessionId) {
      throw new AppError("message and sessionId are required", 400);
    }

    const normalizedLanguage = normalizeLanguage(language, message);
    const context = await getIncidentContext();

    let assistantReply = "";

    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        system: COPILOT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Current incidents context: ${context}\n\nUser message: ${message}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      assistantReply = textBlock?.type === "text" ? textBlock.text : "I could not generate a response.";
    } catch (error) {
      logger.warn("Copilot API call failed, using fallback", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      assistantReply =
        normalizedLanguage === CopilotLanguage.HINDI
          ? "मैं अभी सीमित मोड में हूँ। कृपया पहले CRITICAL घटनाओं को contain करें, फिर access logs की समीक्षा करें। अगला कदम: Incident IDs की सूची लेकर response bridge call चलाएँ।"
          : "I am currently in limited mode. Please contain CRITICAL incidents first, then review access logs. Next step: prepare Incident IDs and run the response bridge call.";
    }

    const existing = await prisma.copilotSession.findUnique({ where: { id: sessionId } });
    const existingMessages = (existing?.messagesJson as CopilotMessage[] | undefined) ?? [];
    const updatedMessages: CopilotMessage[] = [
      ...existingMessages,
      { role: "user", message, timestamp: new Date().toISOString() },
      { role: "assistant", message: assistantReply, timestamp: new Date().toISOString() },
    ];

    const session = await prisma.copilotSession.upsert({
      where: { id: sessionId },
      update: {
        language: normalizedLanguage,
        messagesJson: updatedMessages as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: sessionId,
        userId: "ciso-demo",
        language: normalizedLanguage,
        messagesJson: updatedMessages as unknown as Prisma.InputJsonValue,
      },
    });

    res.json({
      sessionId: session.id,
      language: session.language,
      reply: assistantReply,
      messages: updatedMessages,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions/:id", async (req, res, next) => {
  try {
    const session = await prisma.copilotSession.findUnique({ where: { id: req.params.id } });
    if (!session) {
      throw new AppError("Session not found", 404);
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.get("/briefing", async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const incidents = await prisma.incident.findMany({
      where: {
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        severity: true,
        classification: true,
        status: true,
      },
    });

    const total = incidents.length;
    const critical = incidents.filter((item) => item.severity === Severity.CRITICAL).length;
    const high = incidents.filter((item) => item.severity === Severity.HIGH).length;
    const topThreat = incidents[0]?.classification ?? "no-major-threat";

    const briefing: DailBriefing = {
      hindi: `पिछले 24 घंटों में कुल ${total} घटनाएँ दर्ज हुईं। इनमें ${critical} अत्यंत गंभीर और ${high} गंभीर घटनाएँ थीं। सबसे प्रमुख खतरा ${topThreat} रहा। सुझाया अगला कदम: सभी खुले Incident IDs को 2 घंटे के भीतर containment status में लाएँ।`,
      english: `In the last 24 hours, ${total} incidents were recorded. ${critical} were CRITICAL and ${high} were HIGH. Top threat class was ${topThreat}. Next step: move all OPEN incident IDs to CONTAINED within the next 2 hours.`,
      generatedAt: new Date().toISOString(),
    };

    res.json(briefing);
  } catch (error) {
    next(error);
  }
});

export default router;
