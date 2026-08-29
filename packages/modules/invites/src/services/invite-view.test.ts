import { describe, expect, it } from "vitest";

import { derivedInviteStatus } from "./invite-view.js";

const future = new Date("2027-01-01T00:00:00.000Z");
const past = new Date("2020-01-01T00:00:00.000Z");
const now = new Date("2026-06-01T00:00:00.000Z");

describe("derivedInviteStatus", () => {
  it("prefers stored revoked over expiry and exhaustion", () => {
    expect(
      derivedInviteStatus(
        { status: "revoked", expiresAt: past, maxUses: 1, usesCount: 1 },
        now,
      ),
    ).toBe("revoked");
  });

  it("derives expired and exhausted from pending rows", () => {
    expect(
      derivedInviteStatus(
        { status: "pending", expiresAt: past, maxUses: null, usesCount: 0 },
        now,
      ),
    ).toBe("expired");
    expect(
      derivedInviteStatus(
        { status: "pending", expiresAt: future, maxUses: 1, usesCount: 1 },
        now,
      ),
    ).toBe("exhausted");
    expect(
      derivedInviteStatus(
        { status: "pending", expiresAt: future, maxUses: null, usesCount: 9 },
        now,
      ),
    ).toBe("pending");
  });
});
