import { CoreInvariantError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { otpPolicy } from "../auth/policy.js";
import { createMemoryAuthRateLimitStore } from "./memory.js";

const IP_HMAC_SECRET = "test-ip-hmac-secret";

describe("createMemoryAuthRateLimitStore", () => {
  it("records at most max consumes across two overlapping Promise.all calls", async () => {
    const store = createMemoryAuthRateLimitStore({
      ipHmacSecret: IP_HMAC_SECRET,
    });
    const rule = {
      window: otpPolicy.sendWindowSeconds,
      max: otpPolicy.maxSendsPerHourPerIp,
    };
    const extra = 10;
    const half = Math.ceil((rule.max + extra) / 2);
    const [first, second] = await Promise.all([
      Promise.all(
        Array.from({ length: half }, () => store.consume("ip-a", rule)),
      ),
      Promise.all(
        Array.from({ length: half }, () => store.consume("ip-a", rule)),
      ),
    ]);
    const allowed = [...first, ...second].filter(
      (decision) => decision.allowed,
    );
    expect(allowed).toHaveLength(rule.max);
  });

  it("keeps two Better Auth IP keys on independent buckets", async () => {
    const store = createMemoryAuthRateLimitStore({
      ipHmacSecret: IP_HMAC_SECRET,
    });
    const rule = { window: otpPolicy.sendWindowSeconds, max: 1 };
    const first = "198.51.100.10|/phone-number/send-otp";
    const second = "198.51.100.11|/phone-number/send-otp";
    await expect(store.consume(first, rule)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(store.consume(first, rule)).resolves.toMatchObject({
      allowed: false,
    });
    await expect(store.consume(second, rule)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("refuses construction with an empty HMAC secret", () => {
    expect(() => createMemoryAuthRateLimitStore({ ipHmacSecret: "" })).toThrow(
      CoreInvariantError,
    );
  });
});
