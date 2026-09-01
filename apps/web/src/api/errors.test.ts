import { describe, expect, it } from "vitest";

import { describeQueryFailure, describeWireCode } from "./errors";

describe("describeQueryFailure", () => {
  it("maps a CONFLICT wire error by code, never by message text", () => {
    const error = {
      code: "CONFLICT" as const,
      status: 409,
      message: "This company address is already taken.",
    };
    expect(describeWireCode(error)).toBe("CONFLICT");
    expect(describeQueryFailure(error)).toEqual({
      kind: "conflict",
      message: "wire",
    });
  });
});
