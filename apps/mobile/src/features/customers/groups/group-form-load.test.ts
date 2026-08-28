import { describe, expect, it } from "vitest";

import { classifyGroupFormLoad } from "./group-form-load";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("classifyGroupFormLoad", () => {
  it("blocks employees before fetching and is ready for create without a query", () => {
    expect(
      classifyGroupFormLoad({
        mode: "edit",
        canWrite: false,
        groupId: GROUP_ID,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyGroupFormLoad({
        mode: "create",
        canWrite: true,
        groupId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyGroupFormLoad({
        mode: "create",
        canWrite: true,
        groupId: null,
        clientReady: false,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "error" });
  });

  it("maps edit query failures onto offline, not-found, and error", () => {
    expect(
      classifyGroupFormLoad({
        mode: "edit",
        canWrite: true,
        groupId: GROUP_ID,
        clientReady: true,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyGroupFormLoad({
        mode: "edit",
        canWrite: true,
        groupId: GROUP_ID,
        clientReady: true,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyGroupFormLoad({
        mode: "edit",
        canWrite: true,
        groupId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "not-found" });
  });
});
