import { defineConfig } from "drizzle-kit";

// CLI-only configuration (drizzle-kit generate/migrate) — not runtime code.
// It reads the two database variables directly instead of loading
// @showzy/config: the migration step must not require unrelated runtime
// variables (Redis, S3, auth secrets) to run DDL, and `generate` needs no
// connection at all. Runtime code keeps getting its connection through
// validated config.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dbCredentials: {
    // Migrations run under the migration role (db.md §6); local dev may point
    // both URLs at the compose superuser.
    url: process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
