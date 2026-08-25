/**
 * CLI-only better-auth instance for schema generation:
 *
 *   pnpm --filter @showzy/api auth:generate
 *
 * The better-auth CLI loads this file and writes the Drizzle schema for the
 * configured plugin set to `packages/db/src/schema/auth.ts` (db.md §4 — that
 * file is regenerated only through this entry, never hand-edited). Because
 * the instance is built through `buildAuthOptions`, the generated tables can
 * never drift from the runtime plugin set; CI re-runs generation and fails on
 * a dirty diff (`auth:check`).
 *
 * Nothing here ever runs: the pg pool connects lazily and generation is
 * offline, so the connection string and secret are inert placeholders — not
 * secrets.
 */
import { createDbClient } from "@showzy/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { buildAuthOptions } from "./options.js";

class SchemaGenerationOnlyError extends Error {
  constructor() {
    super("This better-auth instance exists only for schema generation.");
    this.name = "SchemaGenerationOnlyError";
  }
}

const { db } = createDbClient({
  databaseUrl: "postgresql://offline:offline@localhost:5432/offline",
});

export const auth = betterAuth(
  buildAuthOptions({
    database: drizzleAdapter(db, { provider: "pg" }),
    baseUrl: "http://localhost:3000",
    secret: "schema-generation-only-not-a-secret-0000",
    sendPhoneOtp: () => Promise.reject(new SchemaGenerationOnlyError()),
    sendEmailOtp: () => Promise.reject(new SchemaGenerationOnlyError()),
    otpSendStore: {
      tryRecordSend: () => Promise.reject(new SchemaGenerationOnlyError()),
    },
    authRateLimitStore: {
      consume: () => Promise.reject(new SchemaGenerationOnlyError()),
    },
    secondaryStorage: {
      get: () => Promise.reject(new SchemaGenerationOnlyError()),
      set: () => Promise.reject(new SchemaGenerationOnlyError()),
      delete: () => Promise.reject(new SchemaGenerationOnlyError()),
    },
  }),
);
