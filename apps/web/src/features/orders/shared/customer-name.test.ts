/**
 * Per-id CRM hydration tests for order detail (SHO-378).
 */
import { describe, expect, it } from "vitest";

import {
  customerNameLabel,
  resolveCustomerNameHydration,
} from "./customer-name";

describe("resolveCustomerNameHydration", () => {
  it("maps a null customerId to missing, not pending", () => {
    expect(
      resolveCustomerNameHydration({
        customerId: null,
        name: undefined,
        status: "pending",
        notFound: false,
      }),
    ).toEqual({ kind: "missing" });
  });

  it("keeps pending until the name settles", () => {
    expect(
      resolveCustomerNameHydration({
        customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: undefined,
        status: "pending",
        notFound: false,
      }),
    ).toEqual({ kind: "pending" });
  });

  it("uses the CRM name when present", () => {
    expect(
      resolveCustomerNameHydration({
        customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Анна Мельник",
        status: "success",
        notFound: false,
      }),
    ).toEqual({ kind: "ready", name: "Анна Мельник" });
  });
});

describe("customerNameLabel", () => {
  it("falls back to missing-customer copy", () => {
    expect(
      customerNameLabel({ kind: "missing" }, "Клієнт видалений"),
    ).toBe("Клієнт видалений");
    expect(customerNameLabel({ kind: "pending" }, "Клієнт видалений")).toBe("");
    expect(
      customerNameLabel(
        { kind: "ready", name: "Анна Мельник" },
        "Клієнт видалений",
      ),
    ).toBe("Анна Мельник");
  });
});
