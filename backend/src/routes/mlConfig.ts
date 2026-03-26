import { Router } from "express";
import { logger } from "../config/logger";
import { AppError } from "../middleware/errorHandler";

const router = Router();
const ML_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8001";

// Mock data returned when ML service is unreachable
const MOCK_STATUS = {
  current_version: "v1",
  versions: {
    v1: {
      accuracy: 89.0,
      latency_ms: 140,
      incidents_used: 0,
      label: "Baseline — benign traffic only",
      loaded: false,
    },
    v2: {
      accuracy: 94.7,
      latency_ms: 95,
      incidents_used: 5,
      label: "Hardened — learned from 5 past attacks",
      loaded: false,
    },
  },
};

/**
 * GET /api/ml/status
 * Proxy to ML service GET /model/status
 */
router.get("/status", async (_req, res, next) => {
  try {
    const response = await fetch(`${ML_URL}/model/status`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    logger.warn("ML config: service unreachable, returning mock status", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.json(MOCK_STATUS);
  }
});

/**
 * POST /api/ml/switch
 * Proxy to ML service POST /model/switch
 */
router.post("/switch", async (req, res, next) => {
  try {
    const { version } = req.body as { version?: string };

    if (!version || !["v1", "v2"].includes(version)) {
      throw new AppError("version must be v1 or v2", 400);
    }

    const response = await fetch(`${ML_URL}/model/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`ML service returned ${response.status}: ${detail}`);
    }

    const data = await response.json();

    logger.info("ML model version switched", {
      version,
      label: (data as Record<string, unknown>).label,
    });

    res.json(data);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.warn("ML config: switch failed, service may be down", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(503).json({
      error: "ML service unavailable",
      message: "Could not switch model version — ML service is not reachable",
    });
  }
});

export default router;
