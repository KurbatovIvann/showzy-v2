import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  acceptInviteContract,
  acceptInviteInputSchema,
} from "./accept.contract.js";

const acceptInviteSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../services/accept-invite.ts"),
  "utf8",
);

describe("invites.accept contract", () => {
  it("is an idempotent audited customer client write with internal AI and one atomic edge", () => {
    expect(acceptInviteContract.name).toBe("invites.accept");
    expect(acceptInviteContract.principal).toBe("customer");
    expect(acceptInviteContract.transport).toBe("client");
    expect(acceptInviteContract.risk).toBe("write");
    expect(acceptInviteContract.permissions).toEqual([]);
    expect(acceptInviteContract.aiExposure).toBe("internal");
    expect(acceptInviteContract.requiresConfirmation).toBe(false);
    expect(acceptInviteContract.idempotent).toBe(true);
    expect(acceptInviteContract.audit).toBe(true);
    expect(acceptInviteContract.emits).toEqual(["invites.accepted"]);
    expect(acceptInviteContract.atomicCalls).toEqual([
      "customers.applyInviteCrm",
    ]);
    expect(acceptInviteContract.atomicCallers).toEqual([]);
    expect(acceptInviteContract.timeout).toBe(10_000);
    expect(acceptInviteContract.rateLimit).toBeUndefined();
  });

  it("accepts a non-empty token and rejects companyId", () => {
    expect(acceptInviteInputSchema.parse({ token: "secret-token" })).toEqual({
      token: "secret-token",
    });
    expect(acceptInviteInputSchema.safeParse({ token: "" }).success).toBe(
      false,
    );
    expect(
      acceptInviteInputSchema.safeParse({
        token: "secret-token",
        companyId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
  });

  it("checks pending status before the CRM atomic write", () => {
    const pendingGuard = acceptInviteSource.indexOf(
      'derivedInviteStatus(locked) !== "pending"',
    );
    const crmWrite = acceptInviteSource.indexOf(
      "ctx.callAtomic(applyInviteCrm",
    );
    expect(pendingGuard).toBeGreaterThan(-1);
    expect(crmWrite).toBeGreaterThan(-1);
    expect(pendingGuard).toBeLessThan(crmWrite);
  });
});
