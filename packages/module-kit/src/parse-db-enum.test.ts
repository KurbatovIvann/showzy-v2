import { CoreInvariantError } from "@showzy/core/errors";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { parseDbEnum } from "./parse-db-enum.js";

const statusSchema = z.enum(["active", "archived"]);

describe("parseDbEnum", () => {
  it("returns the parsed value when the schema accepts it", () => {
    expect(parseDbEnum(statusSchema, "active", "illegal")).toBe("active");
  });

  it("throws CoreInvariantError with the caller message", () => {
    expect(() =>
      parseDbEnum(statusSchema, "deleted", 'row has illegal status "deleted"'),
    ).toThrow(CoreInvariantError);
    try {
      parseDbEnum(statusSchema, "deleted", 'row has illegal status "deleted"');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreInvariantError);
      if (error instanceof CoreInvariantError) {
        expect(error.message).toBe('row has illegal status "deleted"');
      }
    }
  });
});
