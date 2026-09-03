import { describe, expect, it } from "vitest";

import { startOrderContract } from "./start.contract.js";

describe("orders.start contract", () => {
  it("is a staff client write with orders:edit, idempotent audit, and orders.started", () => {
    expect(startOrderContract.name).toBe("orders.start");
    expect(startOrderContract.principal).toBe("staff");
    expect(startOrderContract.transport).toBe("client");
    expect(startOrderContract.risk).toBe("write");
    expect(startOrderContract.permissions).toEqual(["orders:edit"]);
    expect(startOrderContract.aiExposure).toBe("exposed");
    expect(startOrderContract.audit).toBe(true);
    expect(startOrderContract.idempotent).toBe(true);
    expect(startOrderContract.requiresConfirmation).toBe(false);
    expect(startOrderContract.emits).toEqual(["orders.started"]);
    expect(startOrderContract.atomicCalls).toEqual([]);
    expect(startOrderContract.timeout).toBe(5_000);
  });
});
