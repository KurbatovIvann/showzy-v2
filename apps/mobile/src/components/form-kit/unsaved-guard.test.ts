import { describe, expect, it } from "vitest";

import {
  formLeaveBlocked,
  resolveArmedFormLeave,
  unsavedGuardSheetHandshake,
} from "./unsaved-guard";

describe("formLeaveBlocked", () => {
  it("blocks only when dirty, idle, and not yet armed", () => {
    expect(
      formLeaveBlocked({ dirty: true, pending: false, leaveArmed: false }),
    ).toBe(true);
    expect(
      formLeaveBlocked({ dirty: false, pending: false, leaveArmed: false }),
    ).toBe(false);
    expect(
      formLeaveBlocked({ dirty: true, pending: true, leaveArmed: false }),
    ).toBe(false);
    expect(
      formLeaveBlocked({ dirty: true, pending: false, leaveArmed: true }),
    ).toBe(false);
  });
});

describe("resolveArmedFormLeave", () => {
  it("dispatches a pending navigator action", () => {
    expect(
      resolveArmedFormLeave({
        pendingAction: { type: "GO_BACK" },
        mode: "dispatch-or-back",
      }),
    ).toEqual({ kind: "dispatch", action: { type: "GO_BACK" } });
  });

  it("falls back to router.back when no action is pending", () => {
    expect(
      resolveArmedFormLeave({
        pendingAction: null,
        mode: "dispatch-or-back",
      }),
    ).toEqual({ kind: "back" });
  });

  it("stays on the screen when armed leave is dispatch-only", () => {
    expect(
      resolveArmedFormLeave({
        pendingAction: null,
        mode: "dispatch-only",
      }),
    ).toEqual({ kind: "none" });
  });
});

describe("unsavedGuardSheetHandshake", () => {
  it("waits for dismiss only when a sheet was open", () => {
    expect(unsavedGuardSheetHandshake(true)).toEqual({ waitForDismiss: true });
    expect(unsavedGuardSheetHandshake(false)).toEqual({
      waitForDismiss: false,
    });
  });
});
