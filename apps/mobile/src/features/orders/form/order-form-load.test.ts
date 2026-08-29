import { describe, expect, it } from "vitest";

import { classifyOrderFormLoad } from "./order-form-load";

describe("classifyOrderFormLoad", () => {
  it("blocks without orders:create before any picker fetch", () => {
    expect(
      classifyOrderFormLoad({
        canCreate: false,
        clientReady: true,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyOrderFormLoad({
        canCreate: true,
        clientReady: true,
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyOrderFormLoad({
        canCreate: true,
        clientReady: false,
      }),
    ).toEqual({ kind: "error" });
  });
});
