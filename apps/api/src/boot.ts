/**
 * Process boot: load validated config, open Postgres + Redis, compose
 * better-auth and the action pipeline, return the Hono app. OTP senders are
 * composed from validated `otpDelivery` config (stub in development/test;
 * live adapters in auth-T2). Codes never reach logs (security-operations §2).
 */
import { getConnInfo } from "@hono/node-server/conninfo";
import type { ServerConfig } from "@showzy/config";
import { contractModules } from "@showzy/contract";
import { createDbClient } from "@showzy/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Context } from "hono";
import { Redis } from "ioredis";

import { buildAuthOptions } from "./auth/options.js";
import { otpSendersFromConfig } from "./auth/otp-delivery.js";
import { createActionRegistry } from "./composition.js";
import { createApp, type AuthInstance } from "./http/app.js";
import { createProcessObservability } from "./observability.js";
import { createActionPipeline } from "./pipeline.js";
import {
  createRedisConfirmationStore,
  createRedisOtpSendStore,
  createRedisRateLimitStore,
  createRedisSecondaryStorage,
} from "./stores/redis.js";

export interface BootedApi {
  readonly app: ReturnType<typeof createApp>;
  close(): Promise<void>;
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
  const { logger, telemetry } = createProcessObservability({
    name: "api",
    sentryDsn: config.sentry.dsn,
  });
  const secondary = createRedisSecondaryStorage(redis);
  const otpSenders = otpSendersFromConfig(config.otpDelivery);

  const authInstance = betterAuth(
    buildAuthOptions({
      database: drizzleAdapter(db.db, { provider: "pg" }),
      baseUrl: config.auth.url,
      secret: config.auth.secret,
      sendPhoneOtp: otpSenders.sendPhoneOtp,
      sendEmailOtp: otpSenders.sendEmailOtp,
      otpSendStore: createRedisOtpSendStore(redis),
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
    telemetry,
    rateLimitStore: createRedisRateLimitStore(redis),
    confirmationStore: createRedisConfirmationStore(redis),
    ipHmacSecret: config.rateLimit.ipHmacSecret,
  });

  const registry = createActionRegistry();
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
