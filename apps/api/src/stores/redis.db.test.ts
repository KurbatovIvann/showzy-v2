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
  it("expires via PX and GETDEL returns null after expiry", async () => {
    const store = createRedisConfirmationStore(redis);
    await store.set("confirm:test", "challenge", 50);
    expect(await store.getAndDelete("confirm:test")).toBe("challenge");
    await store.set("confirm:ttl", "challenge", 50);
    await new Promise((resolve) => setTimeout(resolve, 80));
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
