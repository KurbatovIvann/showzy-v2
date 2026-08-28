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

  it("rethrows non-confirmation failures", async () => {
    await expect(
      submitWithProtocolConfirmation({
        submit: () => Promise.reject(new TypeError("Failed to fetch")),
        confirm: () => Promise.resolve("nope"),
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
