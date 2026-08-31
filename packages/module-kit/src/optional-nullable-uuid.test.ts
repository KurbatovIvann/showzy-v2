import { describe, expect, it } from "vitest";

import { optionalNullableUuid } from "./optional-nullable-uuid.js";

describe("optionalNullableUuid", () => {
  it("keeps a present string", () => {
    expect(optionalNullableUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });

  it("maps undefined and null to null", () => {
    expect(optionalNullableUuid(undefined)).toBeNull();
    expect(optionalNullableUuid(null)).toBeNull();
  });
});
