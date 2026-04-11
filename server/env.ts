import { logger } from "./logger";

export const featureFlags = {
  partsCatalogV2: process.env.PARTS_CATALOG_V2 === "true",
} as const;

export function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    logger.error("FATAL: DATABASE_URL environment variable is required but not set.");
    process.exit(1);
  }

  const port = process.env.PORT;
  if (port !== undefined) {
    const parsed = Number(port);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
      logger.error(`FATAL: PORT must be a valid number between 0 and 65535, got "${port}".`);
      process.exit(1);
    }
  } else {
    logger.warn("PORT not set, defaulting to 5000.");
  }

  const nodeEnv = process.env.NODE_ENV;
  const validEnvs = ["development", "production", "test"];
  if (nodeEnv !== undefined && !validEnvs.includes(nodeEnv)) {
    logger.error(`FATAL: NODE_ENV must be one of ${validEnvs.join(", ")}, got "${nodeEnv}".`);
    process.exit(1);
  }
  if (nodeEnv === undefined) {
    logger.warn("NODE_ENV not set, defaulting to development behavior.");
  }
}
