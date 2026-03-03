import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { logger } from "./logger";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(process.env.NODE_ENV === "production" ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on("error", (err) => {
  logger.error("Unexpected database pool error", { error: err.message });
});

export const db = drizzle(pool, { schema });

export async function checkConnection(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      logger.info("Database connection verified");
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Database connection attempt failed", { attempt, maxRetries, error: message });
      if (attempt === maxRetries) {
        throw new Error(`Could not connect to database after ${maxRetries} attempts.`);
      }
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
