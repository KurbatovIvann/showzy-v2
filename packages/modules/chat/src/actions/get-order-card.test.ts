import { describe, expect, it } from "vitest";

import { getOrderCardContract } from "./get-order-card.contract.js";

describe("chat.getOrderCard contract", () => {
  it("is a staff client read with chat:view, AI-internal, and no audit", () => {
    expect(getOrderCardContract.name).toBe("chat.getOrderCard");
    expect(getOrderCardContract.principal).toBe("staff");
    expect(getOrderCardContract.transport).toBe("client");
    expect(getOrderCardContract.risk).toBe("read");
    expect(getOrderCardContract.permissions).toEqual(["chat:view"]);
    expect(getOrderCardContract.aiExposure).toBe("internal");
    expect(getOrderCardContract.audit).toBe(false);
    expect(getOrderCardContract.idempotent).toBe(false);
    expect(getOrderCardContract.emits).toEqual([]);
    expect(getOrderCardContract.timeout).toBe(2_000);
  });
});
