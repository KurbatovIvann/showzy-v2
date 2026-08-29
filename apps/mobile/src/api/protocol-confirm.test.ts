import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  confirmationChallengeId,
  submitWithProtocolConfirmation,
} from "./protocol-confirm";

function confirmationRequired(
  challengeId: string,
): ORPCError<
  "CONFIRMATION_REQUIRED",
  { challenge: { challengeId: string; summary: string; expiresAt: string } }
> {
  return new ORPCError("CONFIRMATION_REQUIRED", {
    defined: true,
    status: 409,
    message: "Confirm.",
    data: {
      challenge: {
        challengeId,
        summary: "Delete?",
        expiresAt: "2026-08-28T00:00:00.000Z",
      },
    },
  });
}

describe("confirmationChallengeId", () => {
  it("returns the challenge id from CONFIRMATION_REQUIRED", () => {
    expect(confirmationChallengeId(confirmationRequired("challenge-9"))).toBe(
      "challenge-9",
    );
  });

  it("returns null when the error is not CONFIRMATION_REQUIRED", () => {
    expect(
      confirmationChallengeId(new TypeError("Failed to fetch")),
    ).toBeNull();
    expect(
      confirmationChallengeId(
        new ORPCError("PERMISSION_DENIED", {
          defined: true,
          status: 403,
          message: "Denied.",
        }),
      ),
    ).toBeNull();
  });
});

describe("submitWithProtocolConfirmation", () => {
  it("returns the submit result when the server does not challenge", async () => {
    const result = await submitWithProtocolConfirmation({
      submit: () => Promise.resolve("ok"),
      confirm: () => Promise.resolve("confirmed"),
    });
    expect(result).toBe("ok");
  });

  it("re-invokes confirm with the challenge id from CONFIRMATION_REQUIRED", async () => {
    const calls: string[] = [];
    const result = await submitWithProtocolConfirmation({
      submit: () => {
        calls.push("submit");
        return Promise.reject(confirmationRequired("challenge-9"));
      },
      confirm: (challengeId) => {
        calls.push(challengeId);
        return Promise.resolve("confirmed");
      },
    });
    expect(result).toBe("confirmed");
    expect(calls).toEqual(["submit", "challenge-9"]);
    expect(confirmationChallengeId(confirmationRequired("challenge-9"))).toBe(
      "challenge-9",
    );
  });

  it("rethrows non-confirmation failures unchanged", async () => {
    const networkError = new TypeError("Failed to fetch");
    await expect(
      submitWithProtocolConfirmation({
        submit: () => Promise.reject(networkError),
        confirm: () => Promise.resolve("nope"),
      }),
    ).rejects.toBe(networkError);

    const permissionError = new ORPCError("PERMISSION_DENIED", {
      defined: true,
      status: 403,
      message: "Denied.",
    });
    await expect(
      submitWithProtocolConfirmation({
        submit: () => Promise.reject(permissionError),
        confirm: () => Promise.resolve("nope"),
      }),
    ).rejects.toBe(permissionError);
  });
});
