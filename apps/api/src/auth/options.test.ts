/**
 * fnd-T6: the better-auth configuration module carries every
 * security-operations §2 parameter. Shape tests pin the wiring; behavioral
 * tests run a real better-auth instance over the in-memory adapter to prove
 * the protocols hold end to end (attempt limits, cooldown, non-enumeration,
 * hashed email OTPs, phone-first sign-up).
 */
import { betterAuth } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildAuthOptions, tempEmailForPhone } from "./options.js";
import { otpPolicy } from "./policy.js";

const PHONE = "+380671112233";

function createFixture() {
  const db: MemoryDB = {
    user: [],
    session: [],
    account: [],
    verification: [],
    rateLimit: [],
  };
  const sentPhone: { phoneNumber: string; code: string }[] = [];
  const sentEmail: { email: string; otp: string; type: string }[] = [];
  const entries = new Map<string, string>();
  let nowMs = Date.parse("2026-08-18T00:00:00Z");

  const options = buildAuthOptions({
    database: memoryAdapter(db),
    baseUrl: "http://localhost:3000",
    secret: "test-only-secret-0123456789abcdef-0000",
    sendPhoneOtp: (data) => {
      sentPhone.push(data);
      return Promise.resolve();
    },
    sendEmailOtp: (data) => {
      sentEmail.push(data);
      return Promise.resolve();
    },
    otpSendStore: {
      get: (key) => Promise.resolve(entries.get(key) ?? null),
      set: (key, value) => {
        entries.set(key, value);
        return Promise.resolve();
      },
    },
    now: () => nowMs,
  });

  return {
    options,
    auth: betterAuth(options),
    db,
    sentPhone,
    sentEmail,
    advanceSeconds: (seconds: number) => {
      nowMs += seconds * 1000;
    },
  };
}

/** Resolves the rejection so assertion failures are not swallowed by catch. */
async function apiError(promise: Promise<unknown>): Promise<APIError> {
  const outcome = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(outcome).toBeInstanceOf(APIError);
  if (!(outcome instanceof APIError)) throw new Error("unreachable");
  return outcome;
}

describe("buildAuthOptions — §2 parameter wiring", () => {
  const { options } = createFixture();

  it("configures both OTP plugins with 5-minute expiry and 5 attempts", () => {
    const pluginSchema = z.object({
      options: z.object({
        otpLength: z.number(),
        expiresIn: z.number(),
        allowedAttempts: z.number(),
      }),
    });
    for (const id of ["phone-number", "email-otp"]) {
      const plugin = pluginSchema.parse(
        options.plugins.find((candidate) => candidate.id === id),
      );
      expect(plugin.options).toMatchObject({
        otpLength: otpPolicy.length,
        expiresIn: 300,
        allowedAttempts: 5,
      });
    }
  });

  it("stores email OTPs hashed at rest", () => {
    const plugin = z
      .object({ options: z.object({ storeOTP: z.string() }) })
      .parse(options.plugins.find((candidate) => candidate.id === "email-otp"));
    expect(plugin.options.storeOTP).toBe("hashed");
  });

  it("enables bearer tokens for mobile clients", () => {
    expect(options.plugins.some((candidate) => candidate.id === "bearer")).toBe(
      true,
    );
  });

  it("rate-limits OTP sends to 20 per hour per IP in every environment", () => {
    expect(options.rateLimit.enabled).toBe(true);
    for (const path of [
      "/phone-number/send-otp",
      "/email-otp/send-verification-otp",
    ] as const) {
      expect(options.rateLimit.customRules[path]).toEqual({
        window: 3600,
        max: otpPolicy.maxSendsPerHourPerIp,
      });
    }
  });

  it("forces Secure, HttpOnly, SameSite cookies in every environment", () => {
    expect(options.advanced.useSecureCookies).toBe(true);
    expect(options.advanced.defaultCookieAttributes).toEqual({
      httpOnly: true,
      sameSite: "lax",
    });
  });

  it("never enables the email/password surface (OTP is the only flow)", () => {
    expect("emailAndPassword" in options).toBe(false);
  });
});

