import Redis from "ioredis";
import { logger } from "./logger";

let redis: Redis | null = null;

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn("Redis retry limit reached — running without Redis", { attempts: times });
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    client.on("error", (err) => {
      logger.warn("Redis connection error — swarm features degraded", { error: err.message });
    });

    client.on("connect", () => {
      logger.info("Redis connected — swarm broadcast enabled");
    });

    return client;
  } catch (err) {
    logger.warn("Failed to create Redis client — swarm features disabled", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return null;
  }
}

export function getRedis(): Redis | null {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

export async function connectRedis(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    await client.connect();
    return true;
  } catch {
    logger.warn("Redis connect() failed — swarm features will be unavailable");
    return false;
  }
}
