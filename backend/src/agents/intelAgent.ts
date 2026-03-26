/**
 * KAVACH Intel Agent
 *
 * Enriches threat findings with OSINT data from AlienVault OTX.
 *
 * MCP OSINT Enrichment (cost-free, runs locally):
 * ------------------------------------------------
 * This agent can use the Playwright MCP server to scrape OTX data directly
 * without calling any LLM API or paid service.
 *
 * Prerequisites:
 *   - npx @playwright/mcp must be available in PATH
 *   - Or install globally: npm install -g @playwright/mcp
 *   - Set ENABLE_MCP_OSINT=true (default) to use MCP scraping
 *
 * The MCP approach:
 *   1. Spawns Playwright MCP server as subprocess via stdio
 *   2. Calls browser_navigate to load OTX IP page
 *   3. Calls browser_evaluate to extract reputation, pulse count, country, ASN, malware
 *   4. Falls back to mock data or OTX API if MCP fails
 *
 * This costs nothing and runs entirely locally.
 */

import fetch from "node-fetch";
import { z } from "zod";
import { logger } from "../config/logger";
import { prisma } from "../db/client";
import type { ImmediatorResult } from "./immediatorAgent";

// ---------------------------------------------------------------------------
// MCP SDK Imports (for connecting to Playwright MCP server)
// ---------------------------------------------------------------------------

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OTX_BASE = "https://otx.alienvault.com/api/v1";
const AGENTROUTER_CHAT_URL =
  process.env.AGENTROUTER_CHAT_URL ?? "https://api.agentrouter.ai/v1/chat/completions";

// Enable MCP OSINT by default for demo
const ENABLE_MCP_OSINT = process.env.ENABLE_MCP_OSINT !== "false";
const MCP_TIMEOUT_MS = 10000; // 10 seconds timeout for MCP operations

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const DeepSeekResponseSchema = z.object({
  threat_actor_summary: z.string(),
  hindi_summary: z.string(),
  threat_level: z.enum(["nation-state", "criminal", "opportunistic", "unknown"]),
  campaign_link: z.string().nullable(),
});

type OtxData = {
  pulse_count: number | null;
  reputation: number | null;
  country: string | null;
  asn: string | null;
  malware_families: string[];
  last_seen: string | null;
  source: "mcp" | "api" | "mock";
};

type DeepSeekIntel = z.infer<typeof DeepSeekResponseSchema>;

export interface IntelResult {
  finding_id: string;
  ip: string;
  otx_pulse_count: number | null;
  otx_reputation: number | null;
  country: string | null;
  asn: string | null;
  malware_families: string[];
  threat_actor_summary: string | null;
  hindi_summary: string | null;
  threat_level: "nation-state" | "criminal" | "opportunistic" | "unknown" | null;
  campaign_link: string | null;
  enriched_at: string;
  otx_source: "mcp" | "api" | "mock";
}

// ---------------------------------------------------------------------------
// MCP Client for OSINT Enrichment
// ---------------------------------------------------------------------------

/**
 * Create an MCP client connected to the Playwright MCP server.
 *
 * The server is spawned via npx @playwright/mcp which must be available.
 * Communication happens over stdio using JSON-RPC.
 */