describe("phone OTP flow (behavioral, in-memory adapter)", () => {
  it("sends a 6-digit code and responds identically for any phone (non-enumeration)", async () => {
    const { auth, sentPhone } = createFixture();
    const first = await auth.api.sendPhoneNumberOTP({
      body: { phoneNumber: PHONE },
    });
    const second = await auth.api.sendPhoneNumberOTP({
      body: { phoneNumber: "+380509998877" },
    });
    expect(sentPhone).toHaveLength(2);
    expect(sentPhone[0]?.code).toMatch(/^\d{6}$/);
    // Same response body whether or not an account exists for the phone.
    expect(first).toEqual(second);
  });

  it("blocks a resend inside the 60-second cooldown and never sends the SMS", async () => {
    const { auth, sentPhone, advanceSeconds } = createFixture();
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } });
    const error = await apiError(
      auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } }),
    );
    expect(error.statusCode).toBe(429);
    expect(sentPhone).toHaveLength(1);

    advanceSeconds(otpPolicy.resendCooldownSeconds);
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } });
    expect(sentPhone).toHaveLength(2);
  });

  it("caps sends at 5 per hour per phone even outside the cooldown", async () => {
    const { auth, sentPhone, advanceSeconds } = createFixture();
    for (let i = 0; i < otpPolicy.maxSendsPerHourPerIdentifier; i++) {
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } });
      advanceSeconds(otpPolicy.resendCooldownSeconds + 1);
    }
    const error = await apiError(
      auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } }),
    );
    expect(error.statusCode).toBe(429);
    expect(sentPhone).toHaveLength(otpPolicy.maxSendsPerHourPerIdentifier);
  });

  it("invalidates the code after 5 failed verification attempts", async () => {
    const { auth, sentPhone } = createFixture();
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } });
    const code = sentPhone[0]?.code ?? "";
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < otpPolicy.maxVerifyAttempts; i++) {
      const error = await apiError(
        auth.api.verifyPhoneNumber({
          body: { phoneNumber: PHONE, code: wrong },
        }),
      );
      expect(error.statusCode).toBe(400);
    }
    // Attempt 6: the code is deleted and the caller is told to start over.
    const blocked = await apiError(
      auth.api.verifyPhoneNumber({ body: { phoneNumber: PHONE, code: wrong } }),
    );
    expect(blocked.statusCode).toBe(403);
    // Even the correct code is dead now.
    const dead = await apiError(
      auth.api.verifyPhoneNumber({ body: { phoneNumber: PHONE, code } }),
    );
    expect(dead.statusCode).toBe(400);
  });

  it("creates the account on first successful verification with a placeholder email", async () => {
    const { auth, db, sentPhone } = createFixture();
    await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: PHONE } });
    const code = sentPhone[0]?.code ?? "";
    await auth.api.verifyPhoneNumber({ body: { phoneNumber: PHONE, code } });

    const userRow = z
      .object({
        phoneNumber: z.string(),
        phoneNumberVerified: z.boolean(),
        email: z.string(),
      })
      .parse(db["user"]?.[0]);
    expect(userRow.phoneNumber).toBe(PHONE);
    expect(userRow.phoneNumberVerified).toBe(true);
    expect(userRow.email).toBe(tempEmailForPhone(PHONE));
    // The placeholder can never be a deliverable or registrable address.
    expect(userRow.email.endsWith("@phone.invalid")).toBe(true);
  });
});

describe("email OTP flow (behavioral, in-memory adapter)", () => {
  it("stores the OTP hashed at rest — the plaintext code never touches the database", async () => {
    const { auth, db, sentEmail } = createFixture();
    await auth.api.sendVerificationOTP({
      body: { email: "user@example.com", type: "sign-in" },
    });
    const otp = sentEmail[0]?.otp ?? "";
    expect(otp).toMatch(/^\d{6}$/);

    const rows = z
      .array(z.object({ value: z.string() }))
      .parse(db["verification"]);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.value).not.toContain(otp);
    }
  });

  it("applies the send cooldown to email identifiers case-insensitively", async () => {
    const { auth, sentEmail } = createFixture();
    await auth.api.sendVerificationOTP({
      body: { email: "User@Example.com", type: "sign-in" },
    });
    const error = await apiError(
      auth.api.sendVerificationOTP({
        body: { email: "user@example.COM", type: "sign-in" },
      }),
    );
    expect(error.statusCode).toBe(429);
    expect(sentEmail).toHaveLength(1);
  });
});
