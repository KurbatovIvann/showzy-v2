import { describe, expect, it } from "vitest";

import { ensureLinkedCustomerOption } from "./counterparty-form-options";

const CUSTOMER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("ensureLinkedCustomerOption", () => {
  it("leaves options alone when standalone or already listed", () => {
    const options = [{ id: CUSTOMER_ID, name: "Марія" }];
    expect(
      ensureLinkedCustomerOption({
        options,
        customerId: null,
        customerName: "Марія",
        unnamedFallback: "Assigned",
      }),
    ).toBe(options);
    expect(
      ensureLinkedCustomerOption({
        options,
        customerId: CUSTOMER_ID,
        customerName: "Марія",
        unnamedFallback: "Assigned",
      }),
    ).toBe(options);
  });

  it("prepends a linked customer missing from the active picker list", () => {
    expect(
      ensureLinkedCustomerOption({
        options: [{ id: "other", name: "Олена" }],
        customerId: CUSTOMER_ID,
        customerName: "Марія",
        unnamedFallback: "Assigned",
      }),
    ).toEqual([
      { id: CUSTOMER_ID, name: "Марія" },
      { id: "other", name: "Олена" },
    ]);
    expect(
      ensureLinkedCustomerOption({
        options: [],
        customerId: CUSTOMER_ID,
        customerName: null,
        unnamedFallback: "Assigned",
      }),
    ).toEqual([{ id: CUSTOMER_ID, name: "Assigned" }]);
  });
});
