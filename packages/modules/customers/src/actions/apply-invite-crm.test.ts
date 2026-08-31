import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  applyInviteCrmContract,
  applyInviteCrmInputSchema,
} from "./apply-invite-crm.contract.js";
import { CUSTOMER_NAME_MAX } from "./customer-view.contract.js";

const applyInviteCrmSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../services/apply-invite-crm.ts",
  ),
  "utf8",
);

describe("customers.applyInviteCrm contract", () => {
  it("is an internal customer write that only invites.accept may call", () => {
    expect(applyInviteCrmContract.name).toBe("customers.applyInviteCrm");
    expect(applyInviteCrmContract.principal).toBe("customer");
    expect(applyInviteCrmContract.transport).toBe("internal");
    expect(applyInviteCrmContract.risk).toBe("write");
    expect(applyInviteCrmContract.permissions).toEqual([]);
    expect(applyInviteCrmContract.aiExposure).toBe("internal");
    expect(applyInviteCrmContract.requiresConfirmation).toBe(false);
    expect(applyInviteCrmContract.idempotent).toBe(false);
    expect(applyInviteCrmContract.audit).toBe(true);
    expect(applyInviteCrmContract.emits).toEqual([]);
    expect(applyInviteCrmContract.atomicCalls).toEqual([]);
    expect(applyInviteCrmContract.atomicCallers).toEqual(["invites.accept"]);
    expect(applyInviteCrmContract.timeout).toBe(5_000);
    expect(applyInviteCrmContract.rateLimit).toBeUndefined();
  });

  it("accepts assignment facts and rejects companyId", () => {
    expect(
      applyInviteCrmInputSchema.parse({
        matchUnlinkedContact: true,
        name: "  Марія  ",
        phone: "  +380501112233  ",
      }),
    ).toEqual({
      matchUnlinkedContact: true,
      name: "Марія",
      phone: "+380501112233",
    });
    expect(
      applyInviteCrmInputSchema.safeParse({
        matchUnlinkedContact: false,
        companyId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
    expect(
      applyInviteCrmInputSchema.safeParse({
        matchUnlinkedContact: false,
        name: "n".repeat(CUSTOMER_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    expect(applyInviteCrmInputSchema.safeParse({}).success).toBe(false);
  });

  it("caps unlinked contact match locks at two rows", () => {
    const matchFn = applyInviteCrmSource.slice(
      applyInviteCrmSource.indexOf("async function findUnlinkedContactMatches"),
    );
    expect(matchFn).toContain(".limit(2)");
    expect(matchFn).toContain('.for("update")');
  });
});
