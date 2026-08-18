import { describe, expect, it } from "vitest";

import { resolveRequestId } from "./request-id.js";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("resolveRequestId", () => {
  it("returns a caller-supplied UUID unchanged", () => {
    expect(resolveRequestId(UUID)).toBe(UUID);
  });

  it("mints a UUID when the header is missing or not a UUID", () => {
    const generated = resolveRequestId(undefined);
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(resolveRequestId("not-a-uuid")).not.toBe("not-a-uuid");
    expect(resolveRequestId("")).not.toBe("");
  });
});
