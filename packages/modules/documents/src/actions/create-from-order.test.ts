import { describe, expect, it } from "vitest";

import {
  createFromOrderContract,
  createFromOrderInputSchema,
} from "./create-from-order.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("documents.createFromOrder contract", () => {
  it("is a staff client write with documents:create, idempotent audit, and documents.created", () => {
    expect(createFromOrderContract.name).toBe("documents.createFromOrder");
    expect(createFromOrderContract.principal).toBe("staff");
    expect(createFromOrderContract.transport).toBe("client");
    expect(createFromOrderContract.risk).toBe("write");
    expect(createFromOrderContract.permissions).toEqual(["documents:create"]);
    expect(createFromOrderContract.aiExposure).toBe("exposed");
    expect(createFromOrderContract.audit).toBe(true);
    expect(createFromOrderContract.idempotent).toBe(true);
    expect(createFromOrderContract.requiresConfirmation).toBe(false);
    expect(createFromOrderContract.emits).toEqual(["documents.created"]);
    expect(createFromOrderContract.atomicCalls).toEqual([]);
    expect(createFromOrderContract.atomicCallers).toEqual([]);
    expect(createFromOrderContract.timeout).toBe(15_000);
  });

  it("accepts orderId + type and optional counterpartyId, and rejects companyId", () => {
    expect(
      createFromOrderInputSchema.parse({
        orderId: validId,
        type: "payment_invoice",
      }),
    ).toEqual({ orderId: validId, type: "payment_invoice" });
    expect(
      createFromOrderInputSchema.parse({
        orderId: validId,
        type: "delivery_note",
        counterpartyId: validId,
      }),
    ).toEqual({
      orderId: validId,
      type: "delivery_note",
      counterpartyId: validId,
    });
    expect(
      createFromOrderInputSchema.safeParse({
        orderId: validId,
        type: "payment_invoice",
        companyId: validId,
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.safeParse({
        type: "payment_invoice",
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.safeParse({
        orderId: validId,
        type: "agreement",
      }).success,
    ).toBe(false);
  });
});
