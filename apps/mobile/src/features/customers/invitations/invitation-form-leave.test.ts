import { describe, expect, it } from "vitest";

import { resolveArmedInvitationLeave } from "./invitation-form-leave";

describe("resolveArmedInvitationLeave", () => {
  it("stays when there is no pending back action", () => {
    expect(resolveArmedInvitationLeave(null)).toEqual({ kind: "none" });
  });

  it("replays only a pending leave action", () => {
    const action = { type: "GO_BACK" as const };
    expect(resolveArmedInvitationLeave(action)).toEqual({
      kind: "dispatch",
      action,
    });
  });
});
