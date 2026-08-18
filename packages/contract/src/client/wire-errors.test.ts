import { describe, expect, it } from "vitest";

import {
  wireConfirmationChallengeSchema,
  wireErrorDefinitions,
  wireErrorStatus,
  wireValidationIssueSchema,
  type WireErrorCode,
} from "./wire-errors.js";

describe("contract.md §4 wire table", () => {
  it("pins wire code → HTTP status exactly (renames are spec rework)", () => {
    expect(wireErrorStatus).toEqual({
      VALIDATION: 400,
      PERMISSION_DENIED: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      IDEMPOTENCY_CONFLICT: 409,
      RETRY_IN_PROGRESS: 409,
      CONFIRMATION_REQUIRED: 409,
      RATE_LIMITED: 429,
      TIMEOUT: 504,
      INTERNAL: 500,
    });
  });

  it("defines an oRPC error entry per wire code with the table's status", () => {
    expect(Object.keys(wireErrorDefinitions).sort()).toEqual(
      Object.keys(wireErrorStatus).sort(),
    );
    for (const [code, definition] of Object.entries(wireErrorDefinitions)) {
      expect(definition.status).toBe(wireErrorStatus[code as WireErrorCode]);
    }
  });

  it("declares typed extras exactly where the table says", () => {
    const withData = Object.entries(wireErrorDefinitions)
      .filter(([, definition]) => "data" in definition)
      .map(([code]) => code)
      .sort();
    expect(withData).toEqual([
      "CONFIRMATION_REQUIRED",
      "RATE_LIMITED",
      "RETRY_IN_PROGRESS",
      "VALIDATION",
    ]);
  });

  it("accepts a real Zod issue shape and passes extra fields through", () => {
    const issue = {
      code: "too_small",
      path: ["items", 0, "quantity"],
      message: "Too small: expected number to be >0",
      origin: "number",
      minimum: 0,
    };
    const parsed = wireValidationIssueSchema.parse(issue);
    expect(parsed).toEqual(issue);
  });

  it("pins the client-visible confirmation challenge fields (core.md §7)", () => {
    const challenge = {
      challengeId: "c-1",
      summary: "Delete order #42?",
      expiresAt: new Date().toISOString(),
    };
    expect(wireConfirmationChallengeSchema.parse(challenge)).toEqual(challenge);
    expect(
      wireConfirmationChallengeSchema.safeParse({
        ...challenge,
        inputHash: "leak",
      }).data,
    ).toEqual(challenge);
  });
});
