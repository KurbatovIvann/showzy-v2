import { describe, expect, it } from "vitest";

import { classifyInvitationFormLoad } from "./invitation-form-load";

describe("classifyInvitationFormLoad", () => {
  it("blocks employees before fetching and is ready for create without a query", () => {
    expect(
      classifyInvitationFormLoad({
        canInvite: false,
        clientReady: true,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyInvitationFormLoad({
        canInvite: true,
        clientReady: true,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyInvitationFormLoad({
        canInvite: true,
        clientReady: false,
      }),
    ).toEqual({ kind: "error" });
  });
});
