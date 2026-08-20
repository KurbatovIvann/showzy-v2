import { describe, expect, it } from "vitest";

import {
  CREATE_ORDER_COMMENT_MAX,
  CREATE_ORDER_MAX_ITEMS,
  createOrderContract,
} from "./create.contract.js";

describe("orders.create contract", () => {
  it("is a staff client write with orders:create, idempotent audit, and orders.created", () => {
    expect(createOrderContract.name).toBe("orders.create");
    expect(createOrderContract.principal).toBe("staff");
    expect(createOrderContract.transport).toBe("client");
    expect(createOrderContract.risk).toBe("write");
    expect(createOrderContract.permissions).toEqual(["orders:create"]);
    expect(createOrderContract.aiExposure).toBe("exposed");
    expect(createOrderContract.audit).toBe(true);
    expect(createOrderContract.idempotent).toBe(true);
    expect(createOrderContract.emits).toEqual(["orders.created"]);
    expect(createOrderContract.atomicCalls).toEqual([]);
    expect(createOrderContract.timeout).toBe(10_000);
    expect(CREATE_ORDER_MAX_ITEMS).toBe(100);
    expect(CREATE_ORDER_COMMENT_MAX).toBe(2000);
  });
});
