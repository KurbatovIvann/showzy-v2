import { describe, expect, it } from "vitest";

import { classifyCustomerFormLoad } from "./customer-form-load";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("classifyCustomerFormLoad", () => {
  it("blocks employees before fetching and is ready for create without a query", () => {
    expect(
      classifyCustomerFormLoad({
        mode: "edit",
        canWrite: false,
        customerId: CUSTOMER_ID,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCustomerFormLoad({
        mode: "create",
        canWrite: true,
        customerId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyCustomerFormLoad({
        mode: "create",
        canWrite: true,
        customerId: null,
        clientReady: false,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "error" });
  });

  it("maps edit query failures onto offline, not-found, and error", () => {
    expect(
      classifyCustomerFormLoad({
        mode: "edit",
        canWrite: true,
        customerId: CUSTOMER_ID,
        clientReady: true,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyCustomerFormLoad({
        mode: "edit",
        canWrite: true,
        customerId: CUSTOMER_ID,
        clientReady: true,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyCustomerFormLoad({
        mode: "edit",
        canWrite: true,
        customerId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "not-found" });
  });
});
