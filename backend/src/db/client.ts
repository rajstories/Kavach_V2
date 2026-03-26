import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __kavachPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__kavachPrisma ??
  new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__kavachPrisma = prisma;
}
