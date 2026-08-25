import { describe, expect, it } from "vitest";

import { otpPolicy } from "../auth/policy.js";
import { createMemoryAuthRateLimitStore } from "./memory.js";

describe("createMemoryAuthRateLimitStore", () => {
  it("records at most max consumes across two overlapping Promise.all calls", async () => {
    const store = createMemoryAuthRateLimitStore();
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
});
