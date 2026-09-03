import { describe, expect, it } from "vitest";

import { classifyOrderDetail } from "./classify-order-load";

describe("classifyOrderDetail (SHO-378)", () => {
  it("treats a missing or invalid id as not-found without waiting on the query", () => {
    expect(
      classifyOrderDetail({
        orderId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "not-found" });
  });

  it("maps wire not_found separately from other failures", () => {
    expect(
      classifyOrderDetail({
        orderId: "11111111-1111-4111-8111-111111111111",
        clientReady: true,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyOrderDetail({
        orderId: "11111111-1111-4111-8111-111111111111",
        clientReady: true,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("is ready only after a successful get", () => {
    expect(
      classifyOrderDetail({
        orderId: "11111111-1111-4111-8111-111111111111",
        clientReady: false,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "loading" });
    expect(
      classifyOrderDetail({
        orderId: "11111111-1111-4111-8111-111111111111",
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "loading" });
    expect(
      classifyOrderDetail({
        orderId: "11111111-1111-4111-8111-111111111111",
        clientReady: true,
        status: "success",
        failureKind: null,
      }),
    ).toEqual({ kind: "ready" });
  });
});
