/**
 * Reference token-bucket semantics (core.md §10). The Redis store that
 * replaces this in fnd-T26 must pass conceptually identical cases.
 */
import { describe, expect, it } from "vitest";

import { createInMemoryRateLimitStore } from "./token-bucket.js";

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

describe("createInMemoryRateLimitStore", () => {
  it("allows exactly `limit` instant requests, then denies with a retry hint", async () => {
    const clock = fakeClock();
    const store = createInMemoryRateLimitStore({ now: clock.now });
    const request = { key: "rl:a:user:u1", limit: 3, windowSec: 60 };

    for (let i = 0; i < 3; i += 1) {
      expect(await store.consume(request)).toEqual({ allowed: true });
    }
    const denied = await store.consume(request);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      // One token refills every windowSec / limit = 20 s.
      expect(denied.retryAfterSec).toBe(20);
    }
  });

  it("refills continuously: waiting the retry hint grants exactly one more token", async () => {
    const clock = fakeClock();
    const store = createInMemoryRateLimitStore({ now: clock.now });
    const request = { key: "rl:a:user:u1", limit: 2, windowSec: 60 };

    await store.consume(request);
    await store.consume(request);
    const denied = await store.consume(request);
    expect(denied.allowed).toBe(false);

    clock.advance(30_000); // windowSec / limit — one token back.
    expect(await store.consume(request)).toEqual({ allowed: true });
    expect((await store.consume(request)).allowed).toBe(false);
  });

  it("caps refill at the bucket capacity", async () => {
    const clock = fakeClock();
    const store = createInMemoryRateLimitStore({ now: clock.now });
    const request = { key: "rl:a:user:u1", limit: 2, windowSec: 60 };

    await store.consume(request);
    clock.advance(3_600_000); // A long idle hour refills to capacity, not beyond.

    expect(await store.consume(request)).toEqual({ allowed: true });
    expect(await store.consume(request)).toEqual({ allowed: true });
    expect((await store.consume(request)).allowed).toBe(false);
  });

  it("isolates buckets by key", async () => {
    const store = createInMemoryRateLimitStore({ now: fakeClock().now });

    const first = { key: "rl:a:user:u1", limit: 1, windowSec: 60 };
    const second = { key: "rl:a:user:u2", limit: 1, windowSec: 60 };

    expect(await store.consume(first)).toEqual({ allowed: true });
    expect((await store.consume(first)).allowed).toBe(false);
    expect(await store.consume(second)).toEqual({ allowed: true });
  });

  it("never reports a zero or negative retry hint", async () => {
    const clock = fakeClock();
    const store = createInMemoryRateLimitStore({ now: clock.now });
    // High rate: one token refills every 500 ms — still hinted as 1 s.
    const request = { key: "rl:a:user:u1", limit: 120, windowSec: 60 };

    for (let i = 0; i < 120; i += 1) {
      await store.consume(request);
    }
    const denied = await store.consume(request);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    }
  });
});
