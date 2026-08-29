import { describe, expect, it } from "vitest";

import { classifyOrderDetail } from "./classify-order-load";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("classifyOrderDetail", () => {
  const base = {
    orderId: ORDER_ID,
    clientReady: true,
    status: "success" as const,
    failureKind: null,
  };

  it("is not-found when the route id is missing or invalid", () => {
    expect(classifyOrderDetail({ ...base, orderId: null })).toEqual({
      kind: "not-found",
    });
  });

  it("is an error when the client is not ready", () => {
    expect(classifyOrderDetail({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the query is pending", () => {
    expect(classifyOrderDetail({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline, not-found, and other failures", () => {
    expect(
      classifyOrderDetail({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyOrderDetail({
        ...base,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyOrderDetail({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("is ready on a successful fetch", () => {
    expect(classifyOrderDetail(base)).toEqual({ kind: "ready" });
  });
});