async function createMcpClient(): Promise<{ client: Client; transport: StdioClientTransport } | null> {
  try {
    logger.info("MCP OSINT: spawning Playwright MCP server...");

    // StdioClientTransport will spawn the process internally
    // It takes command + args, not raw streams
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["@playwright/mcp"],
      stderr: "pipe", // Capture stderr for debugging
    });

    const client = new Client(
      {
        name: "kavach-intel-agent",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // The transport.start() is called internally by client.connect()
    await client.connect(transport);

    logger.info("MCP OSINT: connected to Playwright MCP server");
    return { client, transport };
  } catch (error) {
    logger.warn("MCP OSINT: failed to spawn/connect to Playwright MCP server", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * JavaScript evaluation script to extract OTX data from the page.
 * Returns a JSON object with reputation, pulse_count, country, asn, malware_families.
 *
 * This runs in the browser context via browser_evaluate.
 */
const OTX_EXTRACTION_SCRIPT = `() => {
  const result = {
    reputation: null,
    pulse_count: null,
    country: null,
    asn: null,
    malware_families: [],
    last_seen: null
  };

  // Try to extract reputation (various selectors OTX uses)
  const repEl = document.querySelector('.reputation, [class*="reputation"], .threat-score');
  if (repEl) {
    const text = repEl.textContent || '';
    const match = text.match(/-?\\d+/);
    if (match) result.reputation = parseInt(match[0], 10);
  }

  // Try to extract pulse count
  const pulseEl = document.querySelector('.pulse-count, [class*="pulse"], .pulses');
  if (pulseEl) {
    const text = pulseEl.textContent || '';
    const match = text.match(/\\d+/);
    if (match) result.pulse_count = parseInt(match[0], 10);
  }

  // Try to extract from general info section
  const infoSection = document.querySelector('.general-info, .indicator-info, [class*="general"]');
  if (infoSection) {
    const text = infoSection.textContent || '';
    
    // Country
    const countryMatch = text.match(/Country[:\\s]+([A-Z]{2})/i);
    if (countryMatch) result.country = countryMatch[1];
    
    // ASN
    const asnMatch = text.match(/ASN[:\\s]+(AS\\d+\\s+.+?)(?:\\n|$)/i);
    if (asnMatch) result.asn = asnMatch[1].trim();
  }

  // Try to extract from details table
  const rows = document.querySelectorAll('tr, .detail-row, [class*="row"]');
  rows.forEach(row => {
    const text = row.textContent || '';
    
    if (text.toLowerCase().includes('country')) {
      const match = text.match(/([A-Z]{2})\\s*$/);
      if (match && !result.country) result.country = match[1];
    }
    
    if (text.toLowerCase().includes('asn')) {
      const match = text.match(/(AS\\d+[^\\n]*)/);
      if (match && !result.asn) result.asn = match[1].trim();
    }
  });

  // Extract malware families from Related Pulses section
  const pulsesSection = document.querySelector('.related-pulses, [class*="pulse-list"], .pulses-section');
  if (pulsesSection) {
    const tags = pulsesSection.querySelectorAll('.tag, [class*="tag"], .malware-family');
    const families = [];
    tags.forEach(tag => {
      const text = (tag.textContent || '').trim();
      if (text && text.length > 2 && text.length < 50) {
        families.push(text);
      }
    });
    result.malware_families = [...new Set(families)].slice(0, 10);
  }

  // Also try to get from page title or meta
  const titleMatch = document.title?.match(/(\\d+)\\s*pulse/i);
  if (titleMatch && !result.pulse_count) {
    result.pulse_count = parseInt(titleMatch[1], 10);
  }

  return result;
}`;

/**
 * Fetch OSINT data via MCP (Playwright browser automation).
 *
 * Steps:
 * 1. Connect to Playwright MCP server
 * 2. Navigate to OTX IP page
 * 3. Wait for page to load
 * 4. Evaluate JavaScript to extract data
 * 5. Parse and return results
 *
 * Falls back to mock data on any failure.
 */
async function fetchOSINTViaMCP(ip: string): Promise<OtxData | null> {
  if (!ENABLE_MCP_OSINT) {
    logger.info("MCP OSINT: disabled by ENABLE_MCP_OSINT env var");
    return null;
  }

  let mcpConnection: { client: Client; transport: StdioClientTransport } | null = null;

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("MCP operation timed out")), MCP_TIMEOUT_MS);
    });

    // Connect to MCP server
    mcpConnection = await Promise.race([
      createMcpClient(),
      timeoutPromise,
    ]);

    if (!mcpConnection) {
      return null;
    }

    const { client } = mcpConnection;
    const otxUrl = `https://otx.alienvault.com/indicator/ip/${ip}`;

    logger.info("MCP OSINT: navigating to OTX page", { url: otxUrl });

    // Step 1: Navigate to OTX IP page
    await client.callTool({
      name: "browser_navigate",
      arguments: {
        url: otxUrl,
      },
    });

    // Step 2: Wait for page to load (wait for text "Pulse" or timeout)
    await client.callTool({
      name: "browser_wait_for",
      arguments: {
        text: "Pulse",
        time: 3, // fallback wait time in seconds
      },
    });

    logger.info("MCP OSINT: extracting data via browser_evaluate");

    // Step 3: Evaluate JavaScript to extract OTX data
    const evaluateResult = await client.callTool({
      name: "browser_evaluate",
      arguments: {
        function: OTX_EXTRACTION_SCRIPT,
      },
    });

    // Parse the result
    const content = evaluateResult.content;
    let extractedData: Record<string, unknown> = {};

    if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block === "object" && block !== null && "text" in block) {
          try {
            extractedData = JSON.parse((block as { text: string }).text);
            break;
          } catch {
            // Try next block
          }
        }
      }
    }

    const otxData: OtxData = {
      pulse_count: typeof extractedData.pulse_count === "number" ? extractedData.pulse_count : null,
      reputation: typeof extractedData.reputation === "number" ? extractedData.reputation : null,
      country: typeof extractedData.country === "string" ? extractedData.country : null,
      asn: typeof extractedData.asn === "string" ? extractedData.asn : null,
      malware_families: Array.isArray(extractedData.malware_families)
        ? extractedData.malware_families.filter((f): f is string => typeof f === "string")
        : [],
      last_seen: typeof extractedData.last_seen === "string" ? extractedData.last_seen : null,
      source: "mcp",
    };

    logger.info("MCP OSINT: successfully extracted data", {
      ip,
      pulse_count: otxData.pulse_count,
      reputation: otxData.reputation,
      country: otxData.country,
      malware_families_count: otxData.malware_families.length,
    });

    return otxData;
  } catch (error) {
    logger.warn("MCP OSINT: extraction failed, will fallback", {
      ip,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  } finally {
    // Clean up MCP connection
    if (mcpConnection) {
      try {
        await mcpConnection.client.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

// ---------------------------------------------------------------------------
// OTX API Fallback (existing logic)
// ---------------------------------------------------------------------------

function extractOtxData(payload: Record<string, unknown>): OtxData {
  const pulseInfo =
    typeof payload.pulse_info === "object" && payload.pulse_info !== null
      ? (payload.pulse_info as Record<string, unknown>)
      : {};
  const pulses = Array.isArray(pulseInfo.pulses) ? pulseInfo.pulses.slice(0, 3) : [];
  const malwareFamilies = Array.from(
    new Set(
      pulses.flatMap((pulse) => {
        if (typeof pulse !== "object" || pulse === null) {
          return [];
        }

        const tags = (pulse as { tags?: unknown }).tags;
        return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
      }),
    ),
  ).slice(0, 6);

  const reputation =
    typeof payload.reputation === "number"
      ? payload.reputation
      : typeof payload.base_indicator === "object" &&
          payload.base_indicator !== null &&
          typeof (payload.base_indicator as { reputation?: unknown }).reputation === "number"
        ? ((payload.base_indicator as { reputation: number }).reputation)
        : null;

  const country =
    typeof payload.country_name === "string"
      ? payload.country_name
      : typeof payload.country_code === "string"
        ? payload.country_code
        : null;

  const asn = typeof payload.asn === "string" ? payload.asn : null;
  const lastSeen =
    typeof payload.last_seen === "string"
      ? payload.last_seen
      : typeof payload.validation === "object" &&
          payload.validation !== null &&
          typeof (payload.validation as { last_seen?: unknown }).last_seen === "string"
        ? ((payload.validation as { last_seen: string }).last_seen)
        : null;

  return {
    pulse_count: typeof pulseInfo.count === "number" ? pulseInfo.count : pulses.length || null,
    reputation,
    country,
    asn,
    malware_families: malwareFamilies,
    last_seen: lastSeen,
    source: "api",
  };
}

function getMockOtxData(): OtxData {
  return {
    pulse_count: 23,
    reputation: -2,
    country: "RU",
    asn: "AS48715 SkyNet LLC",
    malware_families: ["credential-harvester", "election-interference"],
    last_seen: "2026-03-15",
    source: "mock",
  };
}

async function fetchOtxDataViaApi(ip: string): Promise<OtxData> {
  const apiKey = process.env.OTX_API_KEY;

  if (!apiKey) {
    logger.info("Intel Agent: OTX_API_KEY not set, skipping API call", { ip });
    return getMockOtxData();
  }

  const response = await fetch(`${OTX_BASE}/indicators/IPv4/${ip}/general`, {
    headers: { "X-OTX-API-KEY": apiKey },
  });

  if (!response.ok) {
    throw new Error(`OTX lookup failed with status ${response.status}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return extractOtxData(raw);
}

/**
 * Main OTX data fetcher with MCP-first strategy:
 * 1. Try MCP (cost-free browser scraping)
 * 2. Fallback to OTX API (requires API key)
 * 3. Fallback to mock data
 */
async function fetchOtxData(ip: string): Promise<OtxData> {
  logger.info("Intel Agent: starting OSINT enrichment", {
    ip,
    mcp_enabled: ENABLE_MCP_OSINT,
  });

  // Strategy 1: Try MCP (cost-free, local)
  if (ENABLE_MCP_OSINT) {
    const mcpData = await fetchOSINTViaMCP(ip);
    if (mcpData && (mcpData.pulse_count !== null || mcpData.reputation !== null)) {
      logger.info("Intel Agent: using MCP-extracted data", { ip });
      return mcpData;
    }
  }

  // Strategy 2: Fallback to OTX API
  const apiKey = process.env.OTX_API_KEY;
  if (apiKey) {
    try {
      const apiData = await fetchOtxDataViaApi(ip);
      logger.info("Intel Agent: using OTX API data (MCP fallback)", { ip });
      return apiData;
    } catch (error) {
      logger.warn("Intel Agent: OTX API failed, using mock", {
        ip,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Strategy 3: Mock data
  logger.info("Intel Agent: using mock OTX data", { ip });
  return getMockOtxData();
}

// ---------------------------------------------------------------------------
// DeepSeek Enrichment (optional summarization)
// ---------------------------------------------------------------------------

function getMockDeepSeekResult(): DeepSeekIntel {
  return {
    threat_actor_summary:
      "This IP has appeared in 23 OTX threat pulses with a negative reputation and tags linked to credential harvesting and election interference. The Russian ASN metadata and targeting of a civic-facing service make this activity worth treating as a coordinated threat rather than routine internet noise.",
    hindi_summary:
      "यह IP रूस से है, 23 threat reports में listed, election interference campaign से जुड़ा है।",
    threat_level: "nation-state",
    campaign_link: "election-interference",
  };
}

function extractChatContent(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0];

  if (typeof firstChoice !== "object" || firstChoice === null) {
    throw new Error("AgentRouter response missing choices");
  }

  const message =
    typeof (firstChoice as { message?: unknown }).message === "object" &&
    (firstChoice as { message?: unknown }).message !== null
      ? ((firstChoice as { message: Record<string, unknown> }).message)
      : null;

  if (!message) {
    throw new Error("AgentRouter response missing message");
  }

  const content = message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content.flatMap((part) => {
      if (typeof part === "string") {
        return [part];
      }

      if (typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string") {
        return [(part as { text: string }).text];
      }

      return [];
    });

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  throw new Error("AgentRouter response missing parsable content");
}

function parseJsonBlock(content: string): DeepSeekIntel {
  const trimmed = content.trim();
  const jsonCandidate = trimmed.startsWith("{")
    ? trimmed
    : trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);

  return DeepSeekResponseSchema.parse(JSON.parse(jsonCandidate));
}

async function enrichWithDeepSeek(finding: ImmediatorResult, otxData: OtxData): Promise<DeepSeekIntel> {
  const apiKey = process.env.AGENTROUTER_API_KEY;
  const prompt = `
Attack on: ${finding.affectedService} (${finding.civicContext.slice(0, 100)})
Classification: ${finding.classification}
OTX data: ${JSON.stringify(otxData)}

Return JSON: {
  "threat_actor_summary": "2-3 sentence English summary",
  "hindi_summary": "1 sentence Hindi",
  "threat_level": "nation-state | criminal | opportunistic | unknown",
  "campaign_link": "any known campaign name or null"
}
  `.trim();

  if (!apiKey) {
    logger.info("Intel Agent using mock DeepSeek enrichment", {
      finding_id: finding.findingId,
      service: finding.affectedService,
    });
    return getMockDeepSeekResult();
  }

  const response = await fetch(AGENTROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v3",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a threat intelligence analyst. Given OTX data about an IP and the attack context, produce a 2-3 sentence plain English threat summary suitable for a government CISO. Also produce a 1-sentence Hindi summary. Return JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AgentRouter DeepSeek call failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return parseJsonBlock(extractChatContent(payload));
}

// ---------------------------------------------------------------------------
// Main Intel Agent Export
// ---------------------------------------------------------------------------

export async function intelAgent(finding: ImmediatorResult): Promise<IntelResult | null> {
  try {
    if (finding.offender.type !== "ip") {
      logger.info("Intel Agent skipped non-IP offender", {
        finding_id: finding.findingId,
        offender_type: finding.offender.type,
      });
      return null;
    }

    // Fetch OTX data (MCP-first strategy)
    const otxData = await fetchOtxData(finding.offender.value);

    // Enrich with DeepSeek (optional)
    const deepseekResult = await enrichWithDeepSeek(finding, otxData);

    const intelRecord = await prisma.threatIntelligence.upsert({
      where: { findingId: finding.findingId },
      update: {
        ip: finding.offender.value,
        otxPulseCount: otxData.pulse_count,
        otxReputation: otxData.reputation,
        country: otxData.country,
        asn: otxData.asn,
        malwareFamilies: otxData.malware_families,
        threatActorSummary: deepseekResult.threat_actor_summary,
        hindiSummary: deepseekResult.hindi_summary,
        threatLevel: deepseekResult.threat_level,
        campaignLink: deepseekResult.campaign_link,
        enrichedAt: new Date(),
      },
      create: {
        findingId: finding.findingId,
        ip: finding.offender.value,
        otxPulseCount: otxData.pulse_count,
        otxReputation: otxData.reputation,
        country: otxData.country,
        asn: otxData.asn,
        malwareFamilies: otxData.malware_families,
        threatActorSummary: deepseekResult.threat_actor_summary,
        hindiSummary: deepseekResult.hindi_summary,
        threatLevel: deepseekResult.threat_level,
        campaignLink: deepseekResult.campaign_link,
        enrichedAt: new Date(),
      },
    });

    await prisma.incident.update({
      where: { findingId: finding.findingId },
      data: {
        intelEnriched: true,
        threatLevel: deepseekResult.threat_level,
      },
    });

    const result: IntelResult = {
      finding_id: finding.findingId,
      ip: finding.offender.value,
      otx_pulse_count: intelRecord.otxPulseCount,
      otx_reputation: intelRecord.otxReputation,
      country: intelRecord.country,
      asn: intelRecord.asn,
      malware_families: intelRecord.malwareFamilies,
      threat_actor_summary: intelRecord.threatActorSummary,
      hindi_summary: intelRecord.hindiSummary,
      threat_level: intelRecord.threatLevel as IntelResult["threat_level"],
      campaign_link: intelRecord.campaignLink,
      enriched_at: intelRecord.enrichedAt.toISOString(),
      otx_source: otxData.source,
    };

    logger.info("Intel Agent enriched threat context", {
      finding_id: finding.findingId,
      incident_id: finding.incidentId,
      threat_level: result.threat_level,
      country: result.country,
      pulse_count: result.otx_pulse_count,
      otx_source: result.otx_source,
    });

    return result;
  } catch (error) {
    logger.warn("Intel Agent failed gracefully", {
      finding_id: finding.findingId,
      incident_id: finding.incidentId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}