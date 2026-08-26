import { describe, expect, it } from "vitest";

import { classifyProductDetail } from "./classify-product-load";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("classifyProductDetail", () => {
  const base = {
    productId: PRODUCT_ID,
    clientReady: true,
    status: "success" as const,
    failureKind: null,
  };

  it("is not-found when the route id is missing or invalid", () => {
    expect(classifyProductDetail({ ...base, productId: null })).toEqual({
      kind: "not-found",
    });
  });

  it("is an error when the client is not ready", () => {
    expect(classifyProductDetail({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the query is pending", () => {
    expect(classifyProductDetail({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline, not-found, and other failures", () => {
    expect(
      classifyProductDetail({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyProductDetail({
        ...base,
        status: "error",
        failureKind: "not_found",
      }),
    ).toEqual({ kind: "not-found" });
    expect(
      classifyProductDetail({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("is ready on a successful fetch", () => {
    expect(classifyProductDetail(base)).toEqual({ kind: "ready" });
  });
});
