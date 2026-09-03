import { describe, expect, it } from "vitest";

import { classifyOrderFormLoad } from "./order-form-load";

describe("classifyOrderFormLoad", () => {
  it("hides the form without orders:create before client-ready errors", () => {
    expect(
      classifyOrderFormLoad({ canCreate: false, clientReady: false }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyOrderFormLoad({ canCreate: false, clientReady: true }),
    ).toEqual({ kind: "permission" });
  });

  it("is ready only when the member can create and the client has a company", () => {
    expect(
      classifyOrderFormLoad({ canCreate: true, clientReady: false }),
    ).toEqual({ kind: "error" });
    expect(
      classifyOrderFormLoad({ canCreate: true, clientReady: true }),
    ).toEqual({ kind: "ready" });
  });
});
