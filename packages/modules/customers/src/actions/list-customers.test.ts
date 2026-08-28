import { describe, expect, it } from "vitest";

import { LIST_CUSTOMERS_SEARCH_MAX as VALIDATION_SEARCH_MAX } from "@showzy/validation/customers";

import {
  LIST_CUSTOMERS_CURSOR_MAX,
  LIST_CUSTOMERS_DEFAULT_LIMIT,
  LIST_CUSTOMERS_MAX_LIMIT,
  LIST_CUSTOMERS_SEARCH_MAX,
  formatListCustomersCursor,
  listCustomersContract,
  parseListCustomersCursor,
} from "./list-customers.contract.js";

describe("customers.listCustomers contract", () => {
  it("is a staff client read with customers:view", () => {
    expect(listCustomersContract.name).toBe("customers.listCustomers");
    expect(listCustomersContract.principal).toBe("staff");
    expect(listCustomersContract.transport).toBe("client");
    expect(listCustomersContract.risk).toBe("read");
    expect(listCustomersContract.permissions).toEqual(["customers:view"]);
    expect(listCustomersContract.aiExposure).toBe("exposed");
    expect(listCustomersContract.audit).toBe(false);
    expect(listCustomersContract.idempotent).toBe(false);
    expect(listCustomersContract.emits).toEqual([]);
    expect(listCustomersContract.timeout).toBe(5_000);
    expect(listCustomersContract.rateLimit).toBeUndefined();
    expect(LIST_CUSTOMERS_DEFAULT_LIMIT).toBe(20);
    expect(LIST_CUSTOMERS_MAX_LIMIT).toBe(50);
    expect(LIST_CUSTOMERS_SEARCH_MAX).toBe(VALIDATION_SEARCH_MAX);
    expect(LIST_CUSTOMERS_SEARCH_MAX).toBe(100);
    expect(LIST_CUSTOMERS_CURSOR_MAX).toBe(80);
  });

  it("defaults status to active and rejects a malformed cursor, oversized limit, and over-max search", () => {
    expect(listCustomersContract.input.parse({}).status).toBe("active");
    expect(listCustomersContract.input.parse({}).limit).toBe(
      LIST_CUSTOMERS_DEFAULT_LIMIT,
    );
    expect(
      listCustomersContract.input.safeParse({ cursor: "nope" }).success,
    ).toBe(false);
    expect(
      listCustomersContract.input.safeParse({
        limit: LIST_CUSTOMERS_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(listCustomersContract.input.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(
      listCustomersContract.input.safeParse({ status: "deleted" }).success,
    ).toBe(false);
    expect(
      listCustomersContract.input.safeParse({ groupId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      listCustomersContract.input.safeParse({
        search: "x".repeat(LIST_CUSTOMERS_SEARCH_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      listCustomersContract.input.safeParse({ search: "   " }).success,
    ).toBe(false);
    expect(parseListCustomersCursor("nope")).toBeUndefined();
    expect(
      parseListCustomersCursor(
        formatListCustomersCursor(new Date("2026-01-01T00:00:00.000Z"), "nope"),
      ),
    ).toBeUndefined();
  });

  it("round-trips an updatedAt/id cursor", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const updatedAt = new Date("2026-03-01T00:00:00.000Z");
    const cursor = formatListCustomersCursor(updatedAt, id);
    expect(parseListCustomersCursor(cursor)).toEqual({
      updatedAt: "2026-03-01T00:00:00.000Z",
      id,
    });
  });
});
