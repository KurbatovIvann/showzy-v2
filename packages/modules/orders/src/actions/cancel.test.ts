import { describe, expect, it } from "vitest";

import { cancelOrderContract } from "./cancel.contract.js";

describe("orders.cancel contract", () => {
  it("is a staff client write with orders:edit, idempotent audit, and orders.canceled", () => {
    expect(cancelOrderContract.name).toBe("orders.cancel");
    expect(cancelOrderContract.principal).toBe("staff");
    expect(cancelOrderContract.transport).toBe("client");
    expect(cancelOrderContract.risk).toBe("write");
    expect(cancelOrderContract.permissions).toEqual(["orders:edit"]);
    expect(cancelOrderContract.aiExposure).toBe("exposed");
    expect(cancelOrderContract.audit).toBe(true);
    expect(cancelOrderContract.idempotent).toBe(true);
    expect(cancelOrderContract.requiresConfirmation).toBe(false);
    expect(cancelOrderContract.emits).toEqual(["orders.canceled"]);
    expect(cancelOrderContract.atomicCalls).toEqual([]);
    expect(cancelOrderContract.timeout).toBe(5_000);
    expect(cancelOrderContract.description).toContain(
      "new, confirmed, or in-progress",
    );
  });
});
