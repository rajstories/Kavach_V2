import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  logger.error("Request failed", {
    path: req.path,
    method: req.method,
    statusCode,
    error: err.message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 ? "Internal Server Error" : err.message,
      statusCode,
    },
    timestamp: new Date().toISOString(),
  });
}
