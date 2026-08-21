import { describe, expect, it } from "vitest";

import {
  ORDER_CARD_EVENT_NAMES,
  upsertOrderCardContract,
} from "./upsert-order-card.contract.js";

describe("chat.upsertOrderCard contract", () => {
  it("is a tenant system write, internal, audited, and delivery-idempotent", () => {
    expect(upsertOrderCardContract.name).toBe("chat.upsertOrderCard");
    expect(upsertOrderCardContract.principal).toBe("system");
    expect(upsertOrderCardContract.systemScope).toBe("tenant");
    expect(upsertOrderCardContract.transport).toBe("internal");
    expect(upsertOrderCardContract.risk).toBe("write");
    expect(upsertOrderCardContract.permissions).toEqual([]);
    expect(upsertOrderCardContract.aiExposure).toBe("internal");
    expect(upsertOrderCardContract.audit).toBe(true);
    expect(upsertOrderCardContract.idempotent).toBe(true);
    expect(upsertOrderCardContract.emits).toEqual([]);
    expect(upsertOrderCardContract.timeout).toBe(5_000);
    expect([...ORDER_CARD_EVENT_NAMES]).toEqual([
      "orders.created",
      "orders.confirmed",
    ]);
  });
});
