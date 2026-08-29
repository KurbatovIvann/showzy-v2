import { describe, expect, it } from "vitest";

import {
  counterpartyPickerEnabled,
  documentCounterpartyOptionDescription,
  documentOrderOptionDescription,
  documentOrderOptionName,
} from "./document-form-pickers";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("document form pickers", () => {
  it("labels an order as #number plus the list snapshot total", () => {
    const order = {
      orderId: ORDER_ID,
      orderNumber: 12,
      customerId: ORDER_ID,
      status: "confirmed" as const,
      itemCount: 1,
      totalGrossMinor: "123456",
      currency: "UAH",
      createdAt: "2026-08-29T12:00:00.000Z",
    };
    expect(documentOrderOptionName(order)).toBe("#12");
    expect(documentOrderOptionDescription(order)).toContain("₴");
  });

  it("uses edrpou as the counterparty subtitle when present", () => {
    expect(documentCounterpartyOptionDescription({ edrpou: "12345678" })).toBe(
      "12345678",
    );
    expect(documentCounterpartyOptionDescription({ edrpou: null })).toBeNull();
    expect(documentCounterpartyOptionDescription({ edrpou: "" })).toBeNull();
  });

  it("enables the counterparty picker only for an order with a customer", () => {
    expect(counterpartyPickerEnabled({ orderId: "", customerId: null })).toBe(
      false,
    );
    expect(
      counterpartyPickerEnabled({ orderId: ORDER_ID, customerId: null }),
    ).toBe(false);
    expect(
      counterpartyPickerEnabled({ orderId: ORDER_ID, customerId: ORDER_ID }),
    ).toBe(true);
  });
});
