import { describe, expect, it } from "vitest";

import { LIST_COUNTERPARTIES_SEARCH_MAX as VALIDATION_SEARCH_MAX } from "@showzy/validation/customers";

import {
  LIST_COUNTERPARTIES_CURSOR_MAX,
  LIST_COUNTERPARTIES_DEFAULT_LIMIT,
  LIST_COUNTERPARTIES_MAX_LIMIT,
  LIST_COUNTERPARTIES_SEARCH_MAX,
  formatListCounterpartiesCursor,
  listCounterpartiesContract,
  parseListCounterpartiesCursor,
} from "./list-counterparties.contract.js";

describe("customers.listCounterparties contract", () => {
  it("is a staff client read with customers:view", () => {
    expect(listCounterpartiesContract.name).toBe(
      "customers.listCounterparties",
    );
    expect(listCounterpartiesContract.principal).toBe("staff");
    expect(listCounterpartiesContract.transport).toBe("client");
    expect(listCounterpartiesContract.risk).toBe("read");
    expect(listCounterpartiesContract.permissions).toEqual(["customers:view"]);
    expect(listCounterpartiesContract.aiExposure).toBe("exposed");
    expect(listCounterpartiesContract.requiresConfirmation).toBe(false);
    expect(listCounterpartiesContract.audit).toBe(false);
    expect(listCounterpartiesContract.idempotent).toBe(false);
    expect(listCounterpartiesContract.emits).toEqual([]);
    expect(listCounterpartiesContract.timeout).toBe(5_000);
    expect(listCounterpartiesContract.rateLimit).toBeUndefined();
    expect(LIST_COUNTERPARTIES_DEFAULT_LIMIT).toBe(20);
    expect(LIST_COUNTERPARTIES_MAX_LIMIT).toBe(50);
    expect(LIST_COUNTERPARTIES_SEARCH_MAX).toBe(VALIDATION_SEARCH_MAX);
    expect(LIST_COUNTERPARTIES_SEARCH_MAX).toBe(100);
    expect(LIST_COUNTERPARTIES_CURSOR_MAX).toBe(80);
  });

  it("defaults limit to 20 and rejects a malformed cursor, oversized limit, and over-max search", () => {
    expect(listCounterpartiesContract.input.parse({}).limit).toBe(
      LIST_COUNTERPARTIES_DEFAULT_LIMIT,
    );
    expect(
      listCounterpartiesContract.input.safeParse({ cursor: "nope" }).success,
    ).toBe(false);
    expect(
      listCounterpartiesContract.input.safeParse({
        limit: LIST_COUNTERPARTIES_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(
      listCounterpartiesContract.input.safeParse({ limit: 0 }).success,
    ).toBe(false);
    expect(
      listCounterpartiesContract.input.safeParse({ customerId: "not-a-uuid" })
        .success,
    ).toBe(false);
    expect(
      listCounterpartiesContract.input.safeParse({
        search: "x".repeat(LIST_COUNTERPARTIES_SEARCH_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      listCounterpartiesContract.input.safeParse({ search: "   " }).success,
    ).toBe(false);
    expect(parseListCounterpartiesCursor("nope")).toBeUndefined();
    expect(
      parseListCounterpartiesCursor(
        formatListCounterpartiesCursor(
          new Date("2026-01-01T00:00:00.000Z"),
          "nope",
        ),
      ),
    ).toBeUndefined();
  });

  it("round-trips an updatedAt/id cursor", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const updatedAt = new Date("2026-03-01T00:00:00.000Z");
    const cursor = formatListCounterpartiesCursor(updatedAt, id);
    expect(parseListCounterpartiesCursor(cursor)).toEqual({
      updatedAt: "2026-03-01T00:00:00.000Z",
      id,
    });
  });
});
