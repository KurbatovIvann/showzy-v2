import { describe, expect, it } from "vitest";

import {
  AuthClientError,
  authErrorFromUnknown,
  classifyAuthHttpStatus,
} from "./errors";

describe("auth HTTP errors (status, not message text)", () => {
  it("maps verify 400 and 403 independently of the body copy", () => {
    expect(classifyAuthHttpStatus(400, "verify")).toBe("invalid_otp");
    expect(classifyAuthHttpStatus(403, "verify")).toBe("verify_locked");
    const wrong = new AuthClientError("invalid_otp");
    const locked = new AuthClientError("verify_locked");
    expect(wrong.message).toBe("invalid_otp");
    expect(locked.message).toBe("verify_locked");
    expect(wrong.message).not.toContain("000000");
    expect(locked.message).not.toContain("otp");
  });

  it("maps send 429 to resend_limited for any retry copy", () => {
    expect(classifyAuthHttpStatus(429, "send")).toBe("resend_limited");
    expect(classifyAuthHttpStatus(429, "verify")).toBe("resend_limited");
    const error = new AuthClientError("resend_limited", 60);
    expect(error.retryAfterSec).toBe(60);
    expect(error.message).toBe("resend_limited");
  });

  it("does not classify send 400 as invalid OTP", () => {
    expect(classifyAuthHttpStatus(400, "send")).toBe("invalid_identifier");
    expect(classifyAuthHttpStatus(401, "session")).toBe("unauthenticated");
    expect(classifyAuthHttpStatus(500, "session")).toBe("unavailable");
  });

  it("treats unknown throws as network and never copies their text", () => {
    const mapped = authErrorFromUnknown(
      new Error("otp=123456 leaked"),
      "session",
    );
    expect(mapped.kind).toBe("network");
    expect(mapped.message).toBe("network");
    expect(mapped.message).not.toContain("123456");
  });

  it("maps better-auth errors by status and ignores message text", () => {
    const leaked = authErrorFromUnknown(
      { status: 400, message: "otp=000000" },
      "verify",
    );
    expect(leaked.kind).toBe("invalid_otp");
    expect(leaked.message).toBe("invalid_otp");
    expect(leaked.message).not.toContain("000000");
    expect(
      authErrorFromUnknown({ status: 429, message: "slow down" }, "send").kind,
    ).toBe("resend_limited");
  });
});
