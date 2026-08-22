/**
 * Redis adapters must match the in-memory reference stores (core.md §7/§10).
 */
import { Redis } from "ioredis";
import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createRedisConfirmationStore,
  createRedisOtpSendStore,
  createRedisRateLimitStore,
  createRedisSecondaryStorage,
} from "./redis.js";

function fakeClock(startMs = 1_000_000): {
  now: () => number;
  advance: (ms: number) => void;
} {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

let container: StartedRedisContainer;
let redis: Redis;

beforeAll(async () => {
  container = await new RedisContainer("redis:8-alpine").start();
  redis = new Redis(container.getConnectionUrl());
});

afterAll(async () => {
  await redis.quit();
  await container.stop();
});

describe("createRedisSecondaryStorage", () => {
  it("getAndDelete consumes a key exactly once (GETDEL)", async () => {
    const store = createRedisSecondaryStorage(redis);
    await store.set("otp:test", "secret", 60);
    expect(await store.getAndDelete("otp:test")).toBe("secret");
    expect(await store.get("otp:test")).toBeNull();
    expect(await store.getAndDelete("otp:test")).toBeNull();
  });
});

describe("createRedisConfirmationStore", () => {
  it("GETDEL returns the value once while unexpired", async () => {
    const store = createRedisConfirmationStore(redis);
    await store.set("confirm:test", "challenge", 60_000);
    expect(await store.getAndDelete("confirm:test")).toBe("challenge");
    expect(await store.getAndDelete("confirm:test")).toBeNull();
  });

  it("expires via PX and GETDEL returns null after expiry", async () => {
    const store = createRedisConfirmationStore(redis);
    await store.set("confirm:ttl", "challenge", 200);
    const remainingMs = await redis.pttl("confirm:ttl");
    expect(remainingMs).toBeGreaterThan(0);
    expect(remainingMs).toBeLessThanOrEqual(200);

    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline && (await redis.pttl("confirm:ttl")) > 0) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(await store.getAndDelete("confirm:ttl")).toBeNull();
  });
});

describe("createRedisRateLimitStore", () => {
  it("allows exactly `limit` instant requests, then denies with a retry hint", async () => {
    const clock = fakeClock();
    const store = createRedisRateLimitStore(redis, { now: clock.now });
    const request = { key: "rl:a:user:u1", limit: 3, windowSec: 60 };

    for (let i = 0; i < 3; i += 1) {
      expect(await store.consume(request)).toEqual({ allowed: true });
    }
    const denied = await store.consume(request);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSec).toBe(20);
    }
  });

  it("refills continuously: waiting the retry hint grants exactly one more token", async () => {
    const clock = fakeClock();
    const store = createRedisRateLimitStore(redis, { now: clock.now });
    const request = { key: "rl:a:user:u2", limit: 2, windowSec: 60 };

    await store.consume(request);
    await store.consume(request);
    expect((await store.consume(request)).allowed).toBe(false);

    clock.advance(30_000);
    expect(await store.consume(request)).toEqual({ allowed: true });
    expect((await store.consume(request)).allowed).toBe(false);
  });
});

describe("createRedisOtpSendStore", () => {
  it("records at most one send when two attempts race", async () => {
    const store = createRedisOtpSendStore(redis);
    const attempt = {
      key: "otp-send:phone:+380671112233",
      nowMs: 1_000_000,
      cooldownMs: 60_000,
      windowMs: 3_600_000,
      maxSends: 5,
      ttlSeconds: 3600,
    };
    const [first, second] = await Promise.all([
      store.tryRecordSend(attempt),
      store.tryRecordSend(attempt),
    ]);
    const allowed = [first, second].filter((decision) => decision.allowed);
    expect(allowed).toHaveLength(1);
  });
});
