import { describe, expect, it } from "vitest";

import {
  documentFormLeaveBlocked,
  resolveArmedDocumentLeave,
} from "./document-form-leave";

describe("documentFormLeaveBlocked", () => {
  it("blocks leave only when the draft is dirty, idle, and not armed", () => {
    expect(
      documentFormLeaveBlocked({
        dirty: true,
        pending: false,
        leaveArmed: false,
      }),
    ).toBe(true);
    expect(
      documentFormLeaveBlocked({
        dirty: false,
        pending: false,
        leaveArmed: false,
      }),
    ).toBe(false);
    expect(
      documentFormLeaveBlocked({
        dirty: true,
        pending: true,
        leaveArmed: false,
      }),
    ).toBe(false);
    expect(
      documentFormLeaveBlocked({
        dirty: true,
        pending: false,
        leaveArmed: true,
      }),
    ).toBe(false);
  });
});

describe("resolveArmedDocumentLeave", () => {
  it("stays when there is no pending back action (post-create handover)", () => {
    expect(resolveArmedDocumentLeave(null)).toEqual({ kind: "none" });
  });

  it("replays only a pending leave action", () => {
    const action = { type: "GO_BACK" as const };
    expect(resolveArmedDocumentLeave(action)).toEqual({
      kind: "dispatch",
      action,
    });
  });
});
