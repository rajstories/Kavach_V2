import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { logger } from "./config/logger";
import configRoutes from "./routes/config";
import copilotRoutes from "./routes/copilot";
import incidentsRoutes from "./routes/incidents";
import logsRoutes from "./routes/logs";
import mlConfigRoutes from "./routes/mlConfig";
import { AppError, errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? "5000");

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "5mb" }));
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kavach-backend", time: new Date().toISOString() });
});

app.use("/api/incidents", incidentsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/copilot", copilotRoutes);
app.use("/api/config", configRoutes);
app.use("/api/ml", mlConfigRoutes);

app.use((_req, _res, next) => {
  next(new AppError("Route not found", 404));
});

app.use(errorHandler);

app.listen(port, () => {
  logger.info(`KAVACH backend listening on port ${port}`);
});
