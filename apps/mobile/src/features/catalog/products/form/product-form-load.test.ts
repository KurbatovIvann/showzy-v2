import { describe, expect, it } from "vitest";

import { classifyProductFormLoad } from "./product-form-load";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("classifyProductFormLoad", () => {
  it("blocks employees before fetching and is ready for create without a query", () => {
    expect(
      classifyProductFormLoad({
        mode: "edit",
        canWrite: false,
        productId: PRODUCT_ID,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyProductFormLoad({
        mode: "create",
        canWrite: true,
        productId: null,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyProductFormLoad({
        mode: "create",
        canWrite: true,
        productId: null,
        clientReady: false,
        status: "pending",
        failureKind: null,
      }),
    ).toEqual({ kind: "error" });
  });
});
