import { ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  ReferenceResolutionConflictError,
  ambiguousProductQueryMessage,
  noActiveVariantsMessage,
} from "./reference-resolution-conflict.js";

describe("ReferenceResolutionConflictError", () => {
  it("is a CONFLICT subclass with structured reason, target, and options", () => {
    const error = new ReferenceResolutionConflictError({
      reason: "no_active_variants",
      target: {
        kind: "order_line_variant",
        lineIndex: 2,
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Retired Box",
      },
      options: [],
      optionsTruncated: false,
      clientMessage: noActiveVariantsMessage("Retired Box"),
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(ReferenceResolutionConflictError);
    expect(error.code).toBe("CONFLICT");
    expect(error.reason).toBe("no_active_variants");
    expect(error.target).toEqual({
      kind: "order_line_variant",
      lineIndex: 2,
      productId: "11111111-1111-4111-8111-111111111111",
      productName: "Retired Box",
    });
    expect(error.options).toEqual([]);
    expect(error.optionsTruncated).toBe(false);
    expect(error.clientMessage).toBe('"Retired Box" has no active variants.');
  });

  it("carries a product-line target for ambiguous product queries", () => {
    const error = new ReferenceResolutionConflictError({
      reason: "ambiguous",
      target: {
        kind: "order_line_product",
        lineIndex: 0,
        query: "макаронс",
      },
      options: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Макаронси",
        },
      ],
      optionsTruncated: false,
      clientMessage: ambiguousProductQueryMessage("макаронс"),
    });
    expect(error.code).toBe("CONFLICT");
    expect(error.reason).toBe("ambiguous");
    expect(error.target.kind).toBe("order_line_product");
    expect(error.options).toHaveLength(1);
    expect(error.clientMessage).not.toContain("Multiple matches");
  });
});
