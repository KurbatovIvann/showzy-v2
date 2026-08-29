import { describe, expect, it } from "vitest";

import { getInviteContract } from "./get.contract.js";
import { listInvitesContract } from "./list.contract.js";
import { revokeInviteContract } from "./revoke.contract.js";

describe("invites.list / get / revoke contracts", () => {
  it("lists and gets as staff reads with customers:view and no secrets metadata", () => {
    expect(listInvitesContract.name).toBe("invites.list");
    expect(listInvitesContract.permissions).toEqual(["customers:view"]);
    expect(listInvitesContract.risk).toBe("read");
    expect(listInvitesContract.timeout).toBe(5_000);
    expect(listInvitesContract.rateLimit).toBeUndefined();
    expect(listInvitesContract.idempotent).toBe(false);
    expect(listInvitesContract.audit).toBe(false);
    expect(listInvitesContract.aiExposure).toBe("exposed");

    expect(getInviteContract.name).toBe("invites.get");
    expect(getInviteContract.permissions).toEqual(["customers:view"]);
    expect(getInviteContract.risk).toBe("read");
    expect(getInviteContract.timeout).toBe(5_000);
    expect(getInviteContract.audit).toBe(false);
  });

  it("revokes as an idempotent audited staff write with customers:invite", () => {
    expect(revokeInviteContract.name).toBe("invites.revoke");
    expect(revokeInviteContract.permissions).toEqual(["customers:invite"]);
    expect(revokeInviteContract.risk).toBe("write");
    expect(revokeInviteContract.idempotent).toBe(true);
    expect(revokeInviteContract.audit).toBe(true);
    expect(revokeInviteContract.emits).toEqual(["invites.revoked"]);
    expect(revokeInviteContract.timeout).toBe(5_000);
    expect(revokeInviteContract.rateLimit).toBeUndefined();
    expect(revokeInviteContract.aiExposure).toBe("exposed");
  });
});
