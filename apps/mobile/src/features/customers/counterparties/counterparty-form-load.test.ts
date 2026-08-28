import { describe, expect, it } from "vitest";

import { classifyCounterpartyFormLoad } from "./counterparty-form-load";

const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

describe("classifyCounterpartyFormLoad", () => {
  it("blocks employees before fetching and is ready for create without a query", () => {
    expect(
      classifyCounterpartyFormLoad({
        mode: "edit",
        canWrite: false,
        counterpartyId: COUNTERPARTY_ID,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCounterpartyFormLoad({
        mode: "create",
        canWrite: true,
        counterpartyId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyCounterpartyFormLoad({
        mode: "create",
        canWrite: true,
        counterpartyId: null,
        clientReady: false,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "error" });
  });

  it("maps edit query failures onto offline, not-found, and error", () => {
    expect(
      classifyCounterpartyFormLoad({
        mode: "edit",
        canWrite: true,
        counterpartyId: COUNTERPARTY_ID,
        clientReady: true,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyCounterpartyFormLoad({
        mode: "edit",
        canWrite: true,
        counterpartyId: COUNTERPARTY_ID,
        clientReady: true,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyCounterpartyFormLoad({
        mode: "edit",
        canWrite: true,
        counterpartyId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "not-found" });
  });
});
