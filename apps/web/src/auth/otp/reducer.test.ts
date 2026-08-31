import { describe, expect, it } from "vitest";

import { AuthClientError } from "../errors";
import { authPolicy } from "./policy";
import {
  initialOtpState,
  otpReducer,
  parseCurrentIdentifier,
  resendSecondsRemaining,
  type OtpState,
} from "./reducer";

function reduce(actions: Parameters<typeof otpReducer>[1][]): OtpState {
  return actions.reduce(otpReducer, initialOtpState());
}

describe("otpReducer", () => {
  it("rejects a malformed identifier without leaving the identifier step", () => {
    const state = reduce([
      { type: "setPhone", phone: "67" },
      { type: "identifierInvalid" },
    ]);
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(parseCurrentIdentifier(state)).toBeNull();
    expect(state.fieldError).toBe("invalid_identifier");
  });

  it("surfaces resend_limited on the identifier screen", () => {
    const state = reduce([
      { type: "setPhone", phone: "+380671112233" },
      { type: "sendStart" },
      { type: "sendFailure", kind: "resend_limited" },
    ]);
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(state.bannerError).toBe("resend_limited");
    expect(state.busy).toBe(false);
  });

  it("moves to verify, then wrong-OTP and locked states from typed errors", () => {
    let state = reduce([
      { type: "setPhone", phone: "+380671112233" },
      { type: "sendStart" },
      {
        type: "sendSuccess",
        identifier: { channel: "phone", phoneNumber: "+380671112233" },
        nowMs: 1_000,
      },
    ]);
    expect(state.step).toBe("verify");

    state = otpReducer(state, { type: "setCode", code: "000000" });
    state = otpReducer(state, { type: "verifyStart" });
    state = otpReducer(state, { type: "verifyFailure", kind: "invalid_otp" });
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.codeError).toBe("invalid_otp");
    expect(state.code).toBe("");
    expect(state.bannerError).toBeNull();

    state = otpReducer(state, { type: "setCode", code: "111111" });
    state = otpReducer(state, { type: "verifyStart" });
    state = otpReducer(state, { type: "verifyFailure", kind: "verify_locked" });
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.codeError).toBe("verify_locked");
    expect(new AuthClientError("invalid_otp").message).toBe("invalid_otp");
  });

  it("holds the resend countdown and maps a 429 on resend", () => {
    const sentAt = 1_000;
    let state = reduce([
      { type: "setPhone", phone: "+380671112233" },
      { type: "sendStart" },
      {
        type: "sendSuccess",
        identifier: { channel: "phone", phoneNumber: "+380671112233" },
        nowMs: sentAt,
      },
    ]);
    expect(resendSecondsRemaining(state, sentAt)).toBe(
      authPolicy.resendCooldownSeconds,
    );
    state = otpReducer(state, { type: "resendStart" });
    expect(state.step).toBe("verify");
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.resendBusy).toBe(true);

    const afterCooldown = sentAt + authPolicy.resendCooldownSeconds * 1000;
    state = otpReducer(state, {
      type: "sendFailure",
      kind: "resend_limited",
    });
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.bannerError).toBe("resend_limited");
    expect(state.resendBusy).toBe(false);
    expect(resendSecondsRemaining(state, afterCooldown)).toBeGreaterThanOrEqual(
      0,
    );
  });
});
