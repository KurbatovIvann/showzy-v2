import { describe, expect, it } from "vitest";

import { completeOrderContract } from "./complete.contract.js";

describe("orders.complete contract", () => {
  it("is a staff client write with orders:edit, idempotent audit, and orders.completed", () => {
    expect(completeOrderContract.name).toBe("orders.complete");
    expect(completeOrderContract.principal).toBe("staff");
    expect(completeOrderContract.transport).toBe("client");
    expect(completeOrderContract.risk).toBe("write");
    expect(completeOrderContract.permissions).toEqual(["orders:edit"]);
    expect(completeOrderContract.aiExposure).toBe("exposed");
    expect(completeOrderContract.audit).toBe(true);
    expect(completeOrderContract.idempotent).toBe(true);
    expect(completeOrderContract.requiresConfirmation).toBe(false);
    expect(completeOrderContract.emits).toEqual(["orders.completed"]);
    expect(completeOrderContract.atomicCalls).toEqual([]);
    expect(completeOrderContract.timeout).toBe(5_000);
  });
});
