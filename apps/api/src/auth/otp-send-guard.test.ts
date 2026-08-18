import { describe, expect, it } from "vitest";

import {
  createMemoryOtpSendStore,
  createOtpSendGuard,
} from "./otp-send-guard.js";
import { otpPolicy } from "./policy.js";

function createFixture(startMs = Date.parse("2026-08-18T00:00:00Z")) {
  const store = createMemoryOtpSendStore();
  let nowMs = startMs;
  const guard = createOtpSendGuard({ store, now: () => nowMs });
  return {
    guard,
    entries: store.entries,
    advanceSeconds: (seconds: number) => {
      nowMs += seconds * 1000;
    },
  };
}

describe("createOtpSendGuard (security-operations §2 per-identifier limits)", () => {
  it("allows the first send and records it", async () => {
    const { guard, entries } = createFixture();
    await expect(guard.check("phone", "+380671112233")).resolves.toEqual({
      allowed: true,
    });
    expect(entries.has("otp-send:phone:+380671112233")).toBe(true);
  });

  it("blocks a resend inside the 60-second cooldown with the remaining wait", async () => {
    const { guard, advanceSeconds } = createFixture();
    await guard.check("phone", "+380671112233");
    advanceSeconds(10);
    await expect(guard.check("phone", "+380671112233")).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: otpPolicy.resendCooldownSeconds - 10,
    });
  });

  it("allows a resend once the cooldown has passed", async () => {
    const { guard, advanceSeconds } = createFixture();
    await guard.check("phone", "+380671112233");
    advanceSeconds(otpPolicy.resendCooldownSeconds);
    await expect(guard.check("phone", "+380671112233")).resolves.toEqual({
      allowed: true,
    });
  });

  it("caps sends at 5 per rolling hour per identifier", async () => {
    const { guard, advanceSeconds } = createFixture();
    for (let i = 0; i < otpPolicy.maxSendsPerHourPerIdentifier; i++) {
      await expect(guard.check("phone", "+380671112233")).resolves.toEqual({
        allowed: true,
      });
      advanceSeconds(otpPolicy.resendCooldownSeconds + 1);
    }
    // Cooldown has passed, so only the hourly cap can be the reason now.
    const decision = await guard.check("phone", "+380671112233");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("frees capacity when the oldest send leaves the rolling window", async () => {
    const { guard, advanceSeconds } = createFixture();
    for (let i = 0; i < otpPolicy.maxSendsPerHourPerIdentifier; i++) {
      await guard.check("phone", "+380671112233");
      advanceSeconds(otpPolicy.resendCooldownSeconds + 1);
    }
    // Jump past the first send's window edge; four sends remain inside.
    advanceSeconds(
      otpPolicy.sendWindowSeconds -
        otpPolicy.maxSendsPerHourPerIdentifier *
          (otpPolicy.resendCooldownSeconds + 1),
    );
    await expect(guard.check("phone", "+380671112233")).resolves.toEqual({
      allowed: true,
    });
  });

  it("tracks identifiers and channels independently", async () => {
    const { guard } = createFixture();
    await guard.check("phone", "+380671112233");
    await expect(guard.check("phone", "+380509998877")).resolves.toEqual({
      allowed: true,
    });
    await expect(guard.check("email", "user@example.com")).resolves.toEqual({
      allowed: true,
    });
  });

  it("normalizes email case so limits cannot be bypassed by recasing", async () => {
    const { guard } = createFixture();
    await guard.check("email", "User@Example.com");
    const decision = await guard.check("email", "user@example.COM");
    expect(decision.allowed).toBe(false);
  });

  it("treats corrupt store state as empty instead of blocking sign-in", async () => {
    const { guard, entries } = createFixture();
    entries.set("otp-send:phone:+380671112233", "not-json");
    await expect(guard.check("phone", "+380671112233")).resolves.toEqual({
      allowed: true,
    });
  });

  it("records at most one send when two checks race on the same identifier", async () => {
    const { guard, entries } = createFixture();
    const [first, second] = await Promise.all([
      guard.check("phone", "+380671112233"),
      guard.check("phone", "+380671112233"),
    ]);
    const allowed = [first, second].filter((decision) => decision.allowed);
    expect(allowed).toHaveLength(1);
    const raw = entries.get("otp-send:phone:+380671112233");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? "[]")).toHaveLength(1);
  });
});
