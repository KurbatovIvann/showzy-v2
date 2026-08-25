import { CoreInvariantError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  hmacBetterAuthConsumeKey,
  requireAuthIpHmacSecret,
} from "./auth-ip-hmac.js";

const SECRET = "test-ip-hmac-secret";

describe("hmacBetterAuthConsumeKey (SHO-147 variant A, no rotation)", () => {
  it("returns 32 hex chars and does not contain a dotted-quad or IPv6 preimage", () => {
    const v4 = "198.51.100.41|/phone-number/send-otp";
    const v6 = "2001:db8::1|/phone-number/send-otp";
    const digestV4 = hmacBetterAuthConsumeKey(v4, SECRET);
    const digestV6 = hmacBetterAuthConsumeKey(v6, SECRET);
    expect(digestV4).toMatch(/^[0-9a-f]{32}$/);
    expect(digestV6).toMatch(/^[0-9a-f]{32}$/);
    expect(digestV4).not.toContain("198.51.100.41");
    expect(digestV4).not.toContain("198.51.100");
    expect(digestV6).not.toContain("2001:db8::1");
    expect(digestV6).not.toContain("2001:db8");
    expect(digestV4).not.toBe(digestV6);
  });

  it("is stable for the same key — no 24h rotation in the digest input", () => {
    const key = "203.0.113.77|/email-otp/send-verification-otp";
    expect(hmacBetterAuthConsumeKey(key, SECRET)).toBe(
      hmacBetterAuthConsumeKey(key, SECRET),
    );
  });
});

describe("requireAuthIpHmacSecret", () => {
  it("returns a non-empty secret and refuses an empty string", () => {
    expect(requireAuthIpHmacSecret(SECRET)).toBe(SECRET);
    expect(() => requireAuthIpHmacSecret("")).toThrow(CoreInvariantError);
  });
});
