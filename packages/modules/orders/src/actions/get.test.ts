import { describe, expect, it } from "vitest";

import { getOrderContract } from "./get.contract.js";

describe("orders.get contract", () => {
  it("is a staff client read with orders:view and no audit", () => {
    expect(getOrderContract.name).toBe("orders.get");
    expect(getOrderContract.principal).toBe("staff");
    expect(getOrderContract.transport).toBe("client");
    expect(getOrderContract.risk).toBe("read");
    expect(getOrderContract.permissions).toEqual(["orders:view"]);
    expect(getOrderContract.aiExposure).toBe("exposed");
    expect(getOrderContract.audit).toBe(false);
    expect(getOrderContract.idempotent).toBe(false);
    expect(getOrderContract.emits).toEqual([]);
    expect(getOrderContract.timeout).toBe(2_000);
  });
});
