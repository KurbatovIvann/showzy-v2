/**
 * Process boot: load validated config, open Postgres + Redis, compose
 * better-auth and the action pipeline, return the Hono app. OTP delivery
 * providers are not in this slice — senders are no-ops so codes never
 * reach logs (security-operations §2). T49 mounts real senders.
 */
import { getConnInfo } from "@hono/node-server/conninfo";
import type { ServerConfig } from "@showzy/config";
import { contractModules } from "@showzy/contract";
import { ActionRegistry } from "@showzy/core";
import { createDbClient } from "@showzy/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Context } from "hono";
import { Redis } from "ioredis";
import { pino } from "pino";

import { buildAuthOptions } from "./auth/options.js";
import { createApp, type AuthInstance } from "./http/app.js";
import { createActionPipeline } from "./pipeline.js";
import {
  createRedisConfirmationStore,
  createRedisRateLimitStore,
  createRedisSecondaryStorage,
} from "./stores/redis.js";

export interface BootedApi {
  readonly app: ReturnType<typeof createApp>;
  close(): Promise<void>;
}

async function dropOtp(): Promise<void> {
  // Intentionally empty: codes are never logged, and SMS/email providers
  // are not part of this slice.
}

function peerAddressFromConnInfo(c: Context): string {
  try {
    const address = getConnInfo(c).remote.address;
    if (address !== undefined && address !== "") {
      return address;
    }
  } catch {
    // Fetch-style invocations have no socket (tests call createApp with
    // their own getPeerAddress instead).
  }
  return "0.0.0.0";
}

export async function bootApi(config: ServerConfig): Promise<BootedApi> {
  const db = createDbClient({ databaseUrl: config.database.url });
  const redis = new Redis(config.redis.url);
  await redis.ping();
  const logger = pino({ name: "api" });
  const secondary = createRedisSecondaryStorage(redis);

  const authInstance = betterAuth(
    buildAuthOptions({
      database: drizzleAdapter(db.db, { provider: "pg" }),
      baseUrl: config.auth.url,
      secret: config.auth.secret,
      sendPhoneOtp: () => dropOtp(),
      sendEmailOtp: () => dropOtp(),
      otpSendStore: secondary,
      secondaryStorage: secondary,
    }),
  );
  const auth: AuthInstance = {
    handler: (request) => authInstance.handler(request),
    api: {
      async getSession({ headers }) {
        const result = await authInstance.api.getSession({ headers });
        if (result === null) {
          return null;
        }
        return { user: { id: result.user.id } };
      },
    },
  };

  const pipeline = createActionPipeline({
    db: db.db,
    logger,
    rateLimitStore: createRedisRateLimitStore(redis),
    confirmationStore: createRedisConfirmationStore(redis),
    ipHmacSecret: config.rateLimit.ipHmacSecret,
  });

  const registry = new ActionRegistry();
  const app = createApp({
    auth,
    registry,
    contractModules,
    pipeline,
    trustedProxies: config.trustedProxies,
    getPeerAddress: peerAddressFromConnInfo,
  });

  return {
    app,
    async close() {
      await redis.quit();
      await db.pool.end();
    },
  };
}
