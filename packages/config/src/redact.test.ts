import { describe, expect, it } from "vitest";

import {
  REDACTED,
  isSensitiveKey,
  redactText,
  redactUnknown,
  scrubTelemetryEvent,
} from "./redact.js";

const OTP = "847291";
const AUTH_SECRET = "AUTH_SECRET_SENTINEL_do_not_log";
const DB_PASSWORD = "DB_PASSWORD_SENTINEL";
const REDIS_PASSWORD = "REDIS_PASSWORD_SENTINEL";
const SENTRY_KEY = "SENTRY_KEY_SENTINEL";
const BEARER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sentinel";
const PHONE = "+380501234567";
const EMAIL = "owner@example.com";
const RAW_IP = "203.0.113.44";

describe("isSensitiveKey", () => {
  it("matches policy names regardless of separators and case", () => {
    expect(isSensitiveKey("otp")).toBe(true);
    expect(isSensitiveKey("OTP_CODE")).toBe(true);
    expect(isSensitiveKey("authorization")).toBe(true);
    expect(isSensitiveKey("secretAccessKey")).toBe(true);
    expect(isSensitiveKey("ip_hmac_secret")).toBe(true);
    expect(isSensitiveKey("clientIp")).toBe(true);
    expect(isSensitiveKey("rawPayload")).toBe(true);
  });

  it("leaves correlation fields alone", () => {
    expect(isSensitiveKey("request_id")).toBe(false);
    expect(isSensitiveKey("actor_id")).toBe(false);
    expect(isSensitiveKey("company_id")).toBe(false);
    expect(isSensitiveKey("action")).toBe(false);
    expect(isSensitiveKey("channel")).toBe(false);
    expect(isSensitiveKey("outcome")).toBe(false);
    expect(isSensitiveKey("tool_call_id")).toBe(false);
  });
});

describe("redactText", () => {
  it("strips passwords out of Postgres and Redis URLs", () => {
    const postgres = redactText(
      `connect postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`,
    );
    expect(postgres).toContain("postgresql://showzy:");
    expect(postgres).toContain(REDACTED);
    expect(postgres).not.toContain(DB_PASSWORD);

    const redis = redactText(`redis://:${REDIS_PASSWORD}@localhost:6379/0`);
    expect(redis).toContain(REDACTED);
    expect(redis).not.toContain(REDIS_PASSWORD);
  });

  it("strips Bearer tokens and Sentry DSN userinfo", () => {
    expect(redactText(`Authorization: Bearer ${BEARER}`)).not.toContain(BEARER);
    expect(
      redactText(`https://${SENTRY_KEY}@sentry.example.com/42`),
    ).not.toContain(SENTRY_KEY);
  });
});

describe("redactUnknown", () => {
  it("redacts secrets, OTPs, tokens, PII, raw IPs, and webhook bodies", () => {
    const redacted = redactUnknown({
      request_id: "req-1",
      action: "orders.create",
      actor_id: "user-1",
      company_id: "company-1",
      otp: OTP,
      password: AUTH_SECRET,
      authorization: `Bearer ${BEARER}`,
      cookie: "better-auth.session=abc",
      email: EMAIL,
      phone: PHONE,
      clientIp: RAW_IP,
      rawPayload: { provider: "monobank", body: "PAN 4444333322221111" },
      nested: { ipHmacSecret: AUTH_SECRET, ok: true },
    });

    expect(redacted.request_id).toBe("req-1");
    expect(redacted.action).toBe("orders.create");
    expect(redacted.actor_id).toBe("user-1");
    expect(redacted.company_id).toBe("company-1");
    expect(redacted.otp).toBe(REDACTED);
    expect(redacted.password).toBe(REDACTED);
    expect(redacted.authorization).toBe(REDACTED);
    expect(redacted.cookie).toBe(REDACTED);
    expect(redacted.email).toBe(REDACTED);
    expect(redacted.phone).toBe(REDACTED);
    expect(redacted.clientIp).toBe(REDACTED);
    expect(redacted.rawPayload).toBe(REDACTED);
    expect(redacted.nested).toEqual({ ipHmacSecret: REDACTED, ok: true });

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain(OTP);
    expect(serialized).not.toContain(AUTH_SECRET);
    expect(serialized).not.toContain(BEARER);
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain(PHONE);
    expect(serialized).not.toContain(RAW_IP);
    expect(serialized).not.toContain("4444333322221111");
  });

  it("redacts credentials inside Error messages without dropping the Error", () => {
    const error = new Error(
      `migrate failed: postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`,
    );
    const redacted = redactUnknown(error);
    expect(redacted).toBeInstanceOf(Error);
    expect(redacted.message).not.toContain(DB_PASSWORD);
    expect(redacted.message).toContain(REDACTED);
  });
});

describe("scrubTelemetryEvent", () => {
  it("scrubs a Sentry-shaped payload the same way as a log object", () => {
    const event = scrubTelemetryEvent({
      message: `otp ${OTP} for ${EMAIL}`,
      extra: {
        otp: OTP,
        databaseUrl: `postgresql://showzy:${DB_PASSWORD}@localhost:5432/showzy`,
      },
      request: {
        headers: { authorization: `Bearer ${BEARER}`, cookie: "sid=1" },
        data: { phone: PHONE, action: "account.requestOtp" },
      },
      user: { email: EMAIL, ip_address: RAW_IP, id: "user-1" },
      contexts: { response: { rawBody: "<html>invoice</html>" } },
    });

    expect(event.request.data.action).toBe("account.requestOtp");
    expect(event.user.id).toBe("user-1");
    expect(event.extra.otp).toBe(REDACTED);
    expect(event.extra.databaseUrl).not.toContain(DB_PASSWORD);
    expect(event.request.headers.authorization).toBe(REDACTED);
    expect(event.request.headers.cookie).toBe(REDACTED);
    expect(event.request.data.phone).toBe(REDACTED);
    expect(event.user.email).toBe(REDACTED);
    expect(event.user.ip_address).toBe(REDACTED);
    expect(event.contexts.response.rawBody).toBe(REDACTED);

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(OTP);
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain(BEARER);
    expect(serialized).not.toContain(PHONE);
    expect(serialized).not.toContain(RAW_IP);
    expect(serialized).not.toContain("<html>invoice</html>");
  });
});
