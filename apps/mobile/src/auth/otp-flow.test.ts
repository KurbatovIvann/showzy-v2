import { describe, expect, it } from "vitest";

import { AuthClientError } from "./errors";
import { createOtpFlow } from "./otp-flow";
import { authPolicy } from "./policy";
import type { AuthApi } from "./api";
import type { SessionController } from "./session";

function flowFixture(options?: {
  send?: AuthApi["sendOtp"];
  verify?: AuthApi["verifyOtp"];
  completeSignIn?: SessionController["completeSignIn"];
  now?: () => number;
}) {
  const sent: unknown[] = [];
  const verified: unknown[] = [];
  const signedIn: string[] = [];
  const flow = createOtpFlow({
    api: {
      sendOtp:
        options?.send ??
        ((identifier) => {
          sent.push(identifier);
          return Promise.resolve();
        }),
      verifyOtp:
        options?.verify ??
        ((identifier, code) => {
          verified.push({ identifier, code });
          return Promise.resolve("tok");
        }),
    },
    session: {
      completeSignIn:
        options?.completeSignIn ??
        ((token) => {
          signedIn.push(token);
          return Promise.resolve({
            userId: "user-1",
            email: null,
            phoneNumber: "+380671112233",
          });
        }),
    },
    ...(options?.now === undefined ? {} : { now: options.now }),
  });
  return { flow, sent, verified, signedIn };
}

describe("OTP flow UI states", () => {
  it("rejects a malformed identifier without calling send", async () => {
    const { flow, sent } = flowFixture();
    flow.setPhone("67");
    await flow.submitIdentifier();
    const state = flow.get();
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(state.fieldError).toBe("invalid_identifier");
    expect(sent).toHaveLength(0);
  });

  it("surfaces resend_limited on the identifier screen from a 429", async () => {
    const { flow } = flowFixture({
      send: () => Promise.reject(new AuthClientError("resend_limited", 60)),
    });
    flow.setPhone("+380671112233");
    await flow.submitIdentifier();
    const state = flow.get();
    expect(state.step).toBe("identifier");
    if (state.step !== "identifier") {
      throw new Error("expected identifier step");
    }
    expect(state.bannerError).toBe("resend_limited");
    expect(state.busy).toBe(false);
  });

  it("moves to verify, then wrong-OTP and locked states from typed errors", async () => {
    let verifyKind: "invalid_otp" | "verify_locked" | "ok" = "invalid_otp";
    const { flow, signedIn } = flowFixture({
      verify: () => {
        if (verifyKind === "ok") {
          return Promise.resolve("tok");
        }
        return Promise.reject(new AuthClientError(verifyKind));
      },
    });
    flow.setPhone("+380671112233");
    await flow.submitIdentifier();
    expect(flow.get().step).toBe("verify");

    flow.setCode("000000");
    await flow.submitCode();
    let verify = flow.get();
    expect(verify.step).toBe("verify");
    if (verify.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(verify.codeError).toBe("invalid_otp");
    expect(verify.code).toBe("");
    expect(verify.bannerError).toBeNull();

    flow.setCode("111111");
    verifyKind = "verify_locked";
    await flow.submitCode();
    verify = flow.get();
    if (verify.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(verify.codeError).toBe("verify_locked");
    expect(signedIn).toHaveLength(0);

    verifyKind = "ok";
    flow.setCode("222222");
    await flow.submitCode();
    expect(signedIn).toEqual(["tok"]);
  });

  it("holds the resend countdown and maps a 429 on resend", async () => {
    let clock = 1_000;
    let sendCount = 0;
    const { flow } = flowFixture({
      now: () => clock,
      send: () => {
        sendCount += 1;
        if (sendCount === 2) {
          return Promise.reject(new AuthClientError("resend_limited"));
        }
        return Promise.resolve();
      },
    });
    flow.setPhone("+380671112233");
    await flow.submitIdentifier();
    expect(flow.resendSecondsRemaining()).toBe(
      authPolicy.resendCooldownSeconds,
    );
    await flow.resend();
    expect(sendCount).toBe(1);

    clock += authPolicy.resendCooldownSeconds * 1000;
    await flow.resend();
    const state = flow.get();
    expect(sendCount).toBe(2);
    if (state.step !== "verify") {
      throw new Error("expected verify step");
    }
    expect(state.bannerError).toBe("resend_limited");
  });
});
