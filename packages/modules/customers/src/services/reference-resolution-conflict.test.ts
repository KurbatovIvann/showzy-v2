import { ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  CustomerReferenceConflictError,
  ambiguousCustomerQueryMessage,
} from "./reference-resolution-conflict.js";

describe("CustomerReferenceConflictError", () => {
  it("is a CONFLICT subclass with a customer target and picker options", () => {
    const error = new CustomerReferenceConflictError({
      target: { kind: "customer", query: "Katya" },
      options: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          label: "Katya (…2233)",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Katya (…5566)",
        },
      ],
      optionsTruncated: false,
      clientMessage: ambiguousCustomerQueryMessage("Katya"),
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(CustomerReferenceConflictError);
    expect(error.code).toBe("CONFLICT");
    expect(error.reason).toBe("ambiguous");
    expect(error.target).toEqual({ kind: "customer", query: "Katya" });
    expect(error.options).toHaveLength(2);
    expect(error.optionsTruncated).toBe(false);
    expect(error.clientMessage).toBe('Select a customer matching "Katya".');
    expect(error.clientMessage).not.toContain("Multiple matches");
  });
});
