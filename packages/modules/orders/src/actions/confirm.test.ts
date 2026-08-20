import { describe, expect, it } from "vitest";

import { confirmOrderContract } from "./confirm.contract.js";

describe("orders.confirm contract", () => {
  it("is a staff client write with orders:edit, idempotent audit, and orders.confirmed", () => {
    expect(confirmOrderContract.name).toBe("orders.confirm");
    expect(confirmOrderContract.principal).toBe("staff");
    expect(confirmOrderContract.transport).toBe("client");
    expect(confirmOrderContract.risk).toBe("write");
    expect(confirmOrderContract.permissions).toEqual(["orders:edit"]);
    expect(confirmOrderContract.aiExposure).toBe("exposed");
    expect(confirmOrderContract.audit).toBe(true);
    expect(confirmOrderContract.idempotent).toBe(true);
    expect(confirmOrderContract.emits).toEqual(["orders.confirmed"]);
    expect(confirmOrderContract.atomicCalls).toEqual([]);
    expect(confirmOrderContract.timeout).toBe(5_000);
  });
});
