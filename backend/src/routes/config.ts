import { Router } from "express";
import { logger } from "../config/logger";
import { setModelMode, currentMode, MODEL_CONFIG, type ModelMode } from "../config/modelConfig";
import { AppError } from "../middleware/errorHandler";

const router = Router();

/**
 * POST /api/config/model-mode
 * Toggle between 'cost_optimised' and 'high_accuracy' modes.
 */
router.post("/model-mode", (req, res, next) => {
  try {
    const { mode } = req.body as { mode?: string };

    if (!mode) {
      throw new AppError("Missing 'mode' in request body", 400);
    }

    if (mode !== "cost_optimised" && mode !== "high_accuracy") {
      throw new AppError("Invalid mode. Must be 'cost_optimised' or 'high_accuracy'", 400);
    }

    setModelMode(mode as ModelMode);
    const config = MODEL_CONFIG[currentMode];

    logger.info("Model mode toggled", {
      mode: currentMode,
      model: config.model,
      label: config.label,
    });

    res.status(200).json({
      mode: currentMode,
      label: config.label,
      model: config.model,
      costPer1kTokens: config.costPer1kTokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/config/model-mode
 * Get current model configuration.
 */
router.get("/model-mode", (_req, res) => {
  const config = MODEL_CONFIG[currentMode];

  res.status(200).json({
    mode: currentMode,
    label: config.label,
    model: config.model,
    costPer1kTokens: config.costPer1kTokens,
    availableModes: Object.keys(MODEL_CONFIG),
  });
});

export default router;