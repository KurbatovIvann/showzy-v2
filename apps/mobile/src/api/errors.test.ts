import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { describeWireError } from "./errors";

describe("describeWireError (contract.md §4)", () => {
  it("narrows by code, not by message text", () => {
    const sameMessage = "Something went wrong.";
    const denied: unknown = new ORPCError("PERMISSION_DENIED", {
      defined: true,
      status: 403,
      message: sameMessage,
    });
    const unauthenticated: unknown = new ORPCError("UNAUTHENTICATED", {
      defined: true,
      status: 401,
      message: sameMessage,
    });

    expect(describeWireError(denied)?.code).toBe("PERMISSION_DENIED");
    expect(describeWireError(unauthenticated)?.code).toBe("UNAUTHENTICATED");
    expect(describeWireError(denied)?.message).toBe(sameMessage);
    expect(describeWireError(unauthenticated)?.message).toBe(sameMessage);
  });

  it("surfaces typed extras for retry and confirmation", () => {
    const limited: unknown = new ORPCError("RATE_LIMITED", {
      defined: true,
      status: 429,
      message: "Too many requests. Retry later.",
      data: { retryAfterSec: 12 },
    });
    expect(describeWireError(limited)).toEqual({
      code: "RATE_LIMITED",
      message: "Too many requests. Retry later.",
      retryAfterSec: 12,
    });

    const challenge: unknown = new ORPCError("CONFIRMATION_REQUIRED", {
      defined: true,
      status: 409,
      message: "Confirmation required.",
      data: {
        challenge: {
          challengeId: "c-1",
          summary: "Delete?",
          expiresAt: "2026-08-19T00:00:00.000Z",
        },
      },
    });
    expect(describeWireError(challenge)?.challengeId).toBe("c-1");
  });

  it("returns null for non-wire errors", () => {
    expect(describeWireError(new Error("PERMISSION_DENIED"))).toBeNull();
    expect(describeWireError("PERMISSION_DENIED")).toBeNull();
  });
});
