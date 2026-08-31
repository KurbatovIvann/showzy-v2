import { ValidationError } from "@showzy/core/errors";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { requireOrValidationError } from "./require.js";
import { optionalNullableUuid } from "./optional-nullable-uuid.js";

const presentGate = z.object({
  present: z.literal(true, { error: "missing" }),
});

describe("requireOrValidationError", () => {
  it("returns parsed data when the gate passes", () => {
    expect(
      requireOrValidationError(presentGate, { present: true }, "missing"),
    ).toEqual({
      present: true,
    });
  });

  it("throws ValidationError with the public message when the gate fails", () => {
    expect(() =>
      requireOrValidationError(presentGate, { present: false }, "missing"),
    ).toThrow(ValidationError);
    try {
      requireOrValidationError(presentGate, { present: false }, "missing");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.clientMessage).toBe("missing");
      }
    }
  });
});

describe("optionalNullableUuid", () => {
  it("coerces undefined to null and keeps uuid/null", () => {
    expect(optionalNullableUuid(undefined)).toBeNull();
    expect(optionalNullableUuid(null)).toBeNull();
    expect(optionalNullableUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });
});
