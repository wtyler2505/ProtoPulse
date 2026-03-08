import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Migration strategy:
//   Development  — `npm run db:push`   (drizzle-kit push, fast schema sync)
//   Production   — `npm run db:migrate` (drizzle-kit migrate, applies SQL files)
//
// Migration history:
//   0000  Baseline — 19 original tables (2026-02-28)
//   0001  CHECK constraints for enum-like text columns (2026-03-01)
//   0002  Schema sync — 8 new tables + column additions for all 27 tables (2026-03-08)
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
