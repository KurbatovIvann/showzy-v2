import { CoreInvariantError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { requireWritable } from "./writable.js";

describe("requireWritable", () => {
  it("returns the same db when insert is present and preserves the union", () => {
    const writable = { insert: true, select: true };
    const result = requireWritable(writable, "orders");
    expect(result).toBe(writable);
    expect(result.insert).toBe(true);
  });

  it("throws CoreInvariantError with the module label when insert is missing", () => {
    const readable = { select: true };
    expect(() => requireWritable(readable, "catalog")).toThrow(
      CoreInvariantError,
    );
    try {
      requireWritable(readable, "catalog");
    } catch (error) {
      expect(error).toBeInstanceOf(CoreInvariantError);
      if (error instanceof CoreInvariantError) {
        expect(error.message).toBe("catalog expected the writable transaction");
      }
    }
  });
});
