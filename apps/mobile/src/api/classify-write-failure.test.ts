import { describe, expect, it } from "vitest";

import { classifyWriteFailure } from "./classify-write-failure";
import type { QueryFailureKind } from "./errors";

const otherFailureKinds: readonly QueryFailureKind[] = [
  "validation",
  "unauthenticated",
  "not_found",
  "conflict",
  "rate_limited",
  "timeout",
  "internal",
  "network",
];

describe("classifyWriteFailure", () => {
  it("maps null, offline, and permission to themselves", () => {
    expect(classifyWriteFailure(null)).toBeNull();
    expect(classifyWriteFailure("offline")).toBe("offline");
    expect(classifyWriteFailure("permission")).toBe("permission");
  });

  it("does not treat protocol confirmation as a user-facing write failure", () => {
    expect(classifyWriteFailure("confirmation")).toBeNull();
  });

  it("maps remaining query-failure kinds to error", () => {
    for (const kind of otherFailureKinds) {
      expect(classifyWriteFailure(kind)).toBe("error");
    }
  });
});
